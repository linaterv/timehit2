from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["email"] = user.email
        token["role"] = user.role
        token["is_active"] = user.is_active
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        return {
            "access_token": data["access"],
            "refresh_token": data["refresh"],
            "expires_in": 900,
            "user": {
                "id": str(self.user.id),
                "email": self.user.email,
                "full_name": self.user.full_name,
                "role": self.user.role,
            },
        }


class RefreshSerializer(serializers.Serializer):
    refresh_token = serializers.CharField()


class LogoutSerializer(serializers.Serializer):
    refresh_token = serializers.CharField()


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField()
    new_password = serializers.CharField(min_length=1)
