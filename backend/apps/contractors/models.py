import uuid
from django.db import models


class ContractorProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField("users.User", on_delete=models.CASCADE, related_name="contractor_profile")
    company_name = models.CharField(max_length=255, blank=True, default="")
    registration_number = models.CharField(max_length=100, blank=True, default="")
    vat_registered = models.BooleanField(default=False)
    vat_number = models.CharField(max_length=100, blank=True, default="")
    vat_rate_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    invoice_series_prefix = models.CharField(max_length=50, blank=True, default="")
    next_invoice_number = models.IntegerField(default=1)
    bank_name = models.CharField(max_length=255, blank=True, default="")
    bank_account_iban = models.CharField(max_length=50, blank=True, default="")
    bank_swift_bic = models.CharField(max_length=20, blank=True, default="")
    payment_terms_days = models.IntegerField(null=True, blank=True)
    billing_address = models.TextField(blank=True, default="")
    country = models.CharField(max_length=100, default="")
    default_currency = models.CharField(max_length=3, default="EUR")

    class Meta:
        db_table = "contractor_profiles"

    def __str__(self):
        return f"Profile: {self.user.full_name}"
