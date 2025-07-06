import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/db';
import Log from '../../../../models/Log';
import { requireAdmin } from '../../../../lib/auth';

export async function GET(request) {
  try {
    const user = await requireAdmin(request);
    if (user instanceof NextResponse) return user;

    await dbConnect();

    const { searchParams } = new URL(request.url);
    
    // Build query based on filters
    let query = {};
    
    // Apply filters if provided
    const gensetId = searchParams.get('genset');
    if (gensetId && gensetId !== 'all') {
      query.genset = gensetId;
    }

    const venueId = searchParams.get('venue');
    if (venueId && venueId !== 'all') {
      query.venue = venueId;
    }

    const userId = searchParams.get('user');
    if (userId && userId !== 'all') {
      query.user = userId;
    }

    const action = searchParams.get('action');
    if (action && action !== 'all') {
      query.action = action;
    }

    // Get all logs matching the filters (no pagination for download)
    const logs = await Log.find(query)
      .populate('genset', 'name model capacity capacityUnit')
      .populate('venue', 'name')
      .populate('user', 'username email')
      .sort({ timestamp: -1 });

    // Transform logs for Excel export
    const excelData = logs.map(log => ({
      'Timestamp': new Date(log.timestamp).toLocaleString(),
      'Generator Name': log.genset?.name || 'N/A',
      'Generator Model': log.genset?.model || 'N/A',
      'Generator Capacity': log.genset ? `${log.genset.capacity} ${log.genset.capacityUnit}` : 'N/A',
      'Venue': log.venue?.name || 'N/A',
      'Action': log.action.replace('_', ' '),
      'Previous Status': log.previousStatus || 'N/A',
      'New Status': log.newStatus || 'N/A',
      'User': log.user?.username || 'N/A',
      'User Email': log.user?.email || 'N/A',
      'Notes': log.notes || 'N/A'
    }));

    // Create Excel file
    const XLSX = await import('xlsx');
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Activity Logs');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `activity_logs_${timestamp}.xlsx`;

    // Convert to buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Return Excel file as response
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': excelBuffer.length.toString()
      }
    });

  } catch (error) {
    console.error('Download logs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 