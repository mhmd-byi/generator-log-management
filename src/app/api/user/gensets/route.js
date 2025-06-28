import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/db';
import Genset from '../../../../models/Genset';
import { requireAuth } from '../../../../lib/auth';

export async function GET(request) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;

    await dbConnect();

    // Regular users can only see gensets from their assigned venue
    if (user.role !== 'admin' && !user.assignedVenue) {
      return NextResponse.json(
        { error: 'No venue assigned to user' },
        { status: 403 }
      );
    }

    const query = user.role === 'admin' 
      ? { isActive: true }
      : { venue: user.assignedVenue, isActive: true };

    const gensets = await Genset.find(query)
      .populate('venue', 'name location')
      .populate('lastStatusChangedBy', 'username')
      .sort({ name: 1 });

    return NextResponse.json({ gensets });
  } catch (error) {
    console.error('Get user gensets error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 