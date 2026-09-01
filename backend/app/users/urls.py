from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .serializers import PlatformTokenSerializer
from .views import LogoutView, MeView, RegisterView, UserDetailView, UserListView
from rest_framework_simplejwt.views import TokenObtainPairView


class PlatformTokenObtainPairView(TokenObtainPairView):
    serializer_class = PlatformTokenSerializer


urlpatterns = [
    path('register/', RegisterView.as_view()),
    path('login/', PlatformTokenObtainPairView.as_view()),
    path('refresh/', TokenRefreshView.as_view()),
    path('logout/', LogoutView.as_view()),
    path('me/', MeView.as_view()),
    path('users/', UserListView.as_view()),
    path('users/<int:pk>/', UserDetailView.as_view()),
]
