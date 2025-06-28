import mongoose from 'mongoose';

const logSchema = new mongoose.Schema({
  genset: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Genset',
    required: true
  },
  venue: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Venue',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    enum: ['TURN_ON', 'TURN_OFF', 'CREATED', 'UPDATED'],
    required: true
  },
  previousStatus: {
    type: String,
    enum: ['ON', 'OFF']
  },
  newStatus: {
    type: String,
    enum: ['ON', 'OFF']
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Index for efficient querying
logSchema.index({ genset: 1, timestamp: -1 });
logSchema.index({ venue: 1, timestamp: -1 });
logSchema.index({ user: 1, timestamp: -1 });

export default mongoose.models.Log || mongoose.model('Log', logSchema); 