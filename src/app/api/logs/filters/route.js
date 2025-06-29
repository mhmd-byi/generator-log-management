import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/db';
import Venue from '../../../../models/Venue';
import Genset from '../../../../models/Genset';
import User from '../../../../models/User';
import Log from '../../../../models/Log';
import { requireAuth } from '../../../../lib/auth';

export async function GET(request) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;

    await dbConnect();

    const isAdmin = user.role === 'admin';

    // Get venues
    let venues = [];
    if (isAdmin) {
      venues = await Venue.find({ isActive: true }).select('_id name').sort('name');
    } else if (user.assignedVenue) {
      venues = await Venue.find({ _id: user.assignedVenue, isActive: true }).select('_id name');
    }

    // Get gensets based on user role
    let gensetQuery = { isActive: true };
    if (!isAdmin && user.assignedVenue) {
      gensetQuery.venue = user.assignedVenue;
    }
    const gensets = await Genset.find(gensetQuery)
      .select('_id name')
      .populate('venue', 'name')
      .sort('name');

    // Get users (admin only)
    let users = [];
    if (isAdmin) {
      users = await User.find({ isActive: true }).select('_id username').sort('username');
    }

    // Get distinct actions from logs
    const actions = await Log.distinct('action');

    return NextResponse.json({
      venues: venues.map(venue => ({ _id: venue._id, name: venue.name })),
      gensets: gensets.map(genset => ({
        _id: genset._id,
        name: genset.name,
        venueName: genset.venue?.name || 'No Venue'
      })),
      users: users.map(u => ({ _id: u._id, username: u.username })),
      actions: actions.sort()
    });

  } catch (error) {
    console.error('Get log filters error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 