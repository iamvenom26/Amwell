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
app.use('/ambulance',ambulanceRoutes );
app.use('/maps', require('./routes/maps'));
// Socket.IO Configuration
const Message = require('./model/message');
const connectedUsers = {}; // Store connected users for location tracking
io.on('connection', (socket) => {
  console.log(`🛰️ User connected: ${socket.id}`);
  let isAuthenticated = false;

  // Handle user authentication on connection
  socket.on('authenticate', ({ userId, role, fullName }) => {
    if (isAuthenticated) {
      console.log(`Already authenticated for socket ${socket.id}, ignoring`);
      return;
    }
    if (!userId || !role || !fullName) {
      console.error('Authentication failed: Missing userId, role, or fullName', { userId, role, fullName });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.error('Invalid userId:', userId);
      return;
    }
    if (!['user', 'medicalOwner','ambulance'].includes(role)) {
      console.error('Invalid role:', role);
      return;
    }
    connectedUsers[socket.id] = { userId, role, fullName };
    isAuthenticated = true;
    console.log(`Authenticated ${role}: ${fullName} (${userId})`);
  });

  // Chat: Join a specific room
  socket.on('joinRoom', ({ room }) => {
    socket.join(room);
  });

  // Chat: Handle chat messages
  socket.on('chatMessage', async ({ room, senderId, senderModel, receiverId, receiverModel, message }) => {
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
    } catch (err) {
      console.error("Error saving message:", err.message);
    }
  });

  // Chat: Handle typing indicator
  socket.on('typing', ({ room, sender }) => {
    if (!isAuthenticated) {
      console.error('Typing failed: User not authenticated', { socketId: socket.id });
      return;
    }
    if (!room || !sender) {
      console.error('Invalid typing data:', { room, sender });
      return;
    }
    socket.to(room).emit('typing', { sender });
  });

  // Location: Handle location updates
  socket.on('locationUpdate', (coords) => {
    if (!isAuthenticated) {
      console.error('Location update failed: User not authenticated', { socketId: socket.id });
      return;
    }
    const user = connectedUsers[socket.id];
    if (!user) {
      console.error('Location update failed: User not found', { socketId: socket.id });
      return;
    }
    const { lat, lng } = coords;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      console.error('Invalid coordinates:', { lat, lng });
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
    console.log(`Location update from ${user.fullName} (${user.role}): lat=${lat}, lng=${lng}`);
  });

  // Location: Handle disconnection
  socket.on('disconnect', () => {
    const user = connectedUsers[socket.id];
    if (user) {
      io.emit('userDisconnected', { userId: user.userId, role: user.role });
      delete connectedUsers[socket.id];
      console.log(`User disconnected: ${user.fullName} (${user.userId}, ${user.role})`);
    }
    console.log(`🛑 User disconnected: ${socket.id}`);
  });
});
// Start Server
server.listen(PORT, () => {
  console.log(`🚀 Server running at: http://localhost:${PORT}`);
});