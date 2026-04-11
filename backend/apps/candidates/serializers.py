from rest_framework import serializers
from .models import Candidate, CandidateFile, CandidateActivity


class CandidateFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CandidateFile
        fields = ["id", "candidate_id", "activity_id", "original_filename", "file_type", "file_size", "uploaded_at"]


class CandidateActivitySerializer(serializers.ModelSerializer):
    files = CandidateFileSerializer(many=True, read_only=True)

    class Meta:
        model = CandidateActivity
        fields = ["id", "candidate_id", "type", "text", "old_value", "new_value", "client_name", "created_by", "created_at", "files"]


class CandidateListSerializer(serializers.ModelSerializer):
    cv_count = serializers.SerializerMethodField()
    activity_count = serializers.SerializerMethodField()

    class Meta:
        model = Candidate
        fields = [
            "id", "full_name", "email", "phone", "country", "status", "skills",
            "desired_rate", "desired_currency", "source", "linkedin_url", "contractor_id",
            "created_at", "updated_at", "cv_count", "activity_count",
        ]

    def get_cv_count(self, obj):
        return obj.files.filter(file_type="CV").count()

    def get_activity_count(self, obj):
        return obj.activities.count()


class CandidateDetailSerializer(serializers.ModelSerializer):
    files = CandidateFileSerializer(many=True, read_only=True)
    activities = CandidateActivitySerializer(many=True, read_only=True)

    class Meta:
        model = Candidate
        fields = [
            "id", "full_name", "email", "phone", "country", "status", "skills",
            "desired_rate", "desired_currency", "source", "linkedin_url", "notes", "contractor_id",
            "created_at", "updated_at", "files", "activities",
        ]


class CandidateCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Candidate
        fields = [
            "id", "full_name", "email", "phone", "country", "status", "skills",
            "desired_rate", "desired_currency", "source", "linkedin_url", "notes",
        ]
        read_only_fields = ["id"]

    def validate_email(self, value):
        if value and Candidate.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(f"Candidate with email {value} already exists.")
        return value


class CandidateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Candidate
        fields = [
            "full_name", "email", "phone", "country", "status", "skills",
            "desired_rate", "desired_currency", "source", "linkedin_url", "notes",
        ]

    def validate_email(self, value):
        if value and Candidate.objects.filter(email__iexact=value).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError(f"Candidate with email {value} already exists.")
        return value


class CandidateSearchResultSerializer(serializers.ModelSerializer):
    snippet = serializers.CharField(read_only=True)
    rank = serializers.FloatField(read_only=True)
    cv_count = serializers.SerializerMethodField()

    class Meta:
        model = Candidate
        fields = [
            "id", "full_name", "email", "country", "status", "skills",
            "desired_rate", "desired_currency", "source", "linkedin_url", "contractor_id",
            "created_at", "cv_count", "snippet", "rank",
        ]

    def get_cv_count(self, obj):
        return obj.files.filter(file_type="CV").count()
