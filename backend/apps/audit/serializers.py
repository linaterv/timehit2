from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id", "entity_type", "entity_id", "action", "title", "text",
            "data_before", "data_after", "created_by", "created_at",
        ]

    def get_created_by(self, obj):
        if not obj.created_by:
            return None
        return {"id": str(obj.created_by_id), "full_name": obj.created_by.full_name}
