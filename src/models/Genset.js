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
    required: true,
    trim: true,
    maxlength: 100
  },
  serialNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50
  },
  capacity: {
    type: Number,
    required: true,
    min: 0
  },
  capacityUnit: {
    type: String,
    enum: ['KW', 'KVA'],
    default: 'KW'
  },
  fuelType: {
    type: String,
    enum: ['Diesel', 'Gas', 'Petrol', 'Hybrid'],
    default: 'Diesel'
  },
  venue: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Venue',
    required: true
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
  }
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

export default mongoose.models.Genset || mongoose.model('Genset', gensetSchema); 