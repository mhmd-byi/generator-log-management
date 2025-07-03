import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/db';
import Log from '../../../../models/Log';
import Genset from '../../../../models/Genset';
import { requireAuth } from '../../../../lib/auth';

export async function PUT(request, { params }) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;

    // Only admins can edit log entries
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Only administrators can edit log entries.' },
        { status: 403 }
      );
    }

    await dbConnect();
    
    const { id } = params;
    const data = await request.json();
    const { gensetId, action, notes, customTimestamp } = data;

    // Validate required fields
    if (!gensetId || !action || !notes) {
      return NextResponse.json(
        { error: 'Generator, action, and notes are required' },
        { status: 400 }
      );
    }

    // Find the existing log
    const existingLog = await Log.findById(id);
    if (!existingLog) {
      return NextResponse.json(
        { error: 'Log entry not found' },
        { status: 404 }
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

    // Check if genset has a venue assigned
    if (!genset.venue) {
      return NextResponse.json(
        { error: 'Generator must be assigned to a venue before updating log entries' },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData = {
      genset: gensetId,
      venue: genset.venue._id,
      action: action,
      notes: notes.trim(),
    };

    // Update timestamp if provided
    if (customTimestamp) {
      const timestampDate = new Date(customTimestamp);
      if (isNaN(timestampDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid timestamp format' },
          { status: 400 }
        );
      }
      // Store as UTC timestamp
      updateData.timestamp = timestampDate;
    }

    // For status-related actions, update status fields
    if (['TURN_ON', 'TURN_OFF'].includes(action)) {
      updateData.previousStatus = genset.status;
      updateData.newStatus = genset.status; // Manual entry doesn't change actual status
    } else if (action === 'MANUAL') {
      // For pure manual entries, record current status as context
      updateData.newStatus = genset.status;
    } else {
      // For other actions, clear status fields
      updateData.previousStatus = undefined;
      updateData.newStatus = undefined;
    }

    // Update the log
    const updatedLog = await Log.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate([
      { path: 'genset', select: 'name model capacity capacityUnit' },
      { path: 'venue', select: 'name' },
      { path: 'user', select: 'username email' }
    ]);

    return NextResponse.json({
      message: 'Log entry updated successfully',
      log: updatedLog
    });

  } catch (error) {
    console.error('Update log error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;

    // Only admins can delete log entries
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Only administrators can delete log entries.' },
        { status: 403 }
      );
    }

    await dbConnect();
    
    const { id } = params;

    // Find and delete the log
    const deletedLog = await Log.findByIdAndDelete(id);
    if (!deletedLog) {
      return NextResponse.json(
        { error: 'Log entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Log entry deleted successfully'
    });

  } catch (error) {
    console.error('Delete log error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 