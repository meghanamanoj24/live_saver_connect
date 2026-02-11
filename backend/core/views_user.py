
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .serializers import UserPublicSerializer

class ManageUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserPublicSerializer(request.user)
        print(f"DEBUG: ManageUserView - Sending user data: {serializer.data}")
        return Response(serializer.data)
