const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const medicalOwnerSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true
  },
  storeName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  contactNumber: {
    type: String,
    required: true
  },
  profileImage: {
    type: String,
    default: '/default.png'
  },
  address: {
    type: String,
    required: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  startedOn: {
    type: Date,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  salt: {
    type: String
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  available: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexing for geo queries
medicalOwnerSchema.index({ location: '2dsphere' });

// Password hash middleware
medicalOwnerSchema.pre('save', async function (next) {
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
medicalOwnerSchema.methods.comparePassword = async function (inputPassword) {
  return await bcrypt.compare(inputPassword, this.password);
};

module.exports = mongoose.model('MedicalOwner', medicalOwnerSchema);
