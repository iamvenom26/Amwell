const User = require('../model/user');
const MedicalOwner = require('../model/medical');
const Message = require('../model/message');
const mongoose = require('mongoose');
// Render Login Page
exports.renderSignInPage = (req, res) => {
  res.render('login', { error: null });
};

// Handle Login
exports.handleSignIn = async (req, res) => {
  const { email, password } = req.body;
  try {
    const token = await User.matchPasswordAndGenerateToken(email, password);
    res.cookie('token', token).redirect('/');
  } catch (error) {
    console.error('Login error:', error);
    res.render('login', { error: 'Incorrect Email or Password' });
  }
};

// Handle Sign Up
exports.handleSignUp = async (req, res) => {
  const { FullName, email, password, mobileNumber, liveLocation } = req.body;
  console.log('Received signup data:', req.body);
  try {
    const user = await User.create({ FullName, email, password, mobileNumber, liveLocation });
    console.log('User created:', user);
    res.redirect('/user/signin');
  } catch (error) {
    console.error('Signup error:', error);
    res.render('login', { error: 'User registration failed. Try again!' });
  }
};

// Logout
exports.handleLogout = (req, res) => {
  res.clearCookie('token').redirect('/');
};

// Upload Profile Photo
exports.handleProfilePhotoUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const profileImagePath = `/uploads/profiles/${req.file.filename}`;

    await User.findByIdAndUpdate(req.user._id, {
      profileImage: profileImagePath,
    });

    res.json({
      success: true,
      message: 'Profile photo updated successfully',
      imageUrl: profileImagePath,
    });
  } catch (error) {
    console.error('Profile photo upload error:', error);
    res.status(500).json({ error: 'Failed to update profile photo' });
  }
};

/////////////////////////
// Function to save the message between user and medical owner
exports.saveMessage = async (sender, receiver, messageContent, senderModel, receiverModel) => {
  try {
    const message = new Message({
      sender: sender._id,
      senderModel: senderModel, 
      receiver: receiver._id,
      receiverModel: receiverModel, 
      message: messageContent,
    });

    await message.save();
    console.log('Message saved successfully');
  } catch (err) {
    console.error('Error saving message:', err);
  }
};

// Route for handling chat and saving messages
exports.handleGetRealtimeChat = async (req, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      console.error('Unauthorized: No currentUser in req.user');
      return res.status(401).send('Unauthorized');
    }
    console.log(`Current user: ${currentUser._id} (${currentUser.role})`);

    const receiverId = req.params.userId;
    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      console.error('Invalid receiverId:', receiverId);
      return res.status(400).send('Invalid user ID');
    }

    // Determine sender model
    const currentRole = currentUser.role?.toLowerCase() === 'user' ? 'User' : 'MedicalOwner';

    // Find receiver
    let receiver = await User.findById(receiverId).lean();
    let receiverRole = 'User';

    if (!receiver) {
      receiver = await MedicalOwner.findById(receiverId).lean();
      if (receiver) receiverRole = 'MedicalOwner';
    }

    if (!receiver) {
      console.error('Receiver not found:', receiverId);
      return res.status(404).send('Receiver not found');
    }
    console.log(`Receiver: ${receiver._id} (${receiverRole})`);

    // Generate room name
    const room = [String(currentUser._id), String(receiver._id)].sort().join('_');
    console.log(`Chat room: ${room}`);

    // Fetch messages
    const messages = await Message.find({
      $or: [
        { sender: currentUser._id, receiver: receiver._id },
        { sender: receiver._id, receiver: currentUser._id },
      ],
    }).sort('timestamp');

    // Save message if provided
    if (req.body.messageContent) {
      await exports.saveMessage(
        currentUser,
        receiver,
        req.body.messageContent,
        currentRole,
        receiverRole
      );
    }

    res.render('realtime-chat', {
      receiver,
      receiverRole,
      messages,
      currentUser,
      currentRole,
      room,
      receiverId,
    });
  } catch (err) {
    console.error('❌ Error in handleGetRealtimeChat:', err.message);
    res.status(500).send('Something went wrong');
  }
};


exports.getAllUsersExceptCurrent = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    const users = await User.find({ _id: { $ne: currentUserId } }); // Exclude current user

    res.render('users', { users });
  } catch (error) {
    console.error('⚠️ Error fetching users:', error.message);
    res.status(500).send('Something went wrong while fetching users.');
  }
};

exports.renderChatPage = (req, res) => {
  res.render('chat', { userMessage: null, botResponse: null });
};

// Handle Chatbot Interaction with Gemini API
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Hardcoded bot ID (replace with your own valid ObjectId)
const BOT_ID = '68054983ad610e5b2891cdc8'; // Example ObjectId

exports.handleGeminiChat = async (req, res) => {
  const userMessage = req.body.message;
  const currentUser = req.user;

  if (!currentUser) {
    return res.status(401).send('Unauthorized');
  }

  try {
    // Save user's message
    if (userMessage) {
      await Message.create({
        sender: currentUser._id,
        senderModel: 'User',
        receiver: BOT_ID,
        receiverModel: 'MedicalOwner',
        message: userMessage,
      });
    }

    // Get bot response
    let botResponse = '';
    if (userMessage) {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-001' });
      const result = await model.generateContent(userMessage);
      botResponse = result.response.text();

      // Clean and sanitize
      botResponse = botResponse.replace(/\n{3,}/g, '\n\n').trim();
      const htmlResponse = marked(botResponse);
      botResponse = sanitizeHtml(htmlResponse, {
        allowedTags: ['p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'strong', 'em', 'a', 'code', 'pre', 'blockquote', 'span', 'div'],
        allowedAttributes: { a: ['href', 'target', 'rel'], code: ['class'] },
        allowedClasses: { code: ['language-*'] },
        selfClosing: ['br'],
        allowedSchemes: ['http', 'https'],
        transformTags: {
          a: (tagName, attribs) => ({
            tagName: 'a',
            attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' },
          }),
        },
      });

      // Save bot's response
      await Message.create({
        sender: BOT_ID,
        senderModel: 'MedicalOwner',
        receiver: currentUser._id,
        receiverModel: 'User',
        message: botResponse,
      });
    }

    // Fetch conversation history
    const messages = await Message.find({
      $or: [
        { sender: currentUser._id, receiver: BOT_ID },
        { sender: BOT_ID, receiver: currentUser._id },
      ],
    }).sort('timestamp');

    res.render('chat', {
      userMessage,
      botResponse,
      messages,
      currentUser,
      bot: { fullName: 'Amwell Bot', _id: BOT_ID },
    });

  } catch (error) {
    console.error('⚠️ Error in handleGeminiChat:', error.message);
    res.render('chat', {
      userMessage,
      botResponse: '<p>⚠️ Something went wrong.</p>',
      messages: [],
      currentUser,
      bot: { fullName: 'Amwell Bot', _id: BOT_ID },
    });
  }
};

exports.renderChatPage = async (req, res) => {
  const currentUser = req.user;
  if (!currentUser) {
    return res.status(401).send('Unauthorized');
  }

  try {
    // Fetch conversation history
    const messages = await Message.find({
      $or: [
        { sender: currentUser._id, receiver: BOT_ID },
        { sender: BOT_ID, receiver: currentUser._id },
      ],
    }).sort('timestamp');

    res.render('chat', {
      userMessage: null,
      botResponse: null,
      messages,
      currentUser,
      bot: { fullName: 'Amwell Bot', _id: BOT_ID },
    });
  } catch (error) {
    console.error('⚠️ Error rendering chat page:', error.message);
    res.render('chat', {
      userMessage: null,
      botResponse: null,
      messages: [],
      currentUser,
      bot: { fullName: 'Amwell Bot', _id: BOT_ID },
    });
  }
};

// In user.js
exports.getLiveMap = (req, res) => {
  const currentUser = req.user;
  if (!currentUser) {
    return res.status(401).send('Unauthorized');
  }
  res.render('map', { user: currentUser });
};


exports.getNearMedical = async (req, res) => {
  const { lat = 21.25, lng = 78.27 } = req.query; // fallback to Amravati

  try {
    const stores = await MedicalOwner.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
         // $maxDistance: 50000 // within 50 km
        }
      }
    });

    res.render('medical-list', { stores });
  } catch (err) {
    console.error('GeoQuery error:', err);
    res.status(500).send('Something went wrong.');
  }
};
// In user.js (add after handleGeminiChat)
exports.clearChatbot = async (req, res) => {
  const currentUser = req.user;
  const BOT_ID = '68054983ad610e5b2891cdc8'; // Match your BOT_ID

  if (!currentUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await Message.deleteMany({
      $or: [
        { sender: currentUser._id, receiver: BOT_ID },
        { sender: BOT_ID, receiver: currentUser._id },
      ],
    });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('⚠️ Error clearing chatbot history:', error.message);
    res.status(500).json({ error: 'Failed to clear chat' });
  }
};