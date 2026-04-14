import uuid
from django.db import models
from django.utils import timezone
from apps.users.exceptions import InvalidStateTransition


class Invoice(models.Model):
    class Type(models.TextChoices):
        CLIENT_INVOICE = "CLIENT_INVOICE"
        CONTRACTOR_INVOICE = "CONTRACTOR_INVOICE"

    class Status(models.TextChoices):
        DRAFT = "DRAFT"
        ISSUED = "ISSUED"
        PAID = "PAID"
        VOIDED = "VOIDED"
        CORRECTED = "CORRECTED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice_number = models.CharField(max_length=50, unique=True)
    invoice_type = models.CharField(max_length=20, choices=Type.choices)
    is_manual = models.BooleanField(default=False)
    candidate_id = models.UUIDField(null=True, blank=True)
    timesheet = models.ForeignKey("timesheets.Timesheet", on_delete=models.CASCADE, related_name="invoices", null=True, blank=True)
    placement = models.ForeignKey("placements.Placement", on_delete=models.CASCADE, related_name="invoices", null=True, blank=True)
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="invoices", null=True, blank=True)
    contractor = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name="contractor_invoices", null=True, blank=True)
    year = models.IntegerField(null=True, blank=True)
    month = models.IntegerField(null=True, blank=True)
    currency = models.CharField(max_length=3)
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    total_hours = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    vat_rate_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    vat_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    issue_date = models.DateField()
    due_date = models.DateField(null=True, blank=True)
    payment_date = models.DateField(null=True, blank=True)
    payment_reference = models.CharField(max_length=255, blank=True, default="")
    payment_terms_days = models.IntegerField(null=True, blank=True)
    billing_snapshot = models.JSONField(default=dict)
    generated_by = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name="generated_invoices")
    pdf_file = models.FileField(upload_to="invoices/", null=True, blank=True)
    issued_at = models.DateTimeField(null=True, blank=True)
    is_locked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "invoices"

    def __str__(self):
        return self.invoice_number

    def issue(self):
        if self.status != self.Status.DRAFT:
            raise InvalidStateTransition("Can only issue from DRAFT status")
        self.status = self.Status.ISSUED
        self.issued_at = timezone.now()
        self.save()

    def mark_paid(self, payment_date, payment_reference=""):
        if self.status != self.Status.ISSUED:
            raise InvalidStateTransition("Can only mark paid from ISSUED status")
        self.status = self.Status.PAID
        self.payment_date = payment_date
        self.payment_reference = payment_reference
        self.save()

    def void(self):
        if self.status not in (self.Status.ISSUED, self.Status.PAID):
            raise InvalidStateTransition("Can only void from ISSUED or PAID status")
        self.status = self.Status.VOIDED
        self.save()

    def mark_corrected(self):
        if self.status != self.Status.ISSUED:
            raise InvalidStateTransition("Can only correct from ISSUED status")
        self.status = self.Status.CORRECTED
        self.save()


class InvoiceLineItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="line_items")
    display_order = models.IntegerField(default=0)
    description = models.TextField(blank=True, default="")
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    line_total = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        db_table = "invoice_line_items"
        ordering = ["display_order"]


class InvoiceNotification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="notifications")
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey("users.User", on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    text = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, blank=True, default="")
    visible_to_contractor = models.BooleanField(default=False)
    visible_to_client = models.BooleanField(default=False)

    class Meta:
        db_table = "invoice_notifications"
        ordering = ["-created_at"]


class InvoiceTemplate(models.Model):
    class Type(models.TextChoices):
        CONTRACTOR = "CONTRACTOR"
        CLIENT = "CLIENT"
        AGENCY = "AGENCY"

    class Status(models.TextChoices):
        DRAFT = "DRAFT"
        ACTIVE = "ACTIVE"
        ARCHIVED = "ARCHIVED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    code = models.CharField(max_length=50, blank=True, default="")
    template_type = models.CharField(max_length=20, choices=Type.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)

    contractor = models.ForeignKey("users.User", on_delete=models.CASCADE, null=True, blank=True, related_name="invoice_templates")
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, null=True, blank=True, related_name="invoice_templates")
    placement = models.ForeignKey("placements.Placement", on_delete=models.CASCADE, null=True, blank=True, related_name="invoice_templates")
    parent = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="children")

    company_name = models.CharField(max_length=255, blank=True, default="")
    registration_number = models.CharField(max_length=100, blank=True, default="")
    billing_address = models.TextField(blank=True, default="")
    country = models.CharField(max_length=100, blank=True, default="")
    default_currency = models.CharField(max_length=3, blank=True, default="")

    vat_registered = models.BooleanField(null=True)
    vat_number = models.CharField(max_length=100, blank=True, default="")
    vat_rate_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    bank_name = models.CharField(max_length=255, blank=True, default="")
    bank_account_iban = models.CharField(max_length=50, blank=True, default="")
    bank_swift_bic = models.CharField(max_length=20, blank=True, default="")

    invoice_series_prefix = models.CharField(max_length=100, blank=True, default="")
    next_invoice_number = models.IntegerField(null=True, blank=True)
    counters = models.JSONField(default=dict, blank=True)

    payment_terms_days = models.IntegerField(null=True, blank=True)

    is_default = models.BooleanField(default=False)
    is_locked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "invoice_templates"
        constraints = [
            models.UniqueConstraint(
                fields=["contractor", "template_type"],
                condition=models.Q(is_default=True, status="ACTIVE"),
                name="unique_default_active_per_contractor_type",
            ),
        ]

    def __str__(self):
        return f"{self.title} ({self.template_type})"


class InvoiceCorrectionLink(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    original_invoice = models.OneToOneField(Invoice, on_delete=models.CASCADE, related_name="correction_link")
    corrective_invoice = models.OneToOneField(Invoice, on_delete=models.CASCADE, related_name="corrects")
    reason = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "invoice_correction_links"
