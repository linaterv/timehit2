from rest_framework import serializers
from .models import User


class UserListSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "full_name", "role", "is_active", "created_at"]


class UserDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "full_name", "role", "is_active", "created_at", "updated_at"]


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=1)
    client_id = serializers.UUIDField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = ["email", "full_name", "password", "role", "client_id"]

    def validate(self, data):
        if data.get("role") == User.Role.CLIENT_CONTACT and not data.get("client_id"):
            raise serializers.ValidationError({"client_id": "Required for CLIENT_CONTACT role"})
        return data

    def create(self, validated_data):
        client_id = validated_data.pop("client_id", None)
        password = validated_data.pop("password")
        user = User.objects.create_user(password=password, **validated_data)
        if user.role == User.Role.CONTRACTOR:
            from apps.contractors.models import ContractorProfile
            ContractorProfile.objects.create(user=user)
        if user.role == User.Role.CLIENT_CONTACT and client_id:
            from apps.clients.models import ClientContact
            ClientContact.objects.create(user=user, client_id=client_id)
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["full_name", "email", "is_active", "theme"]
        extra_kwargs = {f: {"required": False} for f in fields}


class UserMeSerializer(serializers.ModelSerializer):
    contractor_profile = serializers.SerializerMethodField()
    client_contact = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "role", "is_active", "theme", "contractor_profile", "client_contact"]

    def get_contractor_profile(self, obj):
        if obj.role != User.Role.CONTRACTOR:
            return None
        from apps.contractors.serializers import ContractorProfileDetailSerializer
        try:
            return ContractorProfileDetailSerializer(obj.contractor_profile).data
        except Exception:
            return None

    def get_client_contact(self, obj):
        if obj.role != User.Role.CLIENT_CONTACT:
            return None
        from apps.clients.serializers import ClientContactSerializer
        try:
            return ClientContactSerializer(obj.client_contact).data
        except Exception:
            return None
