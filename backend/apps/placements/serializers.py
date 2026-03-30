from rest_framework import serializers
from .models import Placement, PlacementDocument


def _can_see_rates(context):
    """Only ADMIN and BROKER can see rates."""
    request = context.get("request")
    if not request or not request.user:
        return False
    return request.user.role in ("ADMIN", "BROKER")


class PlacementListSerializer(serializers.ModelSerializer):
    client = serializers.SerializerMethodField()
    contractor = serializers.SerializerMethodField()
    client_rate = serializers.SerializerMethodField()
    contractor_rate = serializers.SerializerMethodField()

    class Meta:
        model = Placement
        fields = [
            "id", "client", "contractor", "title", "client_rate", "contractor_rate",
            "currency", "start_date", "end_date", "status", "approval_flow",
            "require_timesheet_attachment", "client_can_view_invoices",
            "client_can_view_documents", "notes", "created_at",
        ]

    def get_client(self, obj):
        return {"id": str(obj.client_id), "company_name": obj.client.company_name}

    def get_contractor(self, obj):
        return {"id": str(obj.contractor_id), "full_name": obj.contractor.full_name}

    def get_client_rate(self, obj):
        return str(obj.client_rate) if _can_see_rates(self.context) else None

    def get_contractor_rate(self, obj):
        return str(obj.contractor_rate) if _can_see_rates(self.context) else None


class PlacementCreateSerializer(serializers.ModelSerializer):
    client_id = serializers.UUIDField()
    contractor_id = serializers.UUIDField()

    class Meta:
        model = Placement
        fields = [
            "client_id", "contractor_id", "title", "client_rate", "contractor_rate",
            "currency", "start_date", "end_date", "approval_flow",
            "require_timesheet_attachment", "client_can_view_invoices",
            "client_can_view_documents", "notes",
        ]

    def validate(self, data):
        if data.get("end_date") and data["end_date"] <= data["start_date"]:
            raise serializers.ValidationError({"end_date": "Must be after start_date"})
        return data

    def create(self, validated_data):
        return Placement.objects.create(status=Placement.Status.DRAFT, **validated_data)


class PlacementUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Placement
        fields = [
            "title", "client_rate", "contractor_rate", "currency", "client_id", "contractor_id",
            "start_date", "end_date", "approval_flow", "require_timesheet_attachment",
            "client_can_view_invoices", "client_can_view_documents", "notes",
        ]
        extra_kwargs = {f: {"required": False} for f in fields}

    def validate(self, data):
        inst = self.instance
        if inst.status == Placement.Status.ACTIVE:
            locked = Placement.LOCKED_FIELDS & set(data.keys())
            if locked:
                raise serializers.ValidationError({f: "Cannot change on ACTIVE placement" for f in locked})
        elif inst.status != Placement.Status.DRAFT:
            raise serializers.ValidationError("Cannot edit COMPLETED or CANCELLED placement")
        return data


class PlacementCopySerializer(serializers.Serializer):
    client_rate = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    contractor_rate = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    start_date = serializers.DateField(required=False)


class PlacementDocumentSerializer(serializers.ModelSerializer):
    uploaded_by = serializers.SerializerMethodField()

    class Meta:
        model = PlacementDocument
        fields = ["id", "file_name", "file_size_bytes", "mime_type", "label", "uploaded_by", "uploaded_at"]

    def get_uploaded_by(self, obj):
        return {"id": str(obj.uploaded_by_id), "full_name": obj.uploaded_by.full_name}


class PlacementDocumentFlatSerializer(serializers.ModelSerializer):
    """Document with placement context — for the flat /documents listing."""
    uploaded_by = serializers.SerializerMethodField()
    placement = serializers.SerializerMethodField()

    class Meta:
        model = PlacementDocument
        fields = ["id", "file_name", "file_size_bytes", "mime_type", "label", "uploaded_by", "uploaded_at", "placement"]

    def get_uploaded_by(self, obj):
        return {"id": str(obj.uploaded_by_id), "full_name": obj.uploaded_by.full_name}

    def get_placement(self, obj):
        p = obj.placement
        return {
            "id": str(p.id),
            "client": {"id": str(p.client_id), "company_name": p.client.company_name},
            "contractor": {"id": str(p.contractor_id), "full_name": p.contractor.full_name},
        }


class PlacementDocumentUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    label = serializers.CharField(required=False, default="")
