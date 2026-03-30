from rest_framework import serializers
from .models import ContractorProfile


class ContractorProfileListSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(source="user.id")
    email = serializers.EmailField(source="user.email")
    full_name = serializers.CharField(source="user.full_name")
    is_active = serializers.BooleanField(source="user.is_active")
    current_placement = serializers.SerializerMethodField()

    class Meta:
        model = ContractorProfile
        fields = [
            "id", "user_id", "email", "full_name", "company_name",
            "country", "default_currency", "vat_registered", "is_active",
            "current_placement",
        ]

    def get_current_placement(self, obj):
        from django.db.models import Case, When, Value, IntegerField
        qs = obj.user.placements.select_related("client").annotate(
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
        ).order_by("has_title", "status_rank", "-start_date")
        placement = qs.first()
        if not placement:
            return None
        return {
            "id": str(placement.id),
            "label": f"{placement.client.company_name} → {placement.title}" if placement.title else placement.client.company_name,
            "status": placement.status,
            "end_date": str(placement.end_date) if placement.end_date else None,
        }


class ContractorProfileDetailSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(source="user.id")
    email = serializers.EmailField(source="user.email")
    full_name = serializers.CharField(source="user.full_name")

    class Meta:
        model = ContractorProfile
        fields = [
            "id", "user_id", "email", "full_name", "company_name",
            "registration_number", "vat_registered", "vat_number", "vat_rate_percent",
            "invoice_series_prefix", "next_invoice_number", "bank_name",
            "bank_account_iban", "bank_swift_bic", "payment_terms_days",
            "billing_address", "country", "default_currency",
        ]


class ContractorProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContractorProfile
        fields = [
            "company_name", "registration_number", "vat_registered", "vat_number",
            "vat_rate_percent", "invoice_series_prefix", "next_invoice_number",
            "bank_name", "bank_account_iban", "bank_swift_bic", "payment_terms_days",
            "billing_address", "country", "default_currency",
        ]
        extra_kwargs = {f: {"required": False} for f in fields}

    def validate(self, data):
        inst = self.instance
        vat_reg = data.get("vat_registered", inst.vat_registered if inst else False)
        if vat_reg:
            if not data.get("vat_number", inst.vat_number if inst else ""):
                raise serializers.ValidationError({"vat_number": "Required when VAT registered"})
            if data.get("vat_rate_percent") is None and (inst is None or inst.vat_rate_percent is None):
                raise serializers.ValidationError({"vat_rate_percent": "Required when VAT registered"})
        if "next_invoice_number" in data and inst and data["next_invoice_number"] < inst.next_invoice_number:
            raise serializers.ValidationError({"next_invoice_number": "Cannot decrease invoice number"})
        return data
