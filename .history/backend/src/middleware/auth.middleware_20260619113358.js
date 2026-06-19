import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      console.log('Token received:', token);

      // Validate token format before verification
      if (!token || token.trim() === '') {
        console.log('Token is empty');
        return res.status(401).json({ message: 'Not authorized, token is empty' });
      }

      // Check if token has valid JWT format (xxx.yyy.zzz)
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.log('Invalid token format:', token);
        return res.status(401).json({ message: 'Not authorized, invalid token format' });
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      console.log('Decoded token:', decoded);

      // Get user from the token
      const client = await pool.connect();
      try {
        const result = await client.query('SELECT id, email, name, role FROM users WHERE id = $1', [decoded.userId]);
        req.user = result.rows[0];
        console.log('User found:', req.user);

        if (!req.user) {
          console.log('User not found in database');
          return res.status(401).json({ message: 'Not authorized, user not found' });
        }

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