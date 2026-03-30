import uuid
from django.db import models
from django.utils import timezone
from apps.users.exceptions import InvalidStateTransition


class Timesheet(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT"
        SUBMITTED = "SUBMITTED"
        CLIENT_APPROVED = "CLIENT_APPROVED"
        APPROVED = "APPROVED"
        REJECTED = "REJECTED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    placement = models.ForeignKey("placements.Placement", on_delete=models.CASCADE, related_name="timesheets")
    year = models.IntegerField()
    month = models.IntegerField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    total_hours = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        "users.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="approved_timesheets"
    )
    rejected_at = models.DateTimeField(null=True, blank=True)
    rejected_by = models.ForeignKey(
        "users.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="rejected_timesheets"
    )
    rejection_reason = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "timesheets"
        unique_together = [("placement", "year", "month")]

    def recalculate_hours(self):
        self.total_hours = self.entries.aggregate(total=models.Sum("hours"))["total"] or 0
        self.save(update_fields=["total_hours"])

    def submit(self, confirm_zero=False):
        if self.status != self.Status.DRAFT:
            raise InvalidStateTransition("Can only submit from DRAFT status")
        if not confirm_zero and not self.entries.exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"entries": "No entries. Set confirm_zero=true to submit empty."})
        if self.placement.require_timesheet_attachment and not self.attachments.exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"attachments": "At least one attachment is required."})
        self.status = self.Status.SUBMITTED
        self.submitted_at = timezone.now()
        self.rejection_reason = ""
        self.save()

    def client_approve(self, user):
        from apps.placements.models import Placement
        if self.placement.approval_flow != Placement.ApprovalFlow.CLIENT_THEN_BROKER:
            raise InvalidStateTransition("Client approval not applicable for BROKER_ONLY flow")
        if self.status != self.Status.SUBMITTED:
            raise InvalidStateTransition("Can only client-approve from SUBMITTED status")
        self.status = self.Status.CLIENT_APPROVED
        self.save()

    def approve(self, user):
        from apps.placements.models import Placement
        valid = [self.Status.CLIENT_APPROVED] if self.placement.approval_flow == Placement.ApprovalFlow.CLIENT_THEN_BROKER else [self.Status.SUBMITTED]
        if self.status not in valid:
            raise InvalidStateTransition(f"Can only approve from {' or '.join(valid)} status")
        self.status = self.Status.APPROVED
        self.approved_at = timezone.now()
        self.approved_by = user
        self.save()

    def reject(self, user, reason):
        if self.status not in (self.Status.SUBMITTED, self.Status.CLIENT_APPROVED):
            raise InvalidStateTransition("Can only reject from SUBMITTED or CLIENT_APPROVED status")
        self.status = self.Status.DRAFT
        self.rejected_at = timezone.now()
        self.rejected_by = user
        self.rejection_reason = reason
        self.submitted_at = None
        self.approved_at = None
        self.approved_by = None
        self.save()


def timesheet_attachment_path(instance, filename):
    return f"timesheets/{instance.timesheet_id}/{filename}"


class TimesheetEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timesheet = models.ForeignKey(Timesheet, on_delete=models.CASCADE, related_name="entries")
    date = models.DateField()
    hours = models.DecimalField(max_digits=4, decimal_places=2)
    task_name = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")

    class Meta:
        db_table = "timesheet_entries"


class TimesheetAttachment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timesheet = models.ForeignKey(Timesheet, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to=timesheet_attachment_path)
    file_name = models.CharField(max_length=255)
    file_size_bytes = models.IntegerField()
    mime_type = models.CharField(max_length=100)
    uploaded_by = models.ForeignKey("users.User", on_delete=models.CASCADE)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "timesheet_attachments"
