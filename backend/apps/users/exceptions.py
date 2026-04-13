from rest_framework.views import exception_handler
from rest_framework.exceptions import ValidationError, NotFound, PermissionDenied, NotAuthenticated
from rest_framework.response import Response
from rest_framework import status


class ConflictError(Exception):
    def __init__(self, message="Conflict"):
        self.message = message


class InvalidStateTransition(Exception):
    def __init__(self, message="Invalid state transition"):
        self.message = message


class LockedError(Exception):
    def __init__(self, message="This entity is locked and cannot be modified. Unlock it first."):
        self.message = message


def check_locked(obj):
    """Raise LockedError if obj.is_locked is True."""
    if getattr(obj, "is_locked", False):
        label = ""
        if hasattr(obj, "company_name"):
            label = obj.company_name
        elif hasattr(obj, "full_name"):
            label = obj.full_name
        elif hasattr(obj, "invoice_number"):
            label = obj.invoice_number
        elif hasattr(obj, "title"):
            label = obj.title
        raise LockedError(f"{label or 'Entity'} is locked. Unlock it first to make changes.")


def custom_exception_handler(exc, context):
    if isinstance(exc, InvalidStateTransition):
        return Response(
            {"error": {"code": "INVALID_STATE_TRANSITION", "message": exc.message, "details": []}},
            status=status.HTTP_409_CONFLICT,
        )
    if isinstance(exc, ConflictError):
        return Response(
            {"error": {"code": "CONFLICT", "message": exc.message, "details": []}},
            status=status.HTTP_409_CONFLICT,
        )
    if isinstance(exc, LockedError):
        return Response(
            {"error": {"code": "LOCKED", "message": exc.message, "details": []}},
            status=423,
        )

    response = exception_handler(exc, context)
    if response is None:
        return None

    if isinstance(exc, ValidationError):
        details = []
        if isinstance(exc.detail, dict):
            for field, messages in exc.detail.items():
                for msg in (messages if isinstance(messages, list) else [messages]):
                    details.append({"field": field, "message": str(msg)})
        elif isinstance(exc.detail, list):
            for msg in exc.detail:
                details.append({"field": "non_field_errors", "message": str(msg)})
        response.data = {"error": {"code": "VALIDATION_ERROR", "message": "Validation failed", "details": details}}
    elif isinstance(exc, NotFound):
        response.data = {"error": {"code": "NOT_FOUND", "message": str(exc.detail), "details": []}}
    elif isinstance(exc, PermissionDenied):
        response.data = {"error": {"code": "FORBIDDEN", "message": str(exc.detail), "details": []}}
    elif isinstance(exc, NotAuthenticated):
        response.data = {"error": {"code": "UNAUTHORIZED", "message": str(exc.detail), "details": []}}
    return response
