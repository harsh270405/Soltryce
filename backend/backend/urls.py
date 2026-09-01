"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    
    path('api/v1/auth/', include('app.users.urls')),
    path('api/v1/requests/', include('app.approvals.urls', namespace='approvals')),
    path('api/v1/knowledge/', include('app.knowledge_rag.urls')),
    path('api/v1/services/', include('app.labs.urls', namespace='labs')),
    
    # Adds a 'Log in' button to the DRF browsable API for testing IsAuthenticated
    path('api-auth/', include('rest_framework.urls')),
]

# This is required to serve uploaded PDFs locally
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
