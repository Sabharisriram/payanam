require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Live tracking socket events
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // User starts trip
  socket.on('start_trip', (data) => {
    const { tripId } = data;
    socket.join(`trip_${tripId}`);
    console.log(`Trip ${tripId} started`);
  });

  // User sends location update
  socket.on('location_update', (data) => {
    const { tripId, lat, lng, timestamp } = data;
    console.log(`Location update for trip ${tripId}: ${lat}, ${lng}`);
    io.to(`trip_${tripId}`).emit('location_broadcast', {
      lat, lng, timestamp, socketId: socket.id
    });
  });

  socket.on('end_trip', (data) => {
    const { tripId } = data;
    socket.leave(`trip_${tripId}`);
    console.log(`Trip ${tripId} ended`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Payanam backend running on port ${PORT}`);
});