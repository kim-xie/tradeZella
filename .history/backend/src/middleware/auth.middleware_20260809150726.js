import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

const INACTIVITY_TIMEOUT = 60 * 60; // 1 hour in seconds
const JWT_EXPIRES_IN = '7d';
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      console.log('Token received:', token);

      if (!token || token.trim() === '') {
        console.log('Token is empty');
        return res.status(401).json({ message: 'Not authorized, token is empty' });
      }

      const parts = token.split('.');
      if (parts.length !== 3) {
        console.log('Invalid token format:', token);
        return res.status(401).json({ message: 'Not authorized, invalid token format' });
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('Decoded token:', decoded);

      // Sliding expiration: check inactivity timeout
      const now = Math.floor(Date.now() / 1000);
      const lastActivity = decoded.lastActivity || decoded.iat;
      if (now - lastActivity > INACTIVITY_TIMEOUT) {
        console.log('Token expired due to inactivity');
        return res.status(401).json({ message: 'Session expired due to inactivity' });
      }

      const client = await pool.connect();
      try {
        const result = await client.query('SELECT id, email, name, role FROM users WHERE id = $1', [decoded.userId]);
        req.user = result.rows[0];
        console.log('User found:', req.user);

        if (!req.user) {
          console.log('User not found in database');
          return res.status(401).json({ message: 'Not authorized, user not found' });
        }

        // Issue a new token with updated lastActivity (sliding expiration)
        const newToken = jwt.sign(
          { userId: decoded.userId, lastActivity: now },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );
        res.setHeader('X-New-Token', newToken);
        console.log('Issued new token with updated lastActivity');

        next();
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    console.log('No token provided');
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};