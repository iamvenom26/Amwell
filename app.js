const express = require('express');
const mongoose = require('mongoose');
const userRoutes = require('./routes/user');
const medicalAuthRoutes = require('./routes/medicalAuth');
const path = require('path');
const { checkForAthenticationCookie } = require('./middleware/authetication');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');
const ambulanceRoutes = require('./routes/ambulanceAuth');
const Request = require('./model/request');
const Ambulance = require('./model/ambulance');
const mapController= require('./routes/maps')
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 128;

// MongoDB Connection
mongoose
  .connect('mongodb://localhost:27017/amwelllu')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// Middleware Setup
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(checkForAthenticationCookie('token'));

app.set('view engine', 'ejs');
app.set('views', path.resolve('./views'));

// Routes
app.get('/', (req, res) => {
  res.render('user/main', { user: req.user });
});

app.use('/user', userRoutes);
app.use('/medical', medicalAuthRoutes);
app.use('/ambulance', ambulanceRoutes);
app.use('/maps', mapController);

// Socket.IO Configuration
const Message = require('./model/message');
const connectedUsers = {};

io.on('connection', (socket) => {
  console.log(`🛰️ Socket connected: ${socket.id}`);
  let isAuthenticated = false;

  socket.on('authenticate', ({ userId, role, fullName }) => {
    if (isAuthenticated) {
      console.log(`[Socket ${socket.id}] Already authenticated, ignoring repeat attempt`);
      return;
    }
    if (!userId || !role) {
      console.error(`[Socket ${socket.id}] Authentication failed: Missing userId or role`, { userId, role, fullName });
      socket.emit('authError', { message: 'Authentication failed: Missing required fields' });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.error(`[Socket ${socket.id}] Authentication failed: Invalid userId`, { userId });
      socket.emit('authError', { message: 'Authentication failed: Invalid userId' });
      return;
    }
    if (!['user', 'medicalOwner', 'ambulance'].includes(role)) {
      console.error(`[Socket ${socket.id}] Authentication failed: Invalid role`, { role });
      socket.emit('authError', { message: 'Authentication failed: Invalid role' });
      return;
    }
    connectedUsers[socket.id] = { userId, role, fullName: fullName || 'Unknown' };
    isAuthenticated = true;
    console.log(`[Socket ${socket.id}] Authenticated ${role}: ${fullName || 'Unknown'} (${userId})`);
    console.log('[Server] Current connectedUsers:', Object.keys(connectedUsers).map(id => ({
      socketId: id,
      ...connectedUsers[id]
    })));
    socket.emit('authSuccess', { message: 'Authentication successful' });
  });

  socket.on('joinRoom', ({ room }) => {
    if (!isAuthenticated) {
      console.error(`[Socket ${socket.id}] Join room failed: Not authenticated`);
      return;
    }
    socket.join(room);
    console.log(`[Socket ${socket.id}] Joined room: ${room}`);
  });

  socket.on('chatMessage', async ({ room, senderId, senderModel, receiverId, receiverModel, message }) => {
    if (!isAuthenticated) {
      console.error(`[Socket ${socket.id}] Chat message failed: Not authenticated`);
      return;
    }
    try {
      const newMsg = await Message.create({
        sender: senderId,
        senderModel,
        receiver: receiverId,
        receiverModel,
        message,
      });
      io.to(room).emit('chatMessage', {
        senderId,
        senderModel,
        message,
        timestamp: newMsg.timestamp,
      });
      console.log(`[Socket ${socket.id}] Chat message sent to room ${room}: ${message}`);
    } catch (err) {
      console.error(`[Socket ${socket.id}] Error saving message:`, err.message);
    }
  });

  socket.on('typing', ({ room, sender }) => {
    if (!isAuthenticated) {
      console.error(`[Socket ${socket.id}] Typing failed: Not authenticated`);
      return;
    }
    if (!room || !sender) {
      console.error(`[Socket ${socket.id}] Invalid typing data:`, { room, sender });
      return;
    }
    socket.to(room).emit('typing', { sender });
    console.log(`[Socket ${socket.id}] Typing indicator sent to room ${room} by ${sender}`);
  });

  socket.on('locationUpdate', (coords) => {
    if (!isAuthenticated) {
      console.error(`[Socket ${socket.id}] Location update failed: Not authenticated`);
      return;
    }
    const user = connectedUsers[socket.id];
    if (!user) {
      console.error(`[Socket ${socket.id}] Location update failed: User not found`);
      return;
    }
    const { lat, lng } = coords;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      console.error(`[Socket ${socket.id}] Invalid coordinates:`, { lat, lng });
      return;
    }
    connectedUsers[socket.id] = { ...user, lat, lng };
    socket.broadcast.emit('userMoved', {
      userId: user.userId,
      role: user.role,
      fullName: user.fullName,
      lat,
      lng,
    });
    console.log(`[Socket ${socket.id}] Location update from ${user.fullName} (${user.role}): lat=${lat}, lng=${lng}`);
  });

  socket.on('updateStatus', async ({ ambulanceId, status }) => {
    if (!isAuthenticated) {
      console.error(`[Socket ${socket.id}] Update status failed: Not authenticated`);
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(ambulanceId) || !['ONLINE', 'BUSY', 'OFFLINE'].includes(status)) {
      console.error(`[Socket ${socket.id}] Update status failed: Invalid ambulanceId or status`, { ambulanceId, status });
      socket.emit('statusError', { message: 'Invalid ambulanceId or status' });
      return;
    }
    try {
      const ambulance = await Ambulance.findByIdAndUpdate(
        ambulanceId,
        { status },
        { new: true }
      );
      console.log(`[Socket ${socket.id}] Updated ambulance status: ${status} for ${ambulanceId}`);
      socket.emit('statusUpdated', { status: ambulance.status });
      socket.broadcast.emit('ambulanceStatusChanged', { ambulanceId, status });
    } catch (err) {
      console.error(`[Socket ${socket.id}] Error updating status:`, err.message);
      socket.emit('statusError', { message: 'Failed to update status' });
    }
  });

  socket.on('requestAmbulance', async ({ ambulanceId, userId, userName, userAddress, userLocation }) => {
    if (!isAuthenticated) {
      console.error(`[Socket ${socket.id}] Request ambulance failed: Not authenticated`);
      socket.emit('requestError', { message: 'Request failed: User not authenticated' });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(ambulanceId) || !mongoose.Types.ObjectId.isValid(userId)) {
      console.error(`[Socket ${socket.id}] Request ambulance failed: Invalid ambulanceId or userId`, { ambulanceId, userId });
      socket.emit('requestError', { message: 'Request failed: Invalid ambulanceId or userId' });
      return;
    }
    if (!userAddress || !userLocation || !userLocation.lat || !userLocation.lng) {
      console.error(`[Socket ${socket.id}] Request ambulance failed: Missing required fields`, { userName, userAddress, userLocation });
      socket.emit('requestError', { message: 'Request failed: Missing required fields' });
      return;
    }
    const effectiveUserName = userName || 'Unknown User';
    console.log(`[Socket ${socket.id}] Ambulance request received from user ${effectiveUserName} (${userId}) for ambulance ${ambulanceId}`);

    try {
      // Create a new request in the database
      const request = await Request.create({
        userId,
        userName: effectiveUserName,
        ambulanceId,
        userAddress,
        userLocation,
        status: 'pending'
      });

      let ambulanceFound = false;
      for (const [socketId, user] of Object.entries(connectedUsers)) {
        if (user.userId === ambulanceId && user.role === 'ambulance') {
          io.to(socketId).emit('newAmbulanceRequest', {
            userId,
            userName: effectiveUserName,
            userAddress,
            userLocation,
            requestId: request._id.toString(),
          });
          console.log(`[Server] Notified ambulance owner (${ambulanceId}) on socket ${socketId} about request from ${effectiveUserName} (${userId})`);
          ambulanceFound = true;
          break;
        }
      }
      if (!ambulanceFound) {
        console.error(`[Socket ${socket.id}] Ambulance owner (${ambulanceId}) not found or not connected`);
        await Request.findByIdAndUpdate(request._id, { status: 'rejected' });
        for (const [socketId, user] of Object.entries(connectedUsers)) {
          if (user.userId === userId && user.role === 'user') {
            io.to(socketId).emit('ambulanceResponse', {
              status: 'rejected',
              message: 'Ambulance is not available at the moment.',
              requestId: request._id.toString(),
            });
            console.log(`[Server] Notified user (${userId}) on socket ${socketId} that ambulance is unavailable`);
            break;
          }
        }
      }
    } catch (err) {
      console.error(`[Socket ${socket.id}] Error saving request:`, err.message);
      socket.emit('requestError', { message: 'Failed to process request' });
    }
  });

  socket.on('respondToRequest', async ({ userId, status, requestId }) => {
    if (!isAuthenticated) {
      console.error(`[Socket ${socket.id}] Respond to request failed: Not authenticated`);
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(userId) || !['accepted', 'rejected'].includes(status) || !requestId) {
      console.error(`[Socket ${socket.id}] Respond to request failed: Invalid userId, status, or requestId`, { userId, status, requestId });
      return;
    }
    console.log(`[Socket ${socket.id}] Ambulance owner responded with status "${status}" for user ${userId}, requestId: ${requestId}`);

    try {
      const request = await Request.findByIdAndUpdate(
        requestId,
        { status },
        { new: true }
      );
      if (!request) {
        console.error(`[Socket ${socket.id}] Request not found: ${requestId}`);
        return;
      }

      if (status === 'accepted') {
        await Ambulance.findByIdAndUpdate(request.ambulanceId, { status: 'BUSY' });
      }

      let userFound = false;
      for (const [socketId, user] of Object.entries(connectedUsers)) {
        if (user.userId === userId && user.role === 'user') {
          io.to(socketId).emit('ambulanceResponse', {
            status,
            message: status === 'accepted' ? 'Ambulance is on the way!' : 'Request rejected by ambulance.',
            requestId,
          });
          console.log(`[Server] Notified user (${userId}) on socket ${socketId} about response for requestId: ${requestId}`);
          userFound = true;
          break;
        }
      }
      if (!userFound) {
        console.error(`[Socket ${socket.id}] User (${userId}) not found or not connected for requestId: ${requestId}`);
      }
    } catch (err) {
      console.error(`[Socket ${socket.id}] Error updating request:`, err.message);
    }
  });

  socket.on('disconnect', () => {
    const user = connectedUsers[socket.id];
    if (user) {
      io.emit('userDisconnected', { userId: user.userId, role: user.role });
      delete connectedUsers[socket.id];
      console.log(`[Socket ${socket.id}] User disconnected: ${user.fullName} (${user.userId}, ${user.role})`);
      console.log('[Server] Current connectedUsers:', Object.keys(connectedUsers).map(id => ({
        socketId: id,
        ...connectedUsers[id]
      })));
    }
    console.log(`🛑 Socket disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running at: http://localhost:${PORT}`);
});