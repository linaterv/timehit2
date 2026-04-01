from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()
    related = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id", "entity_type", "entity_id", "action", "title", "text",
            "data_before", "data_after", "created_by", "created_at", "related",
        ]

    def get_created_by(self, obj):
        if not obj.created_by:
            return None
        return {"id": str(obj.created_by_id), "full_name": obj.created_by.full_name}

    def get_related(self, obj):
        """Resolve related entities for linking."""
        items = []
        try:
            if obj.entity_type == "timesheet":
                from apps.timesheets.models import Timesheet
                ts = Timesheet.objects.select_related("placement__client", "placement__contractor").get(pk=obj.entity_id)
                items.append({"type": "placement", "id": str(ts.placement_id), "name": ts.placement.title or str(ts.placement_id)[:8]})
                items.append({"type": "client", "id": str(ts.placement.client_id), "name": ts.placement.client.company_name})
                items.append({"type": "contractor", "id": str(ts.placement.contractor.contractor_profile.id), "name": ts.placement.contractor.full_name})
            elif obj.entity_type == "placement":
                from apps.placements.models import Placement
                pl = Placement.objects.select_related("client", "contractor").get(pk=obj.entity_id)
                items.append({"type": "client", "id": str(pl.client_id), "name": pl.client.company_name})
                items.append({"type": "contractor", "id": str(pl.contractor.contractor_profile.id), "name": pl.contractor.full_name})
            elif obj.entity_type == "invoice":
                from apps.invoices.models import Invoice
                inv = Invoice.objects.select_related("placement__client", "contractor").get(pk=obj.entity_id)
                items.append({"type": "placement", "id": str(inv.placement_id), "name": inv.placement.title or str(inv.placement_id)[:8]})
                items.append({"type": "client", "id": str(inv.client_id), "name": inv.client.company_name})
                items.append({"type": "contractor", "id": str(inv.contractor.contractor_profile.id), "name": inv.contractor.full_name})
            elif obj.entity_type == "document":
                from apps.placements.models import PlacementDocument
                doc = PlacementDocument.objects.select_related("placement__client", "placement__contractor").filter(pk=obj.entity_id).first()
                if doc:
                    items.append({"type": "placement", "id": str(doc.placement_id), "name": doc.placement.title or str(doc.placement_id)[:8]})
                    items.append({"type": "client", "id": str(doc.placement.client_id), "name": doc.placement.client.company_name})
                    items.append({"type": "contractor", "id": str(doc.placement.contractor.contractor_profile.id), "name": doc.placement.contractor.full_name})
            elif obj.entity_type == "contractor":
                from apps.users.models import User
                u = User.objects.get(pk=obj.entity_id)
                items.append({"type": "contractor", "id": str(u.contractor_profile.id), "name": u.full_name})
        except Exception:
            pass
        return items
