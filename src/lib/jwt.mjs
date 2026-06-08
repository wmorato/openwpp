import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'openwpp-dev-secret-2026';
const JWT_EXPIRES_IN = '1h';
const REFRESH_EXPIRES_IN = '7d';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function signRefreshToken(payload) {
  return jwt.sign(payload, JWT_SECRET + '-refresh', { expiresIn: REFRESH_EXPIRES_IN });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, JWT_SECRET + '-refresh');
}

export function authMiddleware(handler) {
  return async (req, context) => {
    try {
      const authHeader = req.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const token = authHeader.slice(7);
      const payload = verifyToken(token);
      req.user = payload;
      return handler(req, context);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}
