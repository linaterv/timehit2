import uuid
from django.db import models


class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    entity_type = models.CharField(max_length=50, db_index=True)
    entity_id = models.UUIDField(db_index=True)
    action = models.CharField(max_length=50)
    title = models.CharField(max_length=255)
    text = models.TextField(blank=True, default="")
    data_before = models.JSONField(null=True, blank=True)
    data_after = models.JSONField(null=True, blank=True)
    created_by = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    visible_to_contractor = models.BooleanField(default=True)
    visible_to_client = models.BooleanField(default=True)

    class Meta:
        db_table = "audit_logs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["entity_type", "entity_id", "-created_at"]),
        ]
