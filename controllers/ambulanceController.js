const Ambulance = require('../model/ambulance');
const { createTokenForUser } = require('../service/authentication');
const Message = require('../model/message');
const User = require('../model/user');
const mapService = require('../service/maps');
const Request = require('../model/request');

exports.renderSignupPage = (req, res) => {
  res.render('ambulance/signup');
};

exports.renderSigninPage = (req, res) => {
  res.render('ambulance/signin');
};


exports.signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const ambulance = await Ambulance.findOne({ email });
    if (!ambulance) {
      return res.status(404).json({ message: 'Ambulance not found' });
    }

    const isMatch = await ambulance.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    const token = createTokenForUser(ambulance); // Token includes role
    res.cookie('token', token, { httpOnly: true });
    res.redirect('/ambulance/dashboard');
  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).send('Error during signin');
  }
};

exports.getDashboard = async (req, res) => {
  try {
    // Fetch the authenticated ambulance
    const ambulance = await Ambulance.findById(req.user._id).lean();
    if (!ambulance) {
      console.error('Ambulance not found for ID:', req.user._id);
      return res.status(404).send('Ambulance not found');
    }

    // Fetch active requests for the ambulance
    const requests = await Request.find({
      ambulanceId: req.user._id,
      status: { $in: ['pending', 'accepted'] }
    })
      .lean()
      .select('userId userName userAddress userLocation status _id')
      .catch(err => {
        console.error('Error fetching requests:', err);
        return []; // Return empty array on query failure
      });

    // Ensure requests is always an array
    const validRequests = Array.isArray(requests) ? requests.filter(
      req => req && req.userId && req.userName && req.status
    ) : [];

    console.log('Fetched requests:', validRequests); // Debug log

    // Render dashboard with ambulance and requests
    res.render('ambulance/dashboard', {
      ambulance,
      requests: validRequests
    });
  } catch (error) {
    console.error('Error in getDashboard:', error);
    res.status(500).send('Something went wrong.');
  }
};

exports.toggleStatus = async (req, res) => {
  try {
    const ambulance = await Ambulance.findById(req.user._id);
    const statusFlow = {
      'ONLINE': 'BUSY',
      'BUSY': 'OFFLINE',
      'OFFLINE': 'ONLINE'
    };
    ambulance.status = statusFlow[ambulance.status] || 'ONLINE';
    await ambulance.save();
    res.json({ success: true, status: ambulance.status });
  } catch (err) {
    console.error('Status toggle error:', err);
    res.status(500).json({ success: false });
  }
};



exports.getLiveLocationData = async (req, res) => {
  try {
    const { userId } = req.params;
    const ambulance = req.user;

    if (!ambulance || ambulance.role !== 'ambulance') {
      return res.status(401).send('Unauthorized');
    }

    const user = await User.findById(userId).lean();
    if (!user || !user.location) {
      return res.status(404).send('User location not found');
    }

    const distanceTime = await mapService.getDistanceTime(
      `${ambulance.location.coordinates[1]},${ambulance.location.coordinates[0]}`,
      `${user.location.coordinates[1]},${user.location.coordinates[0]}`
    );

    res.json({
      ambulanceLocation: ambulance.location,
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
    const currentUser = req.user;
    const receiverId = req.params.userId;

    if (!currentUser || currentUser.role !== 'ambulance') {
      return res.status(401).send('Unauthorized');
    }

    const receiver = await User.findById(receiverId).lean();
    if (!receiver) {
      return res.status(404).send('User not found');
    }

    // Generate a room name based on the ambulance and user IDs
    const room = [currentUser._id, receiver._id].sort().join('_');

    // Fetch messages between the ambulance and the user
    const messages = await Message.find({
      $or: [
        { sender: currentUser._id, receiver: receiver._id },
        { sender: receiver._id, receiver: currentUser._id },
      ],
    }).sort('timestamp');

    res.render('realtime-chat', {
      receiver,
      receiverRole: 'User',
      messages,
      currentUser,
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
    const { driverName, ambulanceName, vehicleNumber, email, contactNumber, password, licenseNumber, latitude, longitude } = req.body;

    // Validate required fields
    if (!driverName || !ambulanceName || !vehicleNumber || !email || !contactNumber || !password || !licenseNumber) {
      return res.status(400).send('All fields are required');
    }

    // Validate latitude and longitude
    if (!latitude || !longitude) {
      return res.status(400).send('Latitude and longitude are required');
    }

    // Create a new ambulance document
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
        coordinates: [parseFloat(longitude), parseFloat(latitude)], // [longitude, latitude]
      },
    });

    await newAmbulance.save();
    res.status(201).send('Ambulance registered successfully');
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).send('Failed to register ambulance');
  }
};

exports.getRequestHistory = async (req, res) => {
  try {
      const ambulanceId = req.user._id;
      const requests = await Request.find({ ambulanceId })
          .populate('userId', 'fullName')
          .sort({ createdAt: -1 })
          .lean();
      res.render('ambulance/request-history', { requests });
  } catch (err) {
      console.error('Error fetching request history:', err);
      res.status(500).send('Something went wrong.');
  }
};