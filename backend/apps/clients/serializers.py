from rest_framework import serializers
from .models import Client, ClientContact, BrokerClientAssignment


class BrokerAssignmentSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(source="broker.id")
    full_name = serializers.CharField(source="broker.full_name")

    class Meta:
        model = BrokerClientAssignment
        fields = ["user_id", "full_name", "assigned_at"]


class ClientListSerializer(serializers.ModelSerializer):
    brokers = BrokerAssignmentSerializer(source="broker_assignments", many=True, read_only=True)
    placement_summary = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = [
            "id", "code", "company_name", "registration_number", "vat_number",
            "billing_address", "country", "default_currency", "payment_terms_days",
            "is_active", "brokers", "placement_summary", "created_at",
        ]

    def get_placement_summary(self, obj):
        placements = obj.placements.select_related("contractor").all()
        active = [p for p in placements if p.status == "ACTIVE"]
        inactive = [p for p in placements if p.status != "ACTIVE"]
        recent = sorted(active, key=lambda p: p.start_date, reverse=True)[:2]
        labels = []
        for p in recent:
            label = f"{p.contractor.full_name} → {p.title}" if p.title else p.contractor.full_name
            labels.append(label)
        return {
            "recent_active": labels,
            "active_count": len(active),
            "inactive_count": len(inactive),
        }


class ClientDetailSerializer(ClientListSerializer):
    contact_count = serializers.IntegerField(source="contacts.count", read_only=True)

    class Meta(ClientListSerializer.Meta):
        fields = ClientListSerializer.Meta.fields + ["notes", "contact_count", "updated_at"]


class ClientCreateSerializer(serializers.ModelSerializer):
    broker_ids = serializers.ListField(child=serializers.UUIDField(), required=False, default=list)

    class Meta:
        model = Client
        fields = [
            "code", "company_name", "registration_number", "vat_number",
            "billing_address", "country", "default_currency", "payment_terms_days",
            "notes", "broker_ids",
        ]
        extra_kwargs = {
            "code": {"required": False, "allow_blank": True},
            "billing_address": {"required": False},
            "registration_number": {"required": False},
            "vat_number": {"required": False},
            "payment_terms_days": {"required": False},
            "default_currency": {"required": False},
            "notes": {"required": False},
        }

    def create(self, validated_data):
        broker_ids = validated_data.pop("broker_ids", [])
        client = Client.objects.create(**validated_data)
        user = self.context["request"].user
        if user.is_broker:
            broker_ids = list(set(broker_ids) | {user.id})
        if not broker_ids and user.is_broker:
            broker_ids = [user.id]
        for bid in broker_ids:
            BrokerClientAssignment.objects.create(broker_id=bid, client=client)
        return client


class ClientUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = [
            "code", "company_name", "registration_number", "vat_number",
            "billing_address", "country", "default_currency", "payment_terms_days",
            "is_active", "notes",
        ]
        extra_kwargs = {f: {"required": False} for f in fields}

    def validate_code(self, value):
        if not value:
            return value
        value = value.upper()[:4]
        from apps.users.codegen import suggest_code, _is_blocked
        if _is_blocked(value):
            suggested = suggest_code(value, Client, exclude_id=self.instance.pk if self.instance else None)
            raise serializers.ValidationError(f"Code '{value}' is not allowed. Suggested: {suggested}")
        qs = Client.objects.filter(code=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            suggested = suggest_code(value, Client, exclude_id=self.instance.pk if self.instance else None)
            raise serializers.ValidationError(f"Code '{value}' is already taken. Suggested: {suggested}")
        return value


class ClientContactSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(source="user.id", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    is_active = serializers.BooleanField(source="user.is_active", read_only=True)

    class Meta:
        model = ClientContact
        fields = ["id", "user_id", "email", "full_name", "job_title", "phone", "is_primary", "is_active"]


class ClientContactCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    full_name = serializers.CharField()
    password = serializers.CharField(min_length=1)
    job_title = serializers.CharField(required=False, default="")
    phone = serializers.CharField(required=False, default="")
    is_primary = serializers.BooleanField(required=False, default=False)


class ClientContactUpdateSerializer(serializers.Serializer):
    job_title = serializers.CharField(required=False)
    phone = serializers.CharField(required=False)
    is_primary = serializers.BooleanField(required=False)


class BrokerAssignSerializer(serializers.Serializer):
    broker_ids = serializers.ListField(child=serializers.UUIDField())
