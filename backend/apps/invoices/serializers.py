from rest_framework import serializers
from .models import Invoice, InvoiceNotification, InvoiceTemplate


class InvoiceNotificationSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()

    class Meta:
        model = InvoiceNotification
        fields = ["id", "created_at", "created_by", "title", "text", "status", "visible_to_contractor", "visible_to_client"]

    def get_created_by(self, obj):
        return {"id": str(obj.created_by_id), "full_name": obj.created_by.full_name}


def _can_see_invoice_financials(context):
    request = context.get("request")
    if not request or not request.user:
        return False
    return request.user.role in ("ADMIN", "BROKER")


class InvoiceListSerializer(serializers.ModelSerializer):
    client = serializers.SerializerMethodField()
    contractor = serializers.SerializerMethodField()
    generated_by = serializers.SerializerMethodField()
    placement_title = serializers.SerializerMethodField()
    hourly_rate = serializers.SerializerMethodField()
    total_hours = serializers.SerializerMethodField()
    subtotal = serializers.SerializerMethodField()
    vat_rate_percent = serializers.SerializerMethodField()
    vat_amount = serializers.SerializerMethodField()
    total_amount = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            "id", "invoice_number", "invoice_type", "client", "contractor",
            "placement_id", "placement_title", "year", "month", "currency", "hourly_rate",
            "total_hours", "subtotal", "vat_rate_percent", "vat_amount",
            "total_amount", "status", "issue_date", "due_date", "payment_date",
            "payment_reference", "generated_by", "created_at",
        ]

    def _user_ref(self, user):
        return {"id": str(user.id), "full_name": user.full_name}

    def get_placement_title(self, obj):
        return obj.placement.title if obj.placement else ""

    def get_client(self, obj):
        return {"id": str(obj.client_id), "company_name": obj.client.company_name}

    def get_contractor(self, obj):
        return {"id": str(obj.contractor_id), "full_name": obj.contractor.full_name}

    def get_generated_by(self, obj):
        return self._user_ref(obj.generated_by)

    def get_hourly_rate(self, obj):
        return str(obj.hourly_rate) if _can_see_invoice_financials(self.context) else None

    def get_total_hours(self, obj):
        return str(obj.total_hours) if _can_see_invoice_financials(self.context) else None

    def get_subtotal(self, obj):
        return str(obj.subtotal) if _can_see_invoice_financials(self.context) else None

    def get_vat_rate_percent(self, obj):
        return str(obj.vat_rate_percent) if _can_see_invoice_financials(self.context) and obj.vat_rate_percent else None

    def get_vat_amount(self, obj):
        return str(obj.vat_amount) if _can_see_invoice_financials(self.context) and obj.vat_amount else None

    def get_total_amount(self, obj):
        return str(obj.total_amount) if _can_see_invoice_financials(self.context) else None


class InvoiceDetailSerializer(InvoiceListSerializer):
    correction_link = serializers.SerializerMethodField()

    class Meta(InvoiceListSerializer.Meta):
        fields = InvoiceListSerializer.Meta.fields + ["timesheet_id", "billing_snapshot", "correction_link"]

    def get_correction_link(self, obj):
        try:
            link = obj.correction_link
            return {"corrective_invoice_id": str(link.corrective_invoice_id), "reason": link.reason}
        except Exception:
            return None


class InvoiceTemplateListSerializer(serializers.ModelSerializer):
    contractor = serializers.SerializerMethodField()
    client = serializers.SerializerMethodField()

    class Meta:
        model = InvoiceTemplate
        fields = [
            "id", "title", "code", "template_type", "status", "is_default",
            "contractor", "client", "placement_id", "parent_id",
            "company_name", "country", "default_currency",
            "billing_address", "bank_name", "vat_rate_percent",
            "invoice_series_prefix", "created_at", "updated_at",
        ]

    def get_contractor(self, obj):
        if obj.contractor:
            return {"id": str(obj.contractor_id), "full_name": obj.contractor.full_name}
        return None

    def get_client(self, obj):
        if obj.client:
            return {"id": str(obj.client_id), "company_name": obj.client.company_name}
        return None


class InvoiceTemplateDetailSerializer(InvoiceTemplateListSerializer):
    class Meta(InvoiceTemplateListSerializer.Meta):
        fields = InvoiceTemplateListSerializer.Meta.fields + [
            "registration_number", "billing_address",
            "vat_registered", "vat_number", "vat_rate_percent",
            "bank_name", "bank_account_iban", "bank_swift_bic",
            "next_invoice_number", "payment_terms_days",
        ]


class InvoiceTemplateCreateSerializer(serializers.ModelSerializer):
    contractor_id = serializers.UUIDField(required=False, allow_null=True)
    client_id = serializers.UUIDField(required=False, allow_null=True)
    placement_id = serializers.UUIDField(required=False, allow_null=True)
    parent_id = serializers.UUIDField(required=False, allow_null=True)

    class Meta:
        model = InvoiceTemplate
        fields = [
            "title", "code", "template_type", "contractor_id", "client_id",
            "placement_id", "parent_id", "is_default",
            "company_name", "registration_number", "billing_address",
            "country", "default_currency",
            "vat_registered", "vat_number", "vat_rate_percent",
            "bank_name", "bank_account_iban", "bank_swift_bic",
            "invoice_series_prefix", "next_invoice_number",
            "payment_terms_days",
        ]

    def validate(self, data):
        if data.get("placement_id"):
            from apps.placements.models import Placement
            try:
                pl = Placement.objects.get(pk=data["placement_id"])
            except Placement.DoesNotExist:
                raise serializers.ValidationError({"placement_id": "Placement not found"})
            if data.get("contractor_id") and str(pl.contractor_id) != str(data["contractor_id"]):
                raise serializers.ValidationError({"placement_id": "Placement contractor does not match"})
            if data.get("client_id") and str(pl.client_id) != str(data["client_id"]):
                raise serializers.ValidationError({"placement_id": "Placement client does not match"})
        return data


class InvoiceTemplateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceTemplate
        fields = [
            "title", "code", "is_default",
            "company_name", "registration_number", "billing_address",
            "country", "default_currency",
            "vat_registered", "vat_number", "vat_rate_percent",
            "bank_name", "bank_account_iban", "bank_swift_bic",
            "invoice_series_prefix", "next_invoice_number",
            "payment_terms_days",
        ]
        extra_kwargs = {f: {"required": False} for f in fields}

    def validate_next_invoice_number(self, value):
        if self.instance and value is not None and self.instance.next_invoice_number is not None:
            if value < self.instance.next_invoice_number:
                raise serializers.ValidationError("Cannot decrease invoice number")
        return value


class GenerateInvoicesSerializer(serializers.Serializer):
    timesheet_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1)
    auto_issue = serializers.BooleanField(required=False, default=False)


class MarkPaidSerializer(serializers.Serializer):
    payment_date = serializers.DateField()
    payment_reference = serializers.CharField(required=False, default="")


class VoidSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, default="", allow_blank=True)


class CorrectSerializer(serializers.Serializer):
    hourly_rate = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    total_hours = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    vat_rate_percent = serializers.DecimalField(max_digits=5, decimal_places=2, required=False)
    reason = serializers.CharField(required=False, default="")
