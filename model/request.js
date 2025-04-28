const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  userName: { type: String, required: true },
  ambulanceId: { type: mongoose.Schema.Types.ObjectId, required: true },
  userAddress: { type: String },
  userLocation: {
    lat: { type: Number },
    lng: { type: Number },
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'arrived'],
    default: 'pending',
  },
  createdAt: { type: Date, default: Date.now },
});

// Add indexes for faster queries
requestSchema.index({ userId: 1 });
requestSchema.index({ ambulanceId: 1 });
requestSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Request', requestSchema);