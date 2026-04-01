import uuid
from django.db import models


class ContractorProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=4, unique=True, blank=True, default="")
    user = models.OneToOneField("users.User", on_delete=models.CASCADE, related_name="contractor_profile")
    company_name = models.CharField(max_length=255, blank=True, default="")
    registration_number = models.CharField(max_length=100, blank=True, default="")
    vat_registered = models.BooleanField(default=False)
    vat_number = models.CharField(max_length=100, blank=True, default="")
    vat_rate_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    invoice_series_prefix = models.CharField(max_length=100, blank=True, default="")
    next_invoice_number = models.IntegerField(default=1)
    counters = models.JSONField(default=dict, blank=True)
    bank_name = models.CharField(max_length=255, blank=True, default="")
    bank_account_iban = models.CharField(max_length=50, blank=True, default="")
    bank_swift_bic = models.CharField(max_length=20, blank=True, default="")
    payment_terms_days = models.IntegerField(null=True, blank=True)
    billing_address = models.TextField(blank=True, default="")
    country = models.CharField(max_length=100, default="")
    default_currency = models.CharField(max_length=3, default="EUR")

    class Meta:
        db_table = "contractor_profiles"

    def save(self, *args, **kwargs):
        if not self.code:
            from apps.users.codegen import generate_code
            name = self.user.full_name if self.user_id else "XXXX"
            self.code = generate_code(name, ContractorProfile, exclude_id=self.pk)
        self.code = self.code.upper()[:4]
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Profile: {self.user.full_name}"
