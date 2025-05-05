const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const ambulanceSchema = new mongoose.Schema({
  driverName: {
    type: String,
    required: true,
  },
  ambulanceName: {
    type: String,
    required: true,
  },
  vehicleNumber: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  contactNumber: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  salt: {
    type: String,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  licenseNumber: {
    type: String,
    required: true,
    unique: true,
  },
   profileImage: {
    type: String,
  },
 AmbulanceImage: {
    type: String,
  },
  status: {
    type: String,
    enum: ['ONLINE', 'BUSY', 'OFFLINE'],
    default: 'OFFLINE',
  },
}, { timestamps: true });

// Index for geo queries
ambulanceSchema.index({ location: '2dsphere' });

// Password hash middleware
ambulanceSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.salt = salt;
    next();
  } catch (err) {
    next(err);
  }
});

// Method to compare password
ambulanceSchema.methods.comparePassword = async function (inputPassword) {
  return await bcrypt.compare(inputPassword, this.password);
};

module.exports = mongoose.model('Ambulance', ambulanceSchema);