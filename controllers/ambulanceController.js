const Ambulance = require('../model/ambulance');
const { createTokenForUser } = require('../service/authentication');
const Message = require('../model/message');
const User = require('../model/user');
const mapService = require('../service/maps');


exports.renderSignupPage = (req, res) => {
  res.render('ambulance/signup');
};

exports.renderSigninPage = (req, res) => {
  res.render('ambulance/signin');
};

exports.signup = async (req, res) => {
  try {
    const newAmbulance = await Ambulance.create(req.body);
    res.redirect('/ambulance/signin');
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).send('Error during signup');
  }
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
    const ambulance = req.user;
    if (!ambulance || ambulance.role !== 'ambulance') {
      return res.status(401).send('Unauthorized');
    }

    // Fetch users who have sent messages to the ambulance
    const messages = await Message.find({
      receiver: ambulance._id,
      receiverModel: 'Ambulance',
    }).distinct('sender');

    const users = await User.find({
      _id: { $in: messages },
    }).lean();

    res.render('ambulance/dashboard', {
      ambulance,
      users: users || [],
      requests: [], // Add your request logic here
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).send('Server error');
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

exports.handleGetRealtimeChat = async (req, res) => {
  try {
    const currentUser = req.user;
    const receiverId = req.params.userId;

    const messages = await Message.find({
      $or: [
        { sender: currentUser._id, receiver: receiverId },
        { sender: receiverId, receiver: currentUser._id }
      ]
    }).sort('timestamp');

    const room = [currentUser._id, receiverId].sort().join('_');

    res.render('realtime-chat', {
      messages,
      currentUser,
      receiverId,
      room
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).send('Error loading chat');
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

    const messages = await Message.find({
      $or: [
        { sender: currentUser._id, receiver: receiverId },
        { sender: receiverId, receiver: currentUser._id }
      ]
    }).sort('timestamp');

    const room = [currentUser._id, receiverId].sort().join('_');

    res.render('realtime-chat', {
      messages,
      currentUser,
      receiverId,
      room
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).send('Error loading chat');
  }
};