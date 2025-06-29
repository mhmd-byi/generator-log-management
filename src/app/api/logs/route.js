import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/db';
import Log from '../../../models/Log';
import { requireAuth } from '../../../lib/auth';

export async function GET(request) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 50;
    const page = parseInt(searchParams.get('page')) || 1;
    const skip = (page - 1) * limit;

    // Build query based on user role
    let query = {};
    
    if (user.role !== 'admin') {
      // Regular users can only see logs from their assigned venue
      if (!user.assignedVenue) {
        return NextResponse.json(
          { error: 'No venue assigned to user' },
          { status: 403 }
        );
      }
      query.venue = user.assignedVenue;
    }

    // Apply filters if provided
    const gensetId = searchParams.get('genset');
    if (gensetId && gensetId !== 'all') {
      query.genset = gensetId;
    }

    const venueId = searchParams.get('venue');
    if (venueId && venueId !== 'all' && user.role === 'admin') {
      query.venue = venueId;
    }

    const userId = searchParams.get('user');
    if (userId && userId !== 'all') {
      query.user = userId;
    }

    const action = searchParams.get('action');
    if (action && action !== 'all') {
      query.action = action;
    }

    const logs = await Log.find(query)
      .populate('genset', 'name model serialNumber')
      .populate('venue', 'name')
      .populate('user', 'username email')
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Log.countDocuments(query);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get logs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 