import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/db';
import Log from '../../../models/Log';
import Genset from '../../../models/Genset';
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
              .populate('genset', 'name model')
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

export async function POST(request) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;

    // Only admins can create manual log entries
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Only administrators can create manual log entries.' },
        { status: 403 }
      );
    }

    await dbConnect();
    
    const data = await request.json();
    const { gensetId, action, notes, customTimestamp } = data;

    // Validate required fields
    if (!gensetId || !action || !notes) {
      return NextResponse.json(
        { error: 'Generator, action, and notes are required' },
        { status: 400 }
      );
    }

    // Find the genset and get venue info
    const genset = await Genset.findById(gensetId).populate('venue');
    if (!genset) {
      return NextResponse.json(
        { error: 'Generator not found' },
        { status: 404 }
      );
    }

    // Admin-only check already performed above, so no additional venue restrictions needed

    // Create manual log entry
    const logData = {
      genset: gensetId,
      venue: genset.venue._id,
      user: user._id,
      action: action === 'MANUAL' ? 'MANUAL' : action,
      notes: notes.trim(),
    };

    // Add timestamp if provided
    if (customTimestamp) {
      logData.timestamp = new Date(customTimestamp);
    }

    // For status-related actions, record current status
    if (['TURN_ON', 'TURN_OFF'].includes(action)) {
      logData.previousStatus = genset.status;
      logData.newStatus = genset.status; // Manual entry doesn't change actual status
    } else if (action === 'MANUAL') {
      // For pure manual entries, record current status as context
      logData.newStatus = genset.status;
    }

    const log = await Log.create(logData);
    
    // Populate the created log for response
    await log.populate([
      { path: 'genset', select: 'name model' },
      { path: 'venue', select: 'name' },
      { path: 'user', select: 'username email' }
    ]);

    return NextResponse.json({
      message: 'Manual log entry created successfully',
      log
    }, { status: 201 });

  } catch (error) {
    console.error('Create manual log error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}