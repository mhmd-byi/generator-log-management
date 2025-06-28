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
      .populate('venue', 'name location')
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

    const { name, model, serialNumber, capacity, capacityUnit, fuelType, venueId } = data;

    if (!name || !model || !serialNumber || !capacity || !venueId) {
      return NextResponse.json(
        { error: 'All required fields must be provided' },
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
      model,
      serialNumber,
      capacity,
      capacityUnit,
      fuelType,
      venue: venueId,
      createdBy: user._id
    });

    await genset.save();
    await genset.populate('venue', 'name location');
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

export async function PATCH(request) {
  try {
    const user = await requireAdmin(request);
    if (user instanceof NextResponse) return user;

    await dbConnect();
    const data = await request.json();
    const { gensetId, name, model, serialNumber, capacity, capacityUnit, fuelType, venueId } = data;

    if (!gensetId) {
      return NextResponse.json(
        { error: 'Generator ID is required' },
        { status: 400 }
      );
    }

    if (!name || !model || !serialNumber || !capacity || !venueId) {
      return NextResponse.json(
        { error: 'All required fields must be provided' },
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

    const updatedGenset = await Genset.findByIdAndUpdate(
      gensetId,
      { name, model, serialNumber, capacity, capacityUnit, fuelType, venue: venueId },
      { new: true }
    )
    .populate('venue', 'name location')
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