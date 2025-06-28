// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const mongoose = require('mongoose');
const User = require('../src/models/User').default;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/genset-management';
console.log('Using MongoDB URI:', MONGODB_URI.replace(/\/\/.*@/, '//***:***@')); // Hide credentials

async function testLogin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if admin user exists
    const admin = await User.findOne({ username: 'admin' });
    if (!admin) {
      console.log('❌ Admin user not found in database');
      return;
    }
    
    console.log('✅ Admin user found:', {
      username: admin.username,
      email: admin.email,
      role: admin.role,
      hasPassword: !!admin.password,
      passwordLength: admin.password ? admin.password.length : 0,
      createdAt: admin.createdAt
    });

    // Test password comparison
    const testPassword = 'ObeyAllah@786';
    const isValid = await admin.comparePassword(testPassword);
    console.log(`🔑 Password test for "${testPassword}":`, isValid ? '✅ VALID' : '❌ INVALID');

    // Test with old password too
    const oldPassword = 'admin123';
    const isOldValid = await admin.comparePassword(oldPassword);
    console.log(`🔑 Password test for "${oldPassword}":`, isOldValid ? '✅ VALID' : '❌ INVALID');

    // Check all users
    const allUsers = await User.find({});
    console.log('\n📋 All users in database:');
    allUsers.forEach(user => {
      console.log(`- ${user.username} (${user.email}) - Role: ${user.role} - Active: ${user.isActive}`);
    });
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
  }
}

testLogin(); 