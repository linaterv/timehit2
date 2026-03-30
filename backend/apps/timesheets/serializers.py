from rest_framework import serializers
from .models import Timesheet, TimesheetEntry, TimesheetAttachment


class TimesheetEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = TimesheetEntry
        fields = ["id", "date", "hours", "task_name", "notes"]


class TimesheetAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimesheetAttachment
        fields = ["id", "file_name", "file_size_bytes", "mime_type", "uploaded_at"]


class TimesheetListSerializer(serializers.ModelSerializer):
    approved_by = serializers.SerializerMethodField()
    rejected_by = serializers.SerializerMethodField()
    has_attachments = serializers.SerializerMethodField()
    entry_count = serializers.SerializerMethodField()
    placement = serializers.SerializerMethodField()

    class Meta:
        model = Timesheet
        fields = [
            "id", "placement_id", "placement", "year", "month", "status", "total_hours",
            "submitted_at", "approved_at", "approved_by", "rejected_at",
            "rejected_by", "rejection_reason", "has_attachments", "entry_count", "created_at",
        ]

    def _user_ref(self, user):
        return {"id": str(user.id), "full_name": user.full_name} if user else None

    def get_approved_by(self, obj):
        return self._user_ref(obj.approved_by)

    def get_rejected_by(self, obj):
        return self._user_ref(obj.rejected_by)

    def get_has_attachments(self, obj):
        return obj.attachments.exists()

    def get_placement(self, obj):
        p = obj.placement
        return {
            "client": {"id": str(p.client_id), "company_name": p.client.company_name},
            "contractor": {"id": str(p.contractor_id), "full_name": p.contractor.full_name},
            "title": p.title,
        }

    def get_entry_count(self, obj):
        return obj.entries.count()


class TimesheetDetailSerializer(TimesheetListSerializer):
    placement = serializers.SerializerMethodField()
    entries = TimesheetEntrySerializer(many=True, read_only=True)
    attachments = TimesheetAttachmentSerializer(many=True, read_only=True)

    class Meta(TimesheetListSerializer.Meta):
        fields = TimesheetListSerializer.Meta.fields + ["placement", "entries", "attachments"]

    def get_placement(self, obj):
        p = obj.placement
        request = self.context.get("request")
        can_see = request and request.user and request.user.role in ("ADMIN", "BROKER")
        result = {
            "client": {"id": str(p.client_id), "company_name": p.client.company_name},
            "contractor": {"id": str(p.contractor_id), "full_name": p.contractor.full_name},
            "title": p.title,
            "client_rate": str(p.client_rate) if can_see else None,
            "contractor_rate": str(p.contractor_rate) if can_see else None,
            "currency": p.currency, "approval_flow": p.approval_flow,
            "require_timesheet_attachment": p.require_timesheet_attachment,
        }
        return result


class TimesheetCreateSerializer(serializers.Serializer):
    year = serializers.IntegerField()
    month = serializers.IntegerField(min_value=1, max_value=12)


class EntryInputSerializer(serializers.Serializer):
    date = serializers.DateField()
    hours = serializers.DecimalField(max_digits=4, decimal_places=2, min_value=0)
    task_name = serializers.CharField(required=False, default="", allow_blank=True)
    notes = serializers.CharField(required=False, default="", allow_blank=True)


class BulkEntrySerializer(serializers.Serializer):
    entries = EntryInputSerializer(many=True)


class SubmitSerializer(serializers.Serializer):
    confirm_zero = serializers.BooleanField(required=False, default=False)


class RejectSerializer(serializers.Serializer):
    reason = serializers.CharField()
