import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/db';
import Genset from '../../../../models/Genset';
import Venue from '../../../../models/Venue';
import Log from '../../../../models/Log';
import { requireAdmin } from '../../../../lib/auth';

export async function GET(request) {
  try {
    const user = await requireAdmin(request);
    if (user instanceof NextResponse) return user;

    await dbConnect();
    const gensets = await Genset.find({ isActive: true })
      .populate('venue', 'name')
      .populate('createdBy', 'username email')
      .populate('lastStatusChangedBy', 'username')
      .sort({ createdAt: -1 });

    return NextResponse.json({ gensets });
  } catch (error) {
    console.error('Get gensets error:', error);
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

    const { name, capacity, capacityUnit, venueId } = data;

    if (!name || !capacity || !venueId) {
      return NextResponse.json(
        { error: 'Name, capacity, and venue are required' },
        { status: 400 }
      );
    }

    // Check if venue exists
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return NextResponse.json(
        { error: 'Venue not found' },
        { status: 404 }
      );
    }

    const genset = new Genset({
      name,
      capacity,
      capacityUnit,
      venue: venueId,
      createdBy: user._id,
      venueHistory: [{
        venue: venueId,
        venueName: venue.name,
        attachedAt: new Date(),
        detachedReason: 'OTHER'
      }]
    });

    await genset.save();
    await genset.populate('venue', 'name');
    await genset.populate('createdBy', 'username email');

    // Create log entry
    await Log.create({
      genset: genset._id,
      venue: venueId,
      user: user._id,
      action: 'CREATED',
      newStatus: 'OFF',
      notes: 'Generator created'
    });

    return NextResponse.json({
      message: 'Generator created successfully',
      genset
    }, { status: 201 });
  } catch (error) {
    console.error('Create genset error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Serial number already exists' },
        { status: 409 }
      );
    }

    // Return more specific error information in development
    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json(
      { 
        error: isDev ? error.message : 'Internal server error',
        details: isDev ? error.stack : undefined
      },
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
    const { gensetId, name, capacity, capacityUnit, venueId } = data;

    if (!gensetId) {
      return NextResponse.json(
        { error: 'Generator ID is required' },
        { status: 400 }
      );
    }

    if (!name || !capacity || !venueId) {
      return NextResponse.json(
        { error: 'Name, capacity, and venue are required' },
        { status: 400 }
      );
    }

    // Check if venue exists
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return NextResponse.json(
        { error: 'Venue not found' },
        { status: 404 }
      );
    }

    // Get the current genset to check if venue is changing
    const currentGenset = await Genset.findById(gensetId);
    if (!currentGenset) {
      return NextResponse.json(
        { error: 'Generator not found' },
        { status: 404 }
      );
    }

    const updateData = { name, capacity, capacityUnit, venue: venueId };

    // If venue is changing, update venue history
    if (currentGenset.venue && currentGenset.venue.toString() !== venueId) {
      // Mark previous venue as detached
      const venueHistory = currentGenset.venueHistory || [];
      const lastActiveEntry = venueHistory.find(entry => !entry.detachedAt);
      if (lastActiveEntry) {
        lastActiveEntry.detachedAt = new Date();
        lastActiveEntry.detachedReason = 'MANUAL_REASSIGNMENT';
      }

      // Add new venue to history
      venueHistory.push({
        venue: venueId,
        venueName: venue.name,
        attachedAt: new Date(),
        detachedReason: 'OTHER'
      });

      updateData.venueHistory = venueHistory;
    }

    const updatedGenset = await Genset.findByIdAndUpdate(
      gensetId,
      updateData,
      { new: true }
    )
    .populate('venue', 'name')
    .populate('createdBy', 'username email')
    .populate('lastStatusChangedBy', 'username');

    if (!updatedGenset) {
      return NextResponse.json(
        { error: 'Generator not found' },
        { status: 404 }
      );
    }

    // Create log entry
    await Log.create({
      genset: updatedGenset._id,
      venue: venueId,
      user: user._id,
      action: 'UPDATED',
      newStatus: updatedGenset.status,
      notes: 'Generator updated'
    });

    return NextResponse.json({
      message: 'Generator updated successfully',
      genset: updatedGenset
    });
  } catch (error) {
    console.error('Update genset error:', error);
    
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Serial number already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const user = await requireAdmin(request);
    if (user instanceof NextResponse) return user;

    await dbConnect();
    const data = await request.json();
    const { gensetId } = data;

    if (!gensetId) {
      return NextResponse.json(
        { error: 'Generator ID is required' },
        { status: 400 }
      );
    }

    // Get the genset before deletion for logging
    const genset = await Genset.findById(gensetId).populate('venue');
    if (!genset) {
      return NextResponse.json(
        { error: 'Generator not found' },
        { status: 404 }
      );
    }

    // Soft delete by setting isActive to false
    const deletedGenset = await Genset.findByIdAndUpdate(
      gensetId,
      { isActive: false },
      { new: true }
    );

    // Create log entry
    await Log.create({
      genset: genset._id,
      venue: genset.venue._id,
      user: user._id,
      action: 'DELETED',
      previousStatus: genset.status,
      notes: 'Generator deleted'
    });

    return NextResponse.json({
      message: 'Generator deleted successfully'
    });
  } catch (error) {
    console.error('Delete genset error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 