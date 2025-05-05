const Ambulance = require('../model/ambulance');
const { createTokenForUser } = require('../service/authentication');
const Message = require('../model/message');
const User = require('../model/user');
const mapService = require('../service/maps');
const Request = require('../model/request');
const mongoose = require('mongoose');

exports.renderSignupPage = (req, res) => {
  res.render('ambulance/signup');
};

exports.renderSigninPage = (req, res) => {
  res.render('ambulance/signin');
};

exports.signin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const ambulance = await Ambulance.findOne({ email });
    if (!ambulance) return res.status(404).json({ message: 'Ambulance not found' });

    const isMatch = await ambulance.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid password' });

    const token = createTokenForUser(ambulance);
    res.cookie('token', token, { httpOnly: true }).redirect('/ambulance/dashboard');
  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).send('Error during signin');
  }
};

exports.getDashboard = async (req, res) => {
  try {
    if (!req.user) return res.status(401).send('Unauthorized');
    
    const ambulance = await Ambulance.findById(req.user._id).lean();
    if (!ambulance) {
      console.error('Ambulance not found for ID:', req.user._id);
      return res.status(404).send('Ambulance not found');
    }

    const requests = await Request.find({
      ambulanceId: req.user._id,
      status: { $in: ['pending', 'accepted'] }
    }).lean().select('userId userName userAddress userLocation status _id');

    res.render('ambulance/dashboard', {
      ambulance,
      requests: requests || []
    });
  } catch (error) {
    console.error('Error in getDashboard:', error);
    res.status(500).send('Something went wrong.');
  }
};

exports.toggleStatus = async (req, res) => {
  try {
    if (!req.user) return res.status(401).send('Unauthorized');
    
    const ambulance = await Ambulance.findById(req.user._id);
    const statusFlow = { 'ONLINE': 'BUSY', 'BUSY': 'OFFLINE', 'OFFLINE': 'ONLINE' };
    ambulance.status = statusFlow[ambulance.status] || 'ONLINE';
    await ambulance.save();
    res.json({ success: true, status: ambulance.status });
  } catch (err) {
    console.error('Status toggle error:', err);
    res.status(500).json({ success: false, message: 'Failed to toggle status' });
  }
};

exports.getLiveLocationData = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'ambulance') return res.status(401).send('Unauthorized');
    const { userId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).send('Invalid user ID');

    const user = await User.findById(userId).lean();
    if (!user || !user.location) return res.status(404).send('User location not found');

    if (!req.user.location || !req.user.location.coordinates) return res.status(400).send('Ambulance location not available');

    const distanceTime = await mapService.getDistanceTime(
      `${req.user.location.coordinates[1]},${req.user.location.coordinates[0]}`,
      `${user.location.coordinates[1]},${user.location.coordinates[0]}`
    );

    res.json({
      ambulanceLocation: req.user.location,
      userLocation: user.location,
      distanceTime,
    });
  } catch (err) {
    console.error('Live location error:', err);
    res.status(500).send('Server error');
  }
};

exports.handleGetRealtimeChat = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'ambulance') return res.status(401).send('Unauthorized');
    
    const receiverId = req.params.userId;
    if (!mongoose.Types.ObjectId.isValid(receiverId)) return res.status(400).send('Invalid user ID');

    const receiver = await User.findById(receiverId).lean();
    if (!receiver) return res.status(404).send('User not found');

    const room = [req.user._id, receiver._id].sort().join('_');
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: receiver._id },
        { sender: receiver._id, receiver: req.user._id },
      ],
    }).sort('timestamp');

    res.render('realtime-chat', {
      receiver,
      receiverRole: 'User',
      messages,
      currentUser: req.user,
      currentRole: 'Ambulance',
      room,
      receiverId,
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).send('Error loading chat');
  }
};

exports.signup = async (req, res) => {
  try {
    const {
      driverName,
      ambulanceName,
      vehicleNumber,
      email,
      contactNumber,
      password,
      licenseNumber,
      latitude,
      longitude
    } = req.body;

    // Validate required fields
    if (!driverName || !ambulanceName || !vehicleNumber || !email || 
        !contactNumber || !password || !licenseNumber || !latitude || !longitude) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Handle image paths
    const profileImage = req.files['profileImage'] ? 
      '/uploads/ambulance/profiles/' + req.files['profileImage'][0].filename : '';
    
    const ambulanceImage = req.files['AmbulanceImage'] ? 
      '/uploads/ambulance/vehicles/' + req.files['AmbulanceImage'][0].filename : '';

    const newAmbulance = new Ambulance({
      driverName,
      ambulanceName,
      vehicleNumber,
      email,
      contactNumber,
      password,
      licenseNumber,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      },
      profileImage,
      AmbulanceImage: ambulanceImage
    });

    await newAmbulance.save();
    res.status(201).json({ message: 'Ambulance registered successfully' });
  } catch (error) {
    console.error('Signup error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        error: 'Vehicle number or email already registered' 
      });
    }
    res.status(500).json({ error: 'Failed to register ambulance' });
  }
};

exports.getRequestHistory = async (req, res) => {
  try {
    if (!req.user) return res.status(401).send('Unauthorized');
    
    const requests = await Request.find({ ambulanceId: req.user._id })
      .populate('userId', 'fullName')
      .sort({ createdAt: -1 })
      .lean();
    res.render('ambulance/request-history', { requests });
  } catch (err) {
    console.error('Error fetching request history:', err);
    res.status(500).send('Something went wrong.');
  }
};

exports.cancelRequest = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'user') return res.status(401).send('Unauthorized');
    
    const { ambulanceId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(ambulanceId)) return res.status(400).send('Invalid ambulance ID');

    const request = await Request.findOneAndUpdate(
      { userId: req.user._id, ambulanceId, status: 'pending' },
      { status: 'cancelled' },
      { new: true }
    );

    if (!request) return res.status(404).send('No pending request found');

    res.json({ success: true });
  } catch (err) {
    console.error('Cancel request error:', err);
    res.status(500).send('Failed to cancel request');
  }
};

exports.logout = (req, res) => {
  res.clearCookie('token').redirect('/ambulance/signin');
};
