from django.db import connection
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([AllowAny])
def health(request):
    """Liveness check that also verifies the database connection."""
    with connection.cursor() as cursor:
        cursor.execute('SELECT version()')
        version = cursor.fetchone()[0]
    return Response({'status': 'ok', 'database': 'connected', 'postgres': version})
