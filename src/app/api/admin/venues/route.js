import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/db';
import Venue from '../../../../models/Venue';
import { requireAdmin } from '../../../../lib/auth';

export async function GET(request) {
  try {
    const user = await requireAdmin(request);
    if (user instanceof NextResponse) return user;

    await dbConnect();
    const venues = await Venue.find({ isActive: true })
      .populate('createdBy', 'username email')
      .sort({ createdAt: -1 });

    return NextResponse.json({ venues });
  } catch (error) {
    console.error('Get venues error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const user = await requireAdmin(request);
    if (user instanceof NextResponse) return user;

    await dbConnect();
    const data = await request.json();

    const { name, location, description, contactPerson } = data;

    if (!name || !location) {
      return NextResponse.json(
        { error: 'Name and location are required' },
        { status: 400 }
      );
    }

    const venue = new Venue({
      name,
      location,
      description,
      contactPerson,
      createdBy: user._id
    });

    await venue.save();
    await venue.populate('createdBy', 'username email');

    return NextResponse.json({
      message: 'Venue created successfully',
      venue
    }, { status: 201 });
  } catch (error) {
    console.error('Create venue error:', error);
    
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Venue name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const user = await requireAdmin(request);
    if (user instanceof NextResponse) return user;

    await dbConnect();
    const data = await request.json();
    const { venueId, name, location, description, contactPerson } = data;

    if (!venueId) {
      return NextResponse.json(
        { error: 'Venue ID is required' },
        { status: 400 }
      );
    }

    if (!name || !location) {
      return NextResponse.json(
        { error: 'Name and location are required' },
        { status: 400 }
      );
    }

    const updatedVenue = await Venue.findByIdAndUpdate(
      venueId,
      { name, location, description, contactPerson },
      { new: true }
    ).populate('createdBy', 'username email');

    if (!updatedVenue) {
      return NextResponse.json(
        { error: 'Venue not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Venue updated successfully',
      venue: updatedVenue
    });
  } catch (error) {
    console.error('Update venue error:', error);
    
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Venue name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 