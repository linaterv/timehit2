from rest_framework import serializers
from .models import User


class UserListSerializer(serializers.ModelSerializer):
    current_placement = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "role", "is_active", "created_at", "current_placement"]

    def get_current_placement(self, obj):
        if obj.role not in (User.Role.CONTRACTOR, User.Role.CLIENT_CONTACT):
            return None
        if obj.role == User.Role.CONTRACTOR:
            qs = obj.placements.select_related("client")
        else:
            # CLIENT_CONTACT: find placements via their client
            try:
                client = obj.client_contact.client
            except Exception:
                return None
            from apps.placements.models import Placement
            qs = Placement.objects.filter(client=client).select_related("client")
        from django.db.models import Case, When, Value, IntegerField
        placement = qs.annotate(
            status_rank=Case(
                When(status="ACTIVE", then=Value(0)),
                When(status="COMPLETED", then=Value(1)),
                default=Value(2),
                output_field=IntegerField(),
            ),
            has_title=Case(
                When(title="", then=Value(1)),
                default=Value(0),
                output_field=IntegerField(),
            ),
        ).order_by("has_title", "status_rank", "-start_date").first()
        if not placement:
            return None
        return {
            "id": str(placement.id),
            "label": f"{placement.client.company_name} → {placement.title}" if placement.title else placement.client.company_name,
            "status": placement.status,
        }


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
            from apps.invoices.models import InvoiceTemplate
            # Find global LT contractor template to use as parent and copy series
            global_tpl = InvoiceTemplate.objects.filter(
                template_type=InvoiceTemplate.Type.CONTRACTOR,
                contractor__isnull=True, client__isnull=True,
            ).first()
            InvoiceTemplate.objects.create(
                title=f"{user.full_name} - Default",
                code="DEFAULT",
                template_type=InvoiceTemplate.Type.CONTRACTOR,
                status=InvoiceTemplate.Status.DRAFT,
                is_default=True,
                contractor=user,
                parent=global_tpl,
                company_name=user.full_name,
                billing_address=f"{user.full_name}\nAddress\nCity, Country",
                default_currency="EUR",
                invoice_series_prefix=global_tpl.invoice_series_prefix if global_tpl else "",
            )
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
