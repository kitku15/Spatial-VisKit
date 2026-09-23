// middleware.js
export const config = {
  matcher: '/:path*',
};

export default function middleware(request) {
  const url = new URL(request.url);

  // 1. Bypass assets and internal Vite files
  if (
    url.pathname.includes('.') || 
    url.pathname.startsWith('/@') || 
    url.pathname.startsWith('/src') ||
    url.pathname.startsWith('/node_modules') ||
    request.headers.get('upgrade') === 'websocket'
  ) {
    return; 
  }

  // 2. Check Password securely using process.env
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const [scheme, encoded] = authHeader.split(' ');
    if (scheme === 'Basic') {
      const decoded = atob(encoded);
      const [user, password] = decoded.split(':');
      
      // Pulls securely from Vercel's cloud variables
      if (
        user === (process.env.SITE_USERNAME || 'admin') &&
        password === process.env.SITE_PASSWORD
      ) {
        return; // Success! Let them in.
      }
    }
  }

  // 3. Show native browser login prompt
  return new Response('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Protected Spatial Viewer"' },
  });
}