import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/db';
import Venue from '../../../../models/Venue';
import Genset from '../../../../models/Genset';
import Log from '../../../../models/Log';
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

    const { name, description, contactPerson } = data;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const venue = new Venue({
      name,
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
    const { venueId, name, description, contactPerson } = data;

    if (!venueId) {
      return NextResponse.json(
        { error: 'Venue ID is required' },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const updatedVenue = await Venue.findByIdAndUpdate(
      venueId,
      { name, description, contactPerson },
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

export async function DELETE(request) {
  try {
    const user = await requireAdmin(request);
    if (user instanceof NextResponse) return user;

    await dbConnect();
    const data = await request.json();
    const { venueId } = data;

    if (!venueId) {
      return NextResponse.json(
        { error: 'Venue ID is required' },
        { status: 400 }
      );
    }

    // Get the venue before deletion for history tracking
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return NextResponse.json(
        { error: 'Venue not found' },
        { status: 404 }
      );
    }

    // Find all gensets attached to this venue
    const attachedGensets = await Genset.find({ 
      venue: venueId, 
      isActive: true 
    });

    // Update each genset to remove venue and add to history
    for (const genset of attachedGensets) {
      // Add current venue to history before removing
      const venueHistoryEntry = {
        venue: venue._id,
        venueName: venue.name,
        attachedAt: genset.createdAt, // Use creation date as attachment date
        detachedAt: new Date(),
        detachedReason: 'VENUE_DELETED'
      };

      // Update genset: remove venue and add to history
      await Genset.findByIdAndUpdate(
        genset._id,
        {
          venue: null,
          $push: { venueHistory: venueHistoryEntry }
        }
      );

      // Create log entry for genset untagging
      await Log.create({
        genset: genset._id,
        venue: venue._id,
        user: user._id,
        action: 'VENUE_UNTAGGED',
        previousStatus: genset.status,
        newStatus: genset.status,
        notes: `Generator untagged due to venue deletion: ${venue.name}`
      });
    }

    // Soft delete the venue by setting isActive to false
    const deletedVenue = await Venue.findByIdAndUpdate(
      venueId,
      { isActive: false },
      { new: true }
    );

    // Create log entry for venue deletion
    await Log.create({
      venue: venue._id,
      user: user._id,
      action: 'VENUE_DELETED',
      notes: `Venue deleted: ${venue.name}. ${attachedGensets.length} generators untagged.`
    });

    return NextResponse.json({
      message: 'Venue deleted successfully',
      untaggedGenerators: attachedGensets.length
    });
  } catch (error) {
    console.error('Delete venue error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 