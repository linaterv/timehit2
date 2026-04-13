import uuid
from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver


def candidate_file_path(instance, filename):
    return f"candidates/{instance.candidate_id}/{filename}"


class Candidate(models.Model):
    class Status(models.TextChoices):
        AVAILABLE = "AVAILABLE"
        PROPOSED = "PROPOSED"
        INTERVIEW = "INTERVIEW"
        OFFERED = "OFFERED"
        PLACED = "PLACED"
        UNAVAILABLE = "UNAVAILABLE"
        ARCHIVED = "ARCHIVED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name = models.CharField(max_length=255)
    email = models.CharField(max_length=255, blank=True, default="")
    phone = models.CharField(max_length=50, blank=True, default="")
    country = models.CharField(max_length=100, default="LT")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.AVAILABLE)
    skills = models.TextField(blank=True, default="")
    desired_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    desired_currency = models.CharField(max_length=3, default="EUR")
    source = models.CharField(max_length=100, blank=True, default="")
    linkedin_url = models.URLField(max_length=500, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    contractor_id = models.CharField(max_length=36, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "candidates"
        db_table = "candidates"
        ordering = ["-created_at"]

    def __str__(self):
        return self.full_name


class CandidateActivity(models.Model):
    class Type(models.TextChoices):
        NOTE = "NOTE"
        STATUS_CHANGE = "STATUS_CHANGE"
        CV_UPLOADED = "CV_UPLOADED"
        CV_REMOVED = "CV_REMOVED"
        FILE_ATTACHED = "FILE_ATTACHED"
        LINKED = "LINKED"
        UNLINKED = "UNLINKED"
        PROPOSED = "PROPOSED"
        REJECTED = "REJECTED"
        INTERVIEW = "INTERVIEW"
        OFFER = "OFFER"
        PLACED = "PLACED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name="activities")
    type = models.CharField(max_length=20, choices=Type.choices)
    text = models.TextField(blank=True, default="")
    old_value = models.CharField(max_length=50, blank=True, default="")
    new_value = models.CharField(max_length=50, blank=True, default="")
    client_name = models.CharField(max_length=255, blank=True, default="")
    created_by = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "candidates"
        db_table = "candidate_activities"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.type}: {self.text[:50]}"


class CandidateFile(models.Model):
    class FileType(models.TextChoices):
        CV = "CV"
        ATTACHMENT = "ATTACHMENT"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name="files")
    activity = models.ForeignKey(CandidateActivity, on_delete=models.SET_NULL, null=True, blank=True, related_name="files")
    file = models.FileField(upload_to=candidate_file_path)
    original_filename = models.CharField(max_length=255)
    file_type = models.CharField(max_length=20, choices=FileType.choices, default=FileType.CV)
    extracted_text = models.TextField(blank=True, default="")
    file_size = models.IntegerField(default=0)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "candidates"
        db_table = "candidate_files"
        ordering = ["-uploaded_at"]

    def __str__(self):
        return self.original_filename


@receiver(post_delete, sender=Candidate)
def _candidate_post_delete(sender, instance, **kwargs):
    from .fts import delete_fts
    delete_fts(instance.id)
