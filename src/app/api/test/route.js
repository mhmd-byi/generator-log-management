import { NextResponse } from 'next/server';

export async function GET() {
  console.log('🟢 Test API called');
  return NextResponse.json({ 
    message: 'API is working',
    timestamp: new Date().toISOString()
  });
}

export async function POST(request) {
  console.log('🟢 Test POST API called');
  const body = await request.json();
  console.log('🟢 Received body:', body);
  return NextResponse.json({ 
    message: 'POST API is working',
    received: body,
    timestamp: new Date().toISOString()
  });
} 