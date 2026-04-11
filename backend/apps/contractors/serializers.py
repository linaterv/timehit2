from rest_framework import serializers
from .models import ContractorProfile


class ContractorProfileListSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(source="user.id")
    email = serializers.EmailField(source="user.email")
    full_name = serializers.CharField(source="user.full_name")
    is_active = serializers.BooleanField(source="user.is_active")
    placement_summary = serializers.SerializerMethodField()

    class Meta:
        model = ContractorProfile
        fields = [
            "id", "code", "user_id", "email", "full_name", "company_name",
            "country", "default_currency", "vat_registered", "is_active",
            "placement_summary",
        ]

    def get_placement_summary(self, obj):
        placements = list(obj.user.placements.select_related("client").all())
        active = [p for p in placements if p.status == "ACTIVE"]
        inactive = [p for p in placements if p.status != "ACTIVE"]
        # 2 most recent active, prefer ones with title
        recent = sorted(active, key=lambda p: (not p.title, -p.start_date.toordinal()))[:2]
        labels = []
        for p in recent:
            label = f"{p.client.company_name} → {p.title}" if p.title else p.client.company_name
            labels.append(label)
        return {
            "recent_active": labels,
            "active_count": len(active),
            "inactive_count": len(inactive),
        }


class ContractorProfileDetailSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(source="user.id")
    email = serializers.EmailField(source="user.email")
    full_name = serializers.CharField(source="user.full_name")

    class Meta:
        model = ContractorProfile
        fields = [
            "id", "code", "user_id", "email", "full_name", "company_name",
            "registration_number", "vat_registered", "vat_number", "vat_rate_percent",
            "invoice_series_prefix", "next_invoice_number", "bank_name",
            "bank_account_iban", "bank_swift_bic", "payment_terms_days",
            "billing_address", "country", "default_currency", "candidate_id",
        ]


class ContractorProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContractorProfile
        fields = [
            "code", "company_name", "registration_number", "vat_registered", "vat_number",
            "vat_rate_percent", "invoice_series_prefix", "next_invoice_number",
            "bank_name", "bank_account_iban", "bank_swift_bic", "payment_terms_days",
            "billing_address", "country", "default_currency",
        ]
        extra_kwargs = {f: {"required": False} for f in fields}

    def validate_code(self, value):
        if not value:
            return value
        value = value.upper()[:4]
        from apps.users.codegen import suggest_code, _is_blocked
        if _is_blocked(value):
            suggested = suggest_code(value, ContractorProfile, exclude_id=self.instance.pk if self.instance else None)
            raise serializers.ValidationError(f"Code '{value}' is not allowed. Suggested: {suggested}")
        qs = ContractorProfile.objects.filter(code=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            suggested = suggest_code(value, ContractorProfile, exclude_id=self.instance.pk if self.instance else None)
            raise serializers.ValidationError(f"Code '{value}' is already taken. Suggested: {suggested}")
        return value

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
