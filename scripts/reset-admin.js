const mongoose = require('mongoose');
const User = require('../src/models/User').default;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/genset-management';

async function resetAdminPassword() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find and delete existing admin user
    await User.deleteOne({ username: 'admin' });
    console.log('Existing admin user deleted');

    // Create new admin user with updated password
    const admin = new User({
      username: 'admin',
      email: 'admin@example.com',
      password: 'ObeyAllah@786', // Will be hashed by the model
      role: 'admin'
    });
    
    await admin.save();
    console.log('New admin user created with password: ObeyAllah@786');
    
  } catch (error) {
    console.error('Reset error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
  }
}

resetAdminPassword(); 