// In service/authentication.js
const jwt = require('jsonwebtoken');
const User = require('../model/user');
const MedicalOwner = require('../model/medical');
const Ambulance = require('../model/ambulance'); // Add Ambulance model

function createTokenForUser(user) {
  const payload = {
    _id: user._id, // Use _id
    email: user.email,
    fullName: user.fullName || user.FullName || user.driverName, // Handle Ambulance
    profileImage: user.profileImage || '/default.png',
    role: user instanceof User
      ? 'user'
      : user instanceof MedicalOwner
      ? 'medicalOwner'
      : 'ambulance', // Add Ambulance role
  };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
}

async function validateToken(token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload._id) throw new Error('Invalid token payload: Missing _id');

    // Try User model
    let user = await User.findById(payload._id).lean();
    if (user) {
      return { ...user, role: 'user' };
    }

    // Try MedicalOwner model
    user = await MedicalOwner.findById(payload._id).lean();
    if (user) {
      return { ...user, role: 'medicalOwner' };
    }

    // Try Ambulance model
    user = await Ambulance.findById(payload._id).lean();
    if (user) {
      return { ...user, role: 'ambulance' };
    }

    throw new Error('User, MedicalOwner, or Ambulance not found');
  } catch (error) {
    throw new Error('Token validation failed: ' + error.message);
  }
}

module.exports = {
  createTokenForUser,
  validateToken,
};