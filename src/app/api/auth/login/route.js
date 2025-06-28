import { NextResponse } from 'next/server';
import { generateToken } from '../../../../lib/auth';
// Dynamic imports to avoid module loading issues
const dbConnect = () => import('../../../../lib/db').then(m => m.default);
const getUserModel = () => import('../../../../models/User.js').then(m => m.default);

export async function GET() {
  console.log('🚀 LOGIN GET ROUTE HIT!');
  return NextResponse.json({ message: 'Login route is accessible' });
}

export async function POST(request) {
  console.log('🚀 LOGIN POST ROUTE HIT!');
  
  try {
    console.log('🔵 Starting login process...');
    
    const { username, password } = await request.json();
    console.log('🔵 Received:', { username, password: '***' });
    
    // Dynamic import and connect
    console.log('🔵 Connecting to database...');
    const connectDB = await dbConnect();
    await connectDB();
    console.log('🔵 Database connected!');
    
    // Dynamic User model import
    console.log('🔵 Loading User model...');
    const User = await getUserModel();
    console.log('🔵 User model loaded:', User.modelName);
    
    // Find user in database
    console.log('🔵 Searching for user in database...');
    const user = await User.findOne({
      $or: [{ username }, { email: username }]
    });
    
    console.log('🔵 User found:', user ? `Yes (${user.username})` : 'No');
    
    if (!user || !user.isActive) {
      console.log('🔴 User not found or inactive');
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    
    // Test password
    console.log('🔵 Testing password...');
    const isPasswordValid = await user.comparePassword(password);
    console.log('🔵 Password valid:', isPasswordValid);
    
    if (!isPasswordValid) {
      console.log('🔴 Invalid password');
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    
    console.log('🟢 Authentication successful!');
    
    // Generate JWT token
    const token = generateToken({
      userId: user._id,
      username: user.username,
      role: user.role
    });
    
    const response = NextResponse.json({
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        assignedVenue: user.assignedVenue
      },
      token
    });

    // Set HTTP-only cookie for authentication
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    console.log('🟢 Token generated and cookie set');
    return response;
    
  } catch (error) {
    console.error('🔴 Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 