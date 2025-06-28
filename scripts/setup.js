// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import models using require (CommonJS)
const User = require('../src/models/User').default;
const Venue = require('../src/models/Venue').default;
const Genset = require('../src/models/Genset').default;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/genset-management';
console.log('Using MongoDB URI:', MONGODB_URI.replace(/\/\/.*@/, '//***:***@')); // Hide credentials

async function setupDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create admin user if doesn't exist
    const existingAdmin = await User.findOne({ username: 'admin' });
    if (!existingAdmin) {
      const admin = new User({
        username: 'admin',
        email: 'admin@example.com',
        password: 'ObeyAllah@786', // Will be hashed by the model
        role: 'admin'
      });
      await admin.save();
      console.log('Admin user created: admin / ObeyAllah@786');
    } else {
      console.log('Admin user already exists');
    }

    // Create sample venue
    const existingVenue = await Venue.findOne({ name: 'Main Office' });
    let venue;
    if (!existingVenue) {
      const admin = await User.findOne({ role: 'admin' });
      venue = new Venue({
        name: 'Main Office',
        location: '123 Business Street, City, State',
        description: 'Main office building with backup generators',
        contactPerson: {
          name: 'John Doe',
          phone: '+1-555-0123',
          email: 'john.doe@example.com'
        },
        createdBy: admin._id
      });
      await venue.save();
      console.log('Sample venue created: Main Office');
    } else {
      venue = existingVenue;
      console.log('Sample venue already exists');
    }

    // Create sample generators
    const existingGenset = await Genset.findOne({ serialNumber: 'GEN001' });
    if (!existingGenset) {
      const admin = await User.findOne({ role: 'admin' });
      
      const generators = [
        {
          name: 'Generator 1',
          model: 'CAT 3516B',
          serialNumber: 'GEN001',
          capacity: 2000,
          capacityUnit: 'KW',
          fuelType: 'Diesel',
          venue: venue._id,
          createdBy: admin._id
        },
        {
          name: 'Generator 2',
          model: 'Cummins QSK60',
          serialNumber: 'GEN002',
          capacity: 1800,
          capacityUnit: 'KW',
          fuelType: 'Diesel',
          venue: venue._id,
          createdBy: admin._id
        }
      ];

      await Genset.insertMany(generators);
      console.log('Sample generators created');
    } else {
      console.log('Sample generators already exist');
    }

    // Create sample user
    const existingUser = await User.findOne({ username: 'user1' });
    if (!existingUser) {
      const user = new User({
        username: 'user1',
        email: 'user1@example.com',
        password: 'user123', // Will be hashed by the model
        role: 'user',
        assignedVenue: venue._id
      });
      await user.save();
      console.log('Sample user created: user1 / user123');
    } else {
      console.log('Sample user already exists');
    }

    console.log('\nSetup completed successfully!');
    console.log('\nYou can now login with:');
    console.log('Admin: admin / ObeyAllah@786');
    console.log('User: user1 / user123');
    
  } catch (error) {
    console.error('Setup error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
  }
}

setupDatabase(); 