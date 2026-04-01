from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from drf_spectacular.utils import extend_schema
from .models import AuditLog
from .serializers import AuditLogSerializer
from apps.timesheets.models import Timesheet
from apps.timesheets.views import _check_ts_read


class TimesheetAuditLogView(APIView):
    @extend_schema(tags=["Timesheets"])
    def get(self, request, pk=None):
        ts = Timesheet.objects.select_related("placement__client", "placement__contractor").get(pk=pk)
        _check_ts_read(request.user, ts)
        qs = AuditLog.objects.filter(
            entity_type="timesheet", entity_id=pk
        ).select_related("created_by")
        user = request.user
        if user.is_contractor:
            qs = qs.filter(visible_to_contractor=True)
        elif user.is_client_contact:
            qs = qs.filter(visible_to_client=True)
        return Response({"data": AuditLogSerializer(qs, many=True).data})
