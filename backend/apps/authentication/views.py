from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from drf_spectacular.utils import extend_schema
from .serializers import RefreshSerializer, LogoutSerializer, ChangePasswordSerializer


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]

    @extend_schema(tags=["Auth"])
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class RefreshView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(request=RefreshSerializer, tags=["Auth"])
    def post(self, request):
        ser = RefreshSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            refresh = RefreshToken(ser.validated_data["refresh_token"])
            return Response({
                "access_token": str(refresh.access_token),
                "refresh_token": str(refresh),
                "expires_in": 900,
            })
        except TokenError:
            return Response(
                {"error": {"code": "UNAUTHORIZED", "message": "Invalid or expired refresh token", "details": []}},
                status=status.HTTP_401_UNAUTHORIZED,
            )


class LogoutView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(request=LogoutSerializer, tags=["Auth"])
    def post(self, request):
        ser = LogoutSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            RefreshToken(ser.validated_data["refresh_token"]).blacklist()
        except Exception:
            pass
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=ChangePasswordSerializer, tags=["Auth"])
    def post(self, request):
        ser = ChangePasswordSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        if not request.user.check_password(ser.validated_data["current_password"]):
            return Response(
                {"error": {"code": "UNAUTHORIZED", "message": "Wrong current password", "details": []}},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        request.user.set_password(ser.validated_data["new_password"])
        request.user.save()
        return Response(status=status.HTTP_204_NO_CONTENT)
