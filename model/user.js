const { createHmac, randomBytes } = require('crypto');
const { Schema, model } = require('mongoose');

const UserSchema = new Schema(
  {
    FullName: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
    },
    mobileNumber: {
      type: String,
      required: true,
      match: [/^\d{10}$/, 'Please enter a valid 10-digit mobile number']
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],

        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: [0, 0], // [longitude, latitude]
        required: true,
      },
    },
    chatSearchHistory: [
      {
        query: { type: String },
        timestamp: { type: Date, default: Date.now }
      }
    ],
    salt: {
      type: String
    },
    password: {
      type: String,
      required: true
    },
    profileImage: {
      type: String,
      default: '/uploads/profiles/default.png'
    },
    role: {
      type: String,
      enum: ['USER', 'ADMIN'],
      default: 'USER'
    }
  },
  { timestamps: true }
);
UserSchema.index({ location: '2dsphere' });

// Hash password before saving
UserSchema.pre('save', function (next) {
  if (!this.isModified('password')) return next();

  // Hash the password
  const salt = randomBytes(16).toString('hex');
  this.salt = salt;
  this.password = createHmac('sha256', salt)
    .update(this.password)
    .digest('hex');

  // Validate location coordinates
  if (!this.location.coordinates || this.location.coordinates.length !== 2) {
    this.location.coordinates = [0, 0]; // Default to [longitude, latitude]
  }

  next();
});

// Authenticate and generate token
UserSchema.statics.matchPasswordAndGenerateToken = async function (email, password) {
  const user = await this.findOne({ email });
  if (!user) throw new Error('User Not Found!');

  const userProvidedHash = createHmac('sha256', user.salt)
    .update(password)
    .digest('hex');

  if (user.password !== userProvidedHash) throw new Error('Incorrect Password!');

  const { createTokenForUser } = require('../service/authentication');
  return createTokenForUser(user);
};

module.exports = model('User', UserSchema);
