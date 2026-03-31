import uuid
from django.db import models


class Client(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company_name = models.CharField(max_length=255)
    registration_number = models.CharField(max_length=100, blank=True, default="")
    vat_number = models.CharField(max_length=100, blank=True, default="")
    billing_address = models.TextField(blank=True, default="")
    country = models.CharField(max_length=100)
    default_currency = models.CharField(max_length=3, default="EUR")
    payment_terms_days = models.IntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "clients"

    def __str__(self):
        return self.company_name


class ClientContact(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField("users.User", on_delete=models.CASCADE, related_name="client_contact")
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="contacts")
    job_title = models.CharField(max_length=255, blank=True, default="")
    phone = models.CharField(max_length=50, blank=True, default="")
    is_primary = models.BooleanField(default=False)

    class Meta:
        db_table = "client_contacts"


class BrokerClientAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    broker = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name="broker_assignments")
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="broker_assignments")
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "broker_client_assignments"
        unique_together = [("broker", "client")]
