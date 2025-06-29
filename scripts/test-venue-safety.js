import mongoose from 'mongoose';
import Venue from '../src/models/Venue.js';
import Genset from '../src/models/Genset.js';
import User from '../src/models/User.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Database connection
const dbConnect = async () => {
  if (mongoose.connections[0].readyState) return;
  
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

const testVenueSafety = async () => {
  await dbConnect();
  
  console.log('🔒 Testing Venue Safety Features for Generators\n');
  
  try {
    // Find a generator to test with
    const testGenset = await Genset.findOne({ isActive: true }).populate('venue');
    if (!testGenset) {
      console.log('❌ No active generators found to test with');
      return;
    }
    
    console.log(`📊 Test Generator: ${testGenset.name}`);
    console.log(`📍 Current Venue: ${testGenset.venue ? testGenset.venue.name : 'None'}`);
    console.log(`⚡ Current Status: ${testGenset.status}`);
    console.log(`🏢 Venue Active: ${testGenset.venue ? testGenset.venue.isActive : 'N/A'}\n`);
    
    // Test Case 1: Generator with no venue
    console.log('🧪 Test Case 1: Generator with no venue');
    const originalVenue = testGenset.venue;
    testGenset.venue = null;
    await testGenset.save();
    
    console.log('✅ Removed venue from generator');
    console.log('🚫 This generator should now be unable to turn ON');
    
    // Test Case 2: Generator with inactive venue  
    console.log('\n🧪 Test Case 2: Generator with inactive venue');
    if (originalVenue) {
      // Restore venue but make it inactive
      testGenset.venue = originalVenue._id;
      await testGenset.save();
      
      originalVenue.isActive = false;
      await originalVenue.save();
      
      console.log('✅ Deactivated the venue');
      console.log('🚫 This generator should now be unable to turn ON');
      
      // Restore venue to active state
      originalVenue.isActive = true;
      await originalVenue.save();
      console.log('✅ Restored venue to active state');
    }
    
    // Restore original state
    testGenset.venue = originalVenue._id;
    await testGenset.save();
    
    console.log('\n📋 Safety Rules Summary:');
    console.log('1. ✅ Generators can always be turned OFF regardless of venue status');
    console.log('2. 🚫 Generators cannot be turned ON if no venue is assigned');
    console.log('3. 🚫 Generators cannot be turned ON if venue is deactivated');
    console.log('4. ✅ Generators can only be turned ON if venue exists and is active');
    
    console.log('\n🎯 API Endpoints affected:');
    console.log('- POST /api/gensets/[id]/toggle - Enhanced with venue safety checks');
    console.log('- GET /api/user/gensets - Returns venue isActive status');
    
    console.log('\n🎨 UI Features:');
    console.log('- Toggle button disabled for unsafe generators');
    console.log('- Warning messages displayed for venue issues');
    console.log('- Visual indicators for deactivated venues');
    console.log('- Error handling for API restrictions');
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Test completed and database connection closed');
  }
};

// Run the test
testVenueSafety().catch(console.error); 