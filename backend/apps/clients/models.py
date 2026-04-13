import uuid
from django.db import models


class Client(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=4, unique=True, blank=True, default="")
    company_name = models.CharField(max_length=255)
    registration_number = models.CharField(max_length=100, blank=True, default="")
    vat_number = models.CharField(max_length=100, blank=True, default="")
    billing_address = models.TextField(blank=True, default="")
    country = models.CharField(max_length=100)
    default_currency = models.CharField(max_length=3, default="EUR")
    payment_terms_days = models.IntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_locked = models.BooleanField(default=False)
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "clients"

    def save(self, *args, **kwargs):
        if not self.code:
            from apps.users.codegen import generate_code
            self.code = generate_code(self.company_name, Client, exclude_id=self.pk)
        self.code = self.code.upper()[:4]
        super().save(*args, **kwargs)

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


def client_file_path(instance, filename):
    return f"clients/{instance.client_id}/{filename}"


class ClientActivity(models.Model):
    class Type(models.TextChoices):
        NOTE = "NOTE"
        MEETING = "MEETING"
        CALL = "CALL"
        PROPOSAL_SENT = "PROPOSAL_SENT"
        CONTRACT_SIGNED = "CONTRACT_SIGNED"
        STATUS_CHANGE = "STATUS_CHANGE"
        FILE_UPLOADED = "FILE_UPLOADED"
        FILE_REMOVED = "FILE_REMOVED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="activities")
    type = models.CharField(max_length=20, choices=Type.choices)
    text = models.TextField(blank=True, default="")
    old_value = models.CharField(max_length=50, blank=True, default="")
    new_value = models.CharField(max_length=50, blank=True, default="")
    created_by = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "client_activities"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.type}: {self.text[:50]}"


class ClientFile(models.Model):
    class FileType(models.TextChoices):
        CONTRACT = "CONTRACT"
        PROPOSAL = "PROPOSAL"
        NDA = "NDA"
        OTHER = "OTHER"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="files")
    activity = models.ForeignKey(ClientActivity, on_delete=models.SET_NULL, null=True, blank=True, related_name="files")
    file = models.FileField(upload_to=client_file_path)
    original_filename = models.CharField(max_length=255)
    file_type = models.CharField(max_length=20, choices=FileType.choices, default=FileType.OTHER)
    file_size = models.IntegerField(default=0)
    uploaded_by = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "client_files"
        ordering = ["-uploaded_at"]

    def __str__(self):
        return self.original_filename
