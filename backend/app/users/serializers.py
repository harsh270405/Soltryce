from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import CustomUser


class UserSerializer(serializers.ModelSerializer):
    is_admin = serializers.BooleanField(source='is_platform_admin', read_only=True)

    class Meta:
        model = CustomUser
        fields = ('id', 'username', 'email', 'display_name', 'first_name', 'last_name', 'department', 'role', 'clearance_level', 'is_active', 'date_joined', 'is_admin')
        read_only_fields = ('id', 'role', 'is_active', 'date_joined', 'is_admin')


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, validators=[validate_password])

    class Meta:
        model = CustomUser
        fields = ('username', 'email', 'password', 'display_name', 'first_name', 'last_name', 'department')

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = CustomUser(**validated_data, role='student')
        user.set_password(password)
        user.save()
        return user


class PlatformTokenSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['is_admin'] = user.is_platform_admin
        return token

    def validate(self, attrs):
        try:
            data = super().validate(attrs)
        except AuthenticationFailed:
            # Keep this response stable and avoid revealing whether a username exists.
            raise AuthenticationFailed('Invalid username or password.')
        data['user'] = UserSerializer(self.user).data
        return data


class AdminUserSerializer(UserSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8, validators=[validate_password])

    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + ('password',)
        read_only_fields = ('id', 'date_joined', 'is_admin')

    def validate_role(self, value):
        valid_roles = {role for role, _ in CustomUser.ROLE_CHOICES}
        if value not in valid_roles:
            raise serializers.ValidationError('Choose student, staff, or admin.')
        return value

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        if not password:
            raise serializers.ValidationError({'password': 'A password is required when creating an account.'})
        return CustomUser.objects.create_user(password=password, **validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save(update_fields=['password'])
        return user
