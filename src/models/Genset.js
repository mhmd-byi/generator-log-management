import mongoose from 'mongoose';

const gensetSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  model: {
    type: String,
    required: false,
    trim: true,
    maxlength: 100
  },
  capacity: {
    type: Number,
    required: true,
    min: 0
  },
  capacityUnit: {
    type: String,
    enum: ['KW', 'MW', 'HP'],
    default: 'KW'
  },
  fuelType: {
    type: String,
    enum: ['Diesel', 'Natural Gas', 'Gasoline', 'Propane'],
    required: false
  },
  venue: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Venue',
    required: false
  },
  status: {
    type: String,
    enum: ['ON', 'OFF'],
    default: 'OFF'
  },
  lastStatusChange: {
    type: Date,
    default: Date.now
  },
  lastStatusChangedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  venueHistory: [{
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Venue'
    },
    venueName: String,
    attachedAt: {
      type: Date,
      default: Date.now
    },
    detachedAt: Date,
    detachedReason: {
      type: String,
      enum: ['VENUE_DELETED', 'MANUAL_REASSIGNMENT', 'OTHER'],
      default: 'OTHER'
    }
  }]
}, {
  timestamps: true
});

// Update lastStatusChange when status changes
gensetSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    this.lastStatusChange = new Date();
  }
  next();
});

// Track venue changes in history
gensetSchema.pre('save', function(next) {
  if (this.isModified('venue') && !this.isNew) {
    // If venue is being changed and this isn't a new document
    const previousVenueHistory = this.venueHistory || [];
    
    // Find the last entry that doesn't have a detachedAt date
    const lastActiveEntry = previousVenueHistory.find(entry => !entry.detachedAt);
    
    if (lastActiveEntry) {
      // Mark the previous venue attachment as detached
      lastActiveEntry.detachedAt = new Date();
      lastActiveEntry.detachedReason = 'MANUAL_REASSIGNMENT';
    }
  }
  next();
});

export default mongoose.models.Genset || mongoose.model('Genset', gensetSchema); 