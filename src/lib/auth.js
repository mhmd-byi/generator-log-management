import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import dbConnect from './db';
import User from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export async function getAuthUser(request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.cookies.get('token')?.value;

    if (!token) {
      return null;
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return null;
    }

    await dbConnect();
    const user = await User.findById(decoded.userId).select('-password');
    return user;
  } catch (error) {
    return null;
  }
}

export async function requireAuth(request, requiredRole = null) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (requiredRole && user.role !== requiredRole) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  return user;
}

export async function requireAdmin(request) {
  const user = await requireAuth(request, 'admin');
  if (user instanceof NextResponse) {
    return user; // Return error response
  }
  return user;
} 