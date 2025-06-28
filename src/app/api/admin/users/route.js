import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/db';
import User from '../../../../models/User';
import Venue from '../../../../models/Venue';
import { requireAdmin } from '../../../../lib/auth';

export async function GET(request) {
  try {
    const user = await requireAdmin(request);
    if (user instanceof NextResponse) return user;

    await dbConnect();
    const users = await User.find({ isActive: true })
      .populate('assignedVenue', 'name location')
      .sort({ createdAt: -1 });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
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

    const { username, email, password, role, assignedVenue } = data;

    if (!username || !email || !password) {
      return NextResponse.json(
        { error: 'Username, email, and password are required' },
        { status: 400 }
      );
    }

    // Validate venue if provided
    if (assignedVenue) {
      const venue = await Venue.findById(assignedVenue);
      if (!venue) {
        return NextResponse.json(
          { error: 'Venue not found' },
          { status: 404 }
        );
      }
    }

    const newUser = new User({
      username,
      email,
      password,
      role: role || 'user',
      assignedVenue: assignedVenue || null
    });

    await newUser.save();
    await newUser.populate('assignedVenue', 'name location');

    return NextResponse.json({
      message: 'User created successfully',
      user: newUser
    }, { status: 201 });
  } catch (error) {
    console.error('Create user error:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return NextResponse.json(
        { error: `${field} already exists` },
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
    const { userId, username, email, role, assignedVenue } = data;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!username || !email) {
      return NextResponse.json(
        { error: 'Username and email are required' },
        { status: 400 }
      );
    }

    // Validate venue if provided
    if (assignedVenue) {
      const venue = await Venue.findById(assignedVenue);
      if (!venue) {
        return NextResponse.json(
          { error: 'Venue not found' },
          { status: 404 }
        );
      }
    }

    const updateData = {
      username,
      email,
      role: role || 'user',
      assignedVenue: assignedVenue || null
    };

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).populate('assignedVenue', 'name location');

    if (!updatedUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return NextResponse.json(
        { error: `${field} already exists` },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 