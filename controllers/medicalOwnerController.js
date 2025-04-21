// In controllers/medicalOwnerController.js
const MedicalOwner = require('../model/medical');
const Message = require('../model/message');
const User = require('../model/user');
const { createTokenForUser } = require('../service/authentication');

exports.renderSignupPage = (req, res) => {
  res.render('signup'); // Ensure 'signup.ejs' exists
};

exports.renderSigninPage = (req, res) => {
  res.render('signin'); // Ensure 'signin.ejs' exists
};

exports.signup = async (req, res) => {
  try {
    const {
      fullName,
      storeName,
      email,
      contactNumber,
      address,
      startedOn,
      password,
      latitude,
      longitude,
    } = req.body;

    if (
      latitude === undefined ||
      longitude === undefined ||
      isNaN(Number(latitude)) ||
      isNaN(Number(longitude))
    ) {
      return res.status(400).json({ message: 'Invalid or missing latitude and longitude' });
    }

    const existing = await MedicalOwner.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const location = {
      type: 'Point',
      coordinates: [Number(longitude), Number(latitude)],
    };

    const newOwner = new MedicalOwner({
      fullName,
      storeName,
      email,
      contactNumber,
      address,
      startedOn,
      password,
      location,
    });

    await newOwner.save();
    res.redirect('/medical/signin');
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ message: 'Something went wrong during signup' });
  }
};

exports.signInAndGetConnectedUsers = async (req, res) => {
  try {
    const { email, password } = req.body;

    const owner = await MedicalOwner.findOne({ email });
    if (!owner) {
      return res.render('signin', { error: 'No user found' });
    }

    const isMatch = await owner.comparePassword(password); // Assumes bcrypt
    if (!isMatch) {
      return res.render('signin', { error: 'Invalid password' });
    }

    const token = createTokenForUser(owner);
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.redirect('/medical/dashboard');
  } catch (err) {
    console.error('Sign-in error:', err.message);
    res.render('signin', { error: 'Something went wrong during login' });
  }
};

exports.getDashboard = async (req, res) => {
  const currentUser = req.user;
  if (!currentUser || currentUser.role !== 'medicalOwner') {
    console.error('Unauthorized dashboard access:', currentUser?._id);
    return res.status(401).send('Unauthorized');
  }
  try {
    const messages = await Message.find({
      receiver: currentUser._id,
      receiverModel: 'MedicalOwner',
    }).distinct('sender');
    const users = await User.find({ _id: { $in: messages } }).lean();
    res.render('home', { users });
  } catch (error) {
    console.error('Error fetching dashboard:', error.message);
    res.render('medicalDashboard', { users: [] });
  }
};