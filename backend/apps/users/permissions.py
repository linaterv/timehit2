from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_admin


class IsAdminOrBroker(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ("ADMIN", "BROKER")


def has_broker_access_to_client(user, client_id):
    if user.is_admin:
        return True
    if user.is_broker:
        return user.broker_assignments.filter(client_id=client_id).exists()
    return False
