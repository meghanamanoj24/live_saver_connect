
import logging

logger = logging.getLogger(__name__)

class AuthDebugMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        auth_header = request.headers.get('Authorization', 'MISSING')
        user = request.user
        
        # Log before request processing
        print(f"DEBUG_REQ: {request.method} {request.path} | Auth: {auth_header[:20]}... | User: {user}")
        
        response = self.get_response(request)
        
        # Log after request processing
        print(f"DEBUG_RES: {request.method} {request.path} | Status: {response.status_code} | User: {request.user}")
        
        if response.status_code in [401, 403]:
            print(f"DEBUG_FAIL: {request.method} {request.path} | Full Auth: {auth_header}")
            
        return response
