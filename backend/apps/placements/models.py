import uuid
from django.db import models
from apps.users.exceptions import InvalidStateTransition


class Placement(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT"
        ACTIVE = "ACTIVE"
        COMPLETED = "COMPLETED"
        CANCELLED = "CANCELLED"

    class ApprovalFlow(models.TextChoices):
        BROKER_ONLY = "BROKER_ONLY"
        CLIENT_THEN_BROKER = "CLIENT_THEN_BROKER"

    LOCKED_FIELDS = {"client_rate", "contractor_rate", "currency", "client_id", "contractor_id"}

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="placements")
    contractor = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name="placements")
    title = models.CharField(max_length=255, blank=True, default="")
    client_rate = models.DecimalField(max_digits=10, decimal_places=2)
    contractor_rate = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="EUR")
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    approval_flow = models.CharField(max_length=20, choices=ApprovalFlow.choices, default=ApprovalFlow.BROKER_ONLY)
    require_timesheet_attachment = models.BooleanField(default=False)
    client_can_view_invoices = models.BooleanField(default=False)
    client_can_view_documents = models.BooleanField(default=False)
    payment_terms_client_days = models.IntegerField(null=True, blank=True)
    payment_terms_contractor_days = models.IntegerField(null=True, blank=True)
    client_invoice_template = models.ForeignKey(
        "invoices.InvoiceTemplate", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="placements_as_client_template",
    )
    notes = models.TextField(blank=True, default="")
    is_locked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "placements"

    def __str__(self):
        return f"{self.contractor.full_name} @ {self.client.company_name}"

    def activate(self):
        if self.status != self.Status.DRAFT:
            raise InvalidStateTransition("Can only activate from DRAFT status")
        self.status = self.Status.ACTIVE
        self.save()

    def complete(self):
        if self.status != self.Status.ACTIVE:
            raise InvalidStateTransition("Can only complete from ACTIVE status")
        warnings = self._check_open_timesheets()
        self.status = self.Status.COMPLETED
        self.save()
        return warnings

    def cancel(self):
        if self.status != self.Status.ACTIVE:
            raise InvalidStateTransition("Can only cancel from ACTIVE status")
        warnings = self._check_open_timesheets()
        self.status = self.Status.CANCELLED
        self.save()
        return warnings

    def _check_open_timesheets(self):
        open_count = self.timesheets.exclude(status__in=["APPROVED", "REJECTED"]).count()
        return [f"{open_count} timesheet(s) in non-terminal state"] if open_count else []


def placement_document_path(instance, filename):
    return f"placements/{instance.placement_id}/{filename}"


class PlacementDocument(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    placement = models.ForeignKey(Placement, on_delete=models.CASCADE, related_name="documents")
    file = models.FileField(upload_to=placement_document_path)
    file_name = models.CharField(max_length=255)
    file_size_bytes = models.IntegerField()
    mime_type = models.CharField(max_length=100)
    label = models.CharField(max_length=100, blank=True, default="")
    uploaded_by = models.ForeignKey("users.User", on_delete=models.CASCADE)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    visible_to_client = models.BooleanField(default=False)
    visible_to_contractor = models.BooleanField(default=False)

    class Meta:
        db_table = "placement_documents"
