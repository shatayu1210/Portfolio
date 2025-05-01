// Importing required modules
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('passport');
const http = require('http');
const { Server } = require('socket.io');

// Media upload config
const fileUpload = require('express-fileupload');
const cloudinary = require('./config/cloudinary');

// Importing routes
const customerRouter = require('./routes/customerRouter');
const restaurantRouter = require('./routes/restaurantRouter');
const dishRouter = require('./routes/dishRouter');
const ratingRouter = require('./routes/ratingRouter');
const addressRouter = require('./routes/addressRouter');
require('dotenv').config();

// Import and start Kafka consumers so they runs with the backend server
const { startRestaurantOrderConsumer } = require('./kafka/restaurantOrderConsumer');
const { startCustomerOrderStatusConsumer } = require('./kafka/customerOrderStatusConsumer');
const { startOrderCancelConsumer } = require('./kafka/orderCancelConsumer');

// Express app setup
const app = express();
const server = http.createServer(app);

// Websocket for real-time communication
const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

// Middleware
app.set('io', io);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
    useTempFiles: true,
    tempFileDir: '/tmp/',
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
}));

app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma']
}));

// Passport JWT authentication setup
const { configurePassport } = require('./utils/passport');
configurePassport();
app.use(passport.initialize());

// Routes
app.use('/api/customers', customerRouter);
app.use('/api/restaurants', restaurantRouter);
app.use('/api/dishes', dishRouter);
app.use('/api/ratings', ratingRouter);
app.use('/api/location', addressRouter);

// Initializing services and starting our backend server
Promise.all([
    // Testing connections
    mongoose.connect(process.env.MONGODB_URI),
    cloudinary.api.ping()
])
.then(() => {
    console.log('Connected to MongoDB');
    console.log('Connected to Cloudinary');

    // Start the Kafka consumer to receive customer orders
    startRestaurantOrderConsumer(io)
      .then(() => console.log('Restaurant Kafka consumer started'))
      .catch((err) => console.error('Failed to start restaurant Kafka consumer:', err));

    startCustomerOrderStatusConsumer(io)
      .then(() => console.log('Customer Kafka consumer started'))
      .catch((err) => console.error('Failed to start order status Kafka consumer:', err));

    // Start the Kafka consumer to receive order cancellations
    startOrderCancelConsumer(io)
      .then(() => console.log('Order Cancel Kafka consumer started'))
      .catch((err) => console.error('Failed to start order cancel Kafka consumer:', err));
    
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is running on port ${PORT}`);
    });
})
.catch((error) => {
    console.error('Startup error:', error.message || error);
    process.exit(1); // Exit app if MongoDB, Cloudinary, or Kafka Consumer fail to connect
});

module.exports = app;