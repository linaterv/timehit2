import uuid
from django.db import migrations, models
import django.db.models.deletion
import apps.candidates.models


class Migration(migrations.Migration):
    initial = True
    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Candidate",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("full_name", models.CharField(max_length=255)),
                ("email", models.CharField(blank=True, default="", max_length=255)),
                ("phone", models.CharField(blank=True, default="", max_length=50)),
                ("country", models.CharField(default="LT", max_length=100)),
                ("status", models.CharField(choices=[("AVAILABLE", "Available"), ("PROPOSED", "Proposed"), ("INTERVIEW", "Interview"), ("OFFERED", "Offered"), ("PLACED", "Placed"), ("UNAVAILABLE", "Unavailable"), ("ARCHIVED", "Archived")], default="AVAILABLE", max_length=20)),
                ("skills", models.TextField(blank=True, default="")),
                ("desired_rate", models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ("desired_currency", models.CharField(default="EUR", max_length=3)),
                ("source", models.CharField(blank=True, default="", max_length=100)),
                ("notes", models.TextField(blank=True, default="")),
                ("contractor_id", models.CharField(blank=True, default="", max_length=36)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"db_table": "candidates", "ordering": ["-created_at"], "app_label": "candidates"},
        ),
        migrations.CreateModel(
            name="CandidateActivity",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("type", models.CharField(choices=[("NOTE", "Note"), ("STATUS_CHANGE", "Status Change"), ("CV_UPLOADED", "Cv Uploaded"), ("CV_REMOVED", "Cv Removed"), ("FILE_ATTACHED", "File Attached"), ("LINKED", "Linked"), ("UNLINKED", "Unlinked"), ("PROPOSED", "Proposed"), ("REJECTED", "Rejected"), ("INTERVIEW", "Interview"), ("OFFER", "Offer"), ("PLACED", "Placed")], max_length=20)),
                ("text", models.TextField(blank=True, default="")),
                ("old_value", models.CharField(blank=True, default="", max_length=50)),
                ("new_value", models.CharField(blank=True, default="", max_length=50)),
                ("client_name", models.CharField(blank=True, default="", max_length=255)),
                ("created_by", models.CharField(blank=True, default="", max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("candidate", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="activities", to="candidates.candidate")),
            ],
            options={"db_table": "candidate_activities", "ordering": ["-created_at"], "app_label": "candidates"},
        ),
        migrations.CreateModel(
            name="CandidateFile",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("file", models.FileField(upload_to=apps.candidates.models.candidate_file_path)),
                ("original_filename", models.CharField(max_length=255)),
                ("file_type", models.CharField(choices=[("CV", "Cv"), ("ATTACHMENT", "Attachment")], default="CV", max_length=20)),
                ("extracted_text", models.TextField(blank=True, default="")),
                ("file_size", models.IntegerField(default=0)),
                ("uploaded_at", models.DateTimeField(auto_now_add=True)),
                ("candidate", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="files", to="candidates.candidate")),
                ("activity", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="files", to="candidates.candidateactivity")),
            ],
            options={"db_table": "candidate_files", "ordering": ["-uploaded_at"], "app_label": "candidates"},
        ),
        migrations.RunSQL(
            sql="""
            CREATE VIRTUAL TABLE IF NOT EXISTS candidates_fts USING fts5(
                candidate_id UNINDEXED,
                content,
                tokenize='porter unicode61'
            );
            """,
            reverse_sql="DROP TABLE IF EXISTS candidates_fts;",
        ),
    ]
