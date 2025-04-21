const express = require('express');
const mongoose = require('mongoose');
const userRoutes = require('./routes/user');
const medicalAuthRoutes = require('./routes/medicalAuth');
const path = require('path');
const { checkForAthenticationCookie } = require('./middleware/authetication');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');

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
  res.render('main', { user: req.user });
});

app.use('/user', userRoutes);
app.use('/medical', medicalAuthRoutes);

// Socket.IO Configuration
const Message = require('./model/message');
const connectedUsers = {}; // Store connected users for location tracking

io.on('connection', (socket) => {
  console.log(`🛰️ User connected: ${socket.id}`);

  // Chat: Join a specific room
  socket.on('joinRoom', ({ room }) => {
    socket.join(room);
    console.log(`User ${socket.id} joined room: ${room}`);
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
      console.error('❌ Error saving message:', err.message);
    }
  });

  // Chat: Handle typing indicator
  socket.on('typing', ({ room, sender }) => {
    socket.to(room).emit('typing', { sender });
  });

  // Location: Handle location updates
  socket.on('locationUpdate', (coords) => {
    const { userId, fullName, lat, lng } = coords;
    connectedUsers[socket.id] = { userId, fullName, lat, lng };
    // Broadcast to other clients
    socket.broadcast.emit('userMoved', { userId, fullName, lat, lng });
    console.log(`Location update from ${fullName}: lat=${lat}, lng=${lng}`);
  });

  // Location: Handle disconnection
  socket.on('disconnect', () => {
    const user = connectedUsers[socket.id];
    if (user) {
      io.emit('userDisconnected', user.userId);
      delete connectedUsers[socket.id];
      console.log(`User disconnected: ${user.fullName} (${user.userId})`);
    }
    console.log(`🛑 User disconnected: ${socket.id}`);
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`🚀 Server running at: http://localhost:${PORT}`);
});