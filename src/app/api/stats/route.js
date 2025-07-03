import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/db';
import Genset from '../../../models/Genset';
import Venue from '../../../models/Venue';
import User from '../../../models/User';
import Log from '../../../models/Log';
import { requireAuth } from '../../../lib/auth';

export async function GET(request) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;

    await dbConnect();

    // Base query for user role restrictions
    const isAdmin = user.role === 'admin';
    const gensetQuery = isAdmin 
      ? { isActive: true }
      : { venue: user.assignedVenue, isActive: true };

    // 1. Genset Status Statistics
    const gensets = await Genset.find(gensetQuery).populate('venue', 'name');
    const totalGensets = gensets.length;
    const gensetsOn = gensets.filter(g => g.status === 'ON').length;
    const gensetsOff = gensets.filter(g => g.status === 'OFF').length;

    // 2. Gensets by Venue
    const gensetsByVenue = {};
    gensets.forEach(genset => {
      if (genset.venue) {
        const venueName = genset.venue.name;
        if (!gensetsByVenue[venueName]) {
          gensetsByVenue[venueName] = { total: 0, on: 0, off: 0 };
        }
        gensetsByVenue[venueName].total++;
        if (genset.status === 'ON') {
          gensetsByVenue[venueName].on++;
        } else {
          gensetsByVenue[venueName].off++;
        }
      }
    });

    // 3. Activity Trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const logQuery = isAdmin 
      ? { timestamp: { $gte: thirtyDaysAgo } }
      : { venue: user.assignedVenue, timestamp: { $gte: thirtyDaysAgo } };

    const recentLogs = await Log.find(logQuery)
              .populate('genset', 'name capacity capacityUnit')
      .populate('venue', 'name')
      .sort({ timestamp: 1 });

    // Group logs by date
    const activityByDate = {};
    recentLogs.forEach(log => {
      const date = log.timestamp.toISOString().split('T')[0];
      if (!activityByDate[date]) {
        activityByDate[date] = { date, total: 0, turnOn: 0, turnOff: 0 };
      }
      activityByDate[date].total++;
      if (log.action === 'TURN_ON') {
        activityByDate[date].turnOn++;
      } else if (log.action === 'TURN_OFF') {
        activityByDate[date].turnOff++;
      }
    });

    const activityTrend = Object.values(activityByDate).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    // 4. Capacity Statistics
    const totalCapacity = gensets.reduce((sum, genset) => {
      return sum + (genset.capacity || 0);
    }, 0);

    const activeCapacity = gensets
      .filter(g => g.status === 'ON')
      .reduce((sum, genset) => {
        return sum + (genset.capacity || 0);
      }, 0);

    // 5. User Activity (for admins only)
    let userActivity = null;
    if (isAdmin) {
      const users = await User.find({ isActive: true }).select('username');
      const userStats = {};
      
      recentLogs.forEach(log => {
        if (log.user) {
          const userId = log.user.toString();
          if (!userStats[userId]) {
            userStats[userId] = { count: 0 };
          }
          userStats[userId].count++;
        }
      });

      userActivity = await Promise.all(
        Object.entries(userStats).map(async ([userId, stats]) => {
          const user = await User.findById(userId).select('username');
          return {
            username: user?.username || 'Unknown',
            actions: stats.count
          };
        })
      );
    }

    // 6. Overall Statistics
    let overallStats = {
      totalGensets,
      gensetsOn,
      gensetsOff,
      totalCapacity,
      activeCapacity,
      utilizationRate: totalCapacity > 0 ? Math.round((activeCapacity / totalCapacity) * 100) : 0
    };

    if (isAdmin) {
      const totalVenues = await Venue.countDocuments({ isActive: true });
      const totalUsers = await User.countDocuments({ isActive: true });
      overallStats.totalVenues = totalVenues;
      overallStats.totalUsers = totalUsers;
    }

    return NextResponse.json({
      overallStats,
      gensetsByVenue: Object.entries(gensetsByVenue).map(([name, stats]) => ({
        name,
        ...stats
      })),
      activityTrend,
      userActivity,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 