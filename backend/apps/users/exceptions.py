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
