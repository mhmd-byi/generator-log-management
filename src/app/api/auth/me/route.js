import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import Venue from '../../../../models/Venue';

export async function GET(request) {
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Populate venue information if user has assigned venue
    if (user.assignedVenue) {
      await user.populate('assignedVenue');
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 