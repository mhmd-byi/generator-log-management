import { NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/db';
import Genset from '../../../../../models/Genset';
import Log from '../../../../../models/Log';
import { requireAuth } from '../../../../../lib/auth';

export async function POST(request, { params }) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;

    await dbConnect();
    
    const { id } = params;
    const genset = await Genset.findById(id).populate('venue');

    if (!genset) {
      return NextResponse.json(
        { error: 'Generator not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to toggle this genset
    if (user.role !== 'admin') {
      if (!user.assignedVenue || genset.venue._id.toString() !== user.assignedVenue.toString()) {
        return NextResponse.json(
          { error: 'Access denied. Generator not in your assigned venue.' },
          { status: 403 }
        );
      }
    }

    // Safety check: Prevent turning ON generators without active venue
    const previousStatus = genset.status;
    const newStatus = genset.status === 'ON' ? 'OFF' : 'ON';
    
    if (newStatus === 'ON') {
      // Check if generator has a venue assigned
      if (!genset.venue) {
        return NextResponse.json(
          { 
            error: 'Cannot turn on generator: No venue assigned. Please assign this generator to an active venue before operation.',
            code: 'NO_VENUE_ASSIGNED'
          },
          { status: 400 }
        );
      }
      
      // Check if the assigned venue is active
      if (!genset.venue.isActive) {
        return NextResponse.json(
          { 
            error: `Cannot turn on generator: Venue "${genset.venue.name}" has been deactivated. Generator cannot be operated without an active venue.`,
            code: 'VENUE_INACTIVE'
          },
          { status: 400 }
        );
      }
    }
    
    genset.status = newStatus;
    genset.lastStatusChangedBy = user._id;
    genset.lastStatusChange = new Date();
    
    await genset.save();

    // Create log entry
    await Log.create({
      genset: genset._id,
      venue: genset.venue?._id || null,
      user: user._id,
      action: newStatus === 'ON' ? 'TURN_ON' : 'TURN_OFF',
      previousStatus,
      newStatus,
      notes: `Generator ${newStatus === 'ON' ? 'turned on' : 'turned off'} by ${user.username}`
    });

    // Populate user info for response
    await genset.populate('lastStatusChangedBy', 'username');

    return NextResponse.json({
      message: `Generator ${newStatus === 'ON' ? 'turned on' : 'turned off'} successfully`,
      genset,
      previousStatus,
      newStatus
    });
  } catch (error) {
    console.error('Toggle genset error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 