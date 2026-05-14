const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const restaurantSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  description: { 
    type: String, 
    required: true 
  },
  phone: { 
    type: String, 
    required: true 
  },
  address: {
    street: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true
    },
    zipCode: {
      type: String,
      required: true
    }
  },
  operatingHours: {
    monday: {
      open: String,
      close: String,
      isClosed: { type: Boolean, default: false }
    },
    tuesday: {
      open: String,
      close: String,
      isClosed: { type: Boolean, default: false }
    },
    wednesday: {
      open: String,
      close: String,
      isClosed: { type: Boolean, default: false }
    },
    thursday: {
      open: String,
      close: String,
      isClosed: { type: Boolean, default: false }
    },
    friday: {
      open: String,
      close: String,
      isClosed: { type: Boolean, default: false }
    },
    saturday: {
      open: String,
      close: String,
      isClosed: { type: Boolean, default: false }
    },
    sunday: {
      open: String,
      close: String,
      isClosed: { type: Boolean, default: false }
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'inactive'
  },
  offersPickup: { 
    type: Boolean, 
    default: false 
  },
  offersDelivery: { 
    type: Boolean, 
    default: false 
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  ratingCount: {
    type: Number,
    default: 0
  },
  cuisine: {
    type: [String],
    default: []
  },
  priceRange: {
    type: String,
    enum: ['$', '$$', '$$$', '$$$$'],
    default: '$'
  },
  imageUrl: { 
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Hash password before saving
restaurantSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Function to check if password needs to be hashed
const needsPasswordHash = (password) => {
  return !password.startsWith('$2a$') && !password.startsWith('$2b$');  // Check if it's not already a bcrypt hash
};

// Pre-save middleware to hash password
restaurantSchema.pre('save', async function(next) {
  const restaurant = this;
  
  // Only hash the password if it has been modified (or is new)
  if (!restaurant.isModified('password')) return next();
  
  try {
    // Check if password needs to be hashed
    if (needsPasswordHash(restaurant.password)) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(restaurant.password, salt);
      restaurant.password = hash;
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
restaurantSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    return isMatch;
  } catch (error) {
    console.error('Error comparing restaurant passwords:', error);
    throw error;
  }
};

const Restaurant = mongoose.model('Restaurant', restaurantSchema);
module.exports = Restaurant;
