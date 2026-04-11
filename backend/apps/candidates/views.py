from django.db.models import Q
from django.http import FileResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, NotFound
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from drf_spectacular.utils import extend_schema

from apps.users.permissions import IsAdminOrBroker
from .models import Candidate, CandidateFile, CandidateActivity
from .serializers import (
    CandidateListSerializer, CandidateDetailSerializer,
    CandidateCreateSerializer, CandidateUpdateSerializer,
    CandidateFileSerializer, CandidateActivitySerializer,
    CandidateSearchResultSerializer,
)
from .fts import rebuild_fts, search_candidates, delete_fts
from .pdf import extract_text, extract_text_from_bytes, parse_cv
from apps.audit.service import log_audit


class CandidateViewSet(viewsets.ModelViewSet):
    queryset = Candidate.objects.all()
    permission_classes = [IsAdminOrBroker]
    http_method_names = ["get", "post", "patch", "delete"]

    def get_serializer_class(self):
        if self.action == "list":
            return CandidateListSerializer
        if self.action == "create":
            return CandidateCreateSerializer
        if self.action == "partial_update":
            return CandidateUpdateSerializer
        if self.action == "search":
            return CandidateSearchResultSerializer
        return CandidateDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        if p.get("country"):
            qs = qs.filter(country=p["country"])
        if p.get("source"):
            qs = qs.filter(source__icontains=p["source"])
        if p.get("search"):
            q = p["search"]
            qs = qs.filter(Q(full_name__icontains=q) | Q(email__icontains=q) | Q(skills__icontains=q))
        if p.get("has_cv") == "true":
            qs = qs.filter(files__file_type="CV").distinct()
        if p.get("contractor_linked") == "true":
            qs = qs.exclude(contractor_id="")
        elif p.get("contractor_linked") == "false":
            qs = qs.filter(contractor_id="")
        sort = p.get("sort", "created_at")
        order = p.get("order", "desc")
        prefix = "-" if order == "desc" else ""
        allowed = {"full_name", "created_at", "status", "country"}
        if sort in allowed:
            qs = qs.order_by(f"{prefix}{sort}")
        return qs

    @extend_schema(tags=["Candidates"])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(tags=["Candidates"])
    def create(self, request, *args, **kwargs):
        resp = super().create(request, *args, **kwargs)
        if resp.status_code == 201:
            candidate = Candidate.objects.get(pk=resp.data["id"])
            rebuild_fts(candidate)
            log_audit(entity_type="candidate", entity_id=candidate.id, action="CREATED",
                      title=f"Candidate {candidate.full_name} created", user=request.user,
                      data_after={"full_name": candidate.full_name, "email": candidate.email, "status": candidate.status})
        return resp

    @extend_schema(tags=["Candidates"])
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @extend_schema(tags=["Candidates"])
    def partial_update(self, request, *args, **kwargs):
        obj = self.get_object()
        old_status = obj.status
        before = {"full_name": obj.full_name, "email": obj.email, "status": obj.status, "skills": obj.skills, "country": obj.country}
        resp = super().partial_update(request, *args, **kwargs)
        obj.refresh_from_db()
        after = {"full_name": obj.full_name, "email": obj.email, "status": obj.status, "skills": obj.skills, "country": obj.country}
        if old_status != obj.status:
            CandidateActivity.objects.create(
                candidate=obj, type=CandidateActivity.Type.STATUS_CHANGE,
                text=f"Status changed from {old_status} to {obj.status}",
                old_value=old_status, new_value=obj.status,
                created_by=request.user.full_name,
            )
        if before != after:
            log_audit(entity_type="candidate", entity_id=obj.id, action="UPDATED",
                      title=f"Candidate {obj.full_name} updated", user=request.user,
                      data_before=before, data_after=after)
        rebuild_fts(obj)
        return resp

    @extend_schema(tags=["Candidates"])
    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        old_status = obj.status
        obj.status = Candidate.Status.ARCHIVED
        obj.save(update_fields=["status"])
        CandidateActivity.objects.create(
            candidate=obj, type=CandidateActivity.Type.STATUS_CHANGE,
            text=f"Status changed from {old_status} to ARCHIVED",
            old_value=old_status, new_value="ARCHIVED",
            created_by=request.user.full_name,
        )
        log_audit(entity_type="candidate", entity_id=obj.id, action="ARCHIVED",
                  title=f"Candidate {obj.full_name} archived", user=request.user,
                  data_before={"status": old_status}, data_after={"status": "ARCHIVED"})
        rebuild_fts(obj)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(tags=["Candidates"])
    @action(detail=False, methods=["get"])
    def search(self, request):
        q = request.query_params.get("q", "").strip()
        if not q:
            return Response({"data": [], "meta": {"total": 0, "query": ""}})
        limit = int(request.query_params.get("limit", 25))
        results = search_candidates(q, limit)
        ids = [r[0] for r in results]
        snippets = {r[0]: r[1] for r in results}
        ranks = {r[0]: r[2] for r in results}
        candidates = Candidate.objects.filter(pk__in=ids)
        cand_map = {str(c.id): c for c in candidates}
        ordered = []
        for cid in ids:
            c = cand_map.get(cid)
            if c:
                c.snippet = snippets.get(cid, "")
                c.rank = ranks.get(cid, 0)
                ordered.append(c)
        serializer = CandidateSearchResultSerializer(ordered, many=True)
        return Response({"data": serializer.data, "meta": {"total": len(ordered), "query": q}})


class CandidateFileViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrBroker]
    serializer_class = CandidateFileSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    http_method_names = ["get", "post", "delete"]

    def get_queryset(self):
        qs = CandidateFile.objects.filter(candidate_id=self.kwargs["candidate_pk"])
        ft = self.request.query_params.get("type")
        if ft:
            qs = qs.filter(file_type=ft)
        return qs

    def _get_candidate(self):
        try:
            return Candidate.objects.get(pk=self.kwargs["candidate_pk"])
        except Candidate.DoesNotExist:
            raise NotFound("Candidate not found")

    @extend_schema(tags=["Candidates"])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(tags=["Candidates"])
    def create(self, request, *args, **kwargs):
        candidate = self._get_candidate()
        file_type = request.data.get("file_type", "CV")
        activity_id = request.data.get("activity_id")
        uploaded_files = request.FILES.getlist("file") or request.FILES.getlist("files")
        if not uploaded_files:
            return Response({"error": "No files provided"}, status=400)

        created = []
        for f in uploaded_files:
            cf = CandidateFile.objects.create(
                candidate=candidate,
                activity_id=activity_id if activity_id else None,
                file=f,
                original_filename=f.name,
                file_type=file_type,
                file_size=f.size,
            )
            text = extract_text(cf.file.path)
            if text:
                cf.extracted_text = text
                cf.save(update_fields=["extracted_text"])
            if file_type == "CV":
                CandidateActivity.objects.create(
                    candidate=candidate, type=CandidateActivity.Type.CV_UPLOADED,
                    text=f"Uploaded {f.name}",
                    created_by=request.user.full_name,
                )
            created.append(cf)

        rebuild_fts(candidate)
        fnames = [c.original_filename for c in created]
        log_audit(entity_type="candidate", entity_id=candidate.id, action="FILE_UPLOADED",
                  title=f"File uploaded for {candidate.full_name}", user=request.user,
                  data_after={"files": fnames, "file_type": file_type})
        return Response(CandidateFileSerializer(created, many=True).data, status=201)

    @extend_schema(tags=["Candidates"])
    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        candidate = obj.candidate
        fname = obj.original_filename
        ftype = obj.file_type
        obj.file.delete(save=False)
        obj.delete()
        log_audit(entity_type="candidate", entity_id=candidate.id, action="FILE_DELETED",
                  title=f"File removed from {candidate.full_name}", user=request.user,
                  data_before={"filename": fname, "file_type": ftype})
        if ftype == "CV":
            CandidateActivity.objects.create(
                candidate=candidate, type=CandidateActivity.Type.CV_REMOVED,
                text=f"Removed {fname}",
                created_by=request.user.full_name,
            )
        rebuild_fts(candidate)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(tags=["Candidates"])
    @action(detail=True, methods=["get"])
    def download(self, request, candidate_pk=None, pk=None):
        obj = self.get_object()
        return FileResponse(obj.file.open("rb"), as_attachment=True, filename=obj.original_filename)


class CandidateActivityViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrBroker]
    serializer_class = CandidateActivitySerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    http_method_names = ["get", "post"]

    def get_queryset(self):
        return CandidateActivity.objects.filter(
            candidate_id=self.kwargs["candidate_pk"]
        ).prefetch_related("files")

    @extend_schema(tags=["Candidates"])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(tags=["Candidates"])
    def create(self, request, *args, **kwargs):
        try:
            candidate = Candidate.objects.get(pk=self.kwargs["candidate_pk"])
        except Candidate.DoesNotExist:
            raise NotFound("Candidate not found")

        activity = CandidateActivity.objects.create(
            candidate=candidate,
            type=request.data.get("type", "NOTE"),
            text=request.data.get("text", ""),
            client_name=request.data.get("client_name", ""),
            created_by=request.user.full_name,
        )

        uploaded_files = request.FILES.getlist("file") or request.FILES.getlist("files")
        for f in uploaded_files:
            cf = CandidateFile.objects.create(
                candidate=candidate, activity=activity,
                file=f, original_filename=f.name,
                file_type="ATTACHMENT", file_size=f.size,
            )
            text = extract_text(cf.file.path)
            if text:
                cf.extracted_text = text
                cf.save(update_fields=["extracted_text"])

        rebuild_fts(candidate)
        activity.refresh_from_db()
        log_audit(entity_type="candidate", entity_id=candidate.id, action="ACTIVITY_ADDED",
                  title=f"Activity added for {candidate.full_name}", user=request.user,
                  data_after={"type": activity.type, "text": activity.text[:200]})
        return Response(CandidateActivitySerializer(activity).data, status=201)


class ParseCvView(APIView):
    permission_classes = [IsAdminOrBroker]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(tags=["Candidates"])
    def post(self, request):
        f = request.FILES.get("file")
        if not f:
            return Response({"error": "No file provided"}, status=400)
        data = f.read()
        text = extract_text_from_bytes(data)
        parsed = parse_cv(text)
        return Response(parsed)


class ContractorLinkView(APIView):
    permission_classes = [IsAdminOrBroker]

    @extend_schema(tags=["Candidates"])
    def post(self, request, candidate_pk=None):
        try:
            candidate = Candidate.objects.get(pk=candidate_pk)
        except Candidate.DoesNotExist:
            raise NotFound("Candidate not found")
        contractor_id = request.data.get("contractor_id")
        if not contractor_id:
            return Response({"error": "contractor_id required"}, status=400)

        # Set on candidates DB
        candidate.contractor_id = contractor_id
        candidate.save(update_fields=["contractor_id"])

        # Set on main DB
        from apps.contractors.models import ContractorProfile
        try:
            profile = ContractorProfile.objects.get(user_id=contractor_id)
            profile.candidate_id = str(candidate.id)
            profile.save(update_fields=["candidate_id"])
        except ContractorProfile.DoesNotExist:
            pass

        CandidateActivity.objects.create(
            candidate=candidate, type=CandidateActivity.Type.LINKED,
            text=f"Linked to contractor {contractor_id}",
            created_by=request.user.full_name,
        )
        log_audit(entity_type="candidate", entity_id=candidate.id, action="CONTRACTOR_LINKED",
                  title=f"Candidate {candidate.full_name} linked to contractor", user=request.user,
                  data_after={"contractor_id": contractor_id})
        rebuild_fts(candidate)
        return Response({"status": "linked"})

    @extend_schema(tags=["Candidates"])
    def delete(self, request, candidate_pk=None):
        try:
            candidate = Candidate.objects.get(pk=candidate_pk)
        except Candidate.DoesNotExist:
            raise NotFound("Candidate not found")

        old_contractor_id = candidate.contractor_id
        candidate.contractor_id = ""
        candidate.save(update_fields=["contractor_id"])

        if old_contractor_id:
            from apps.contractors.models import ContractorProfile
            try:
                profile = ContractorProfile.objects.get(user_id=old_contractor_id)
                profile.candidate_id = ""
                profile.save(update_fields=["candidate_id"])
            except ContractorProfile.DoesNotExist:
                pass

        CandidateActivity.objects.create(
            candidate=candidate, type=CandidateActivity.Type.UNLINKED,
            text=f"Unlinked from contractor {old_contractor_id}",
            created_by=request.user.full_name,
        )
        log_audit(entity_type="candidate", entity_id=candidate.id, action="CONTRACTOR_UNLINKED",
                  title=f"Candidate {candidate.full_name} unlinked from contractor", user=request.user,
                  data_before={"contractor_id": old_contractor_id})
        rebuild_fts(candidate)
        return Response(status=status.HTTP_204_NO_CONTENT)
