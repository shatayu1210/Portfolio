const cors = require("cors");
const express = require("express");
const session = require("express-session");
require("dotenv").config();
const path = require('path');

const app = express();

/* Routes configuration */
// Import API route handlers
const customerRoutes = require("./routes/customerRouter");
const restaurantOwnerRoutes = require("./routes/restaurantOwnerRouter");
const restaurantRoutes = require("./routes/restaurantRouter");
const dishRoutes = require("./routes/dishRouter");
const orderRoutes = require("./routes/orderRouter");
const favoriteRoutes = require("./routes/favouriteRouter");
const uploadRoutes = require("./routes/uploadRouter");

// Configure static file serving for uploads
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

/* Middleware configuration */
// Configure Cross-Origin Resource Sharing
app.use(
  cors({
    origin: "http://localhost:5173", // Frontend origin
    credentials: true, // Allow session cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma']
  })
);

// Parse JSON request bodies
app.use(express.json());

// Session management configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: true, // Ensure session is saved on each request
    saveUninitialized: true, // Create session for all requests
    cookie: {
      secure: false, // Set to false for non-HTTPS local development
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 24-hour session lifespan
      sameSite: "none", // Allow cross-site cookies for frontend/backend separation
      path: '/' // Make cookie available for all paths
    },
  })
);

/* API route registration */
// Register all API routes with /api prefix
app.use("/api/customers", customerRoutes);
app.use("/api/restaurantOwners", restaurantOwnerRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/dishes", dishRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/upload", uploadRoutes);

/* Server initialization */
// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is now running on PORT: ${process.env.PORT}`);
});
