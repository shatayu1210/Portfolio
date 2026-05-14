const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { DEFAULT_PROFILE_IMAGE } = require('../utils/imageUpload');

// Function to check if password needs to be hashed
const needsPasswordHash = (password) => {
  return !password.startsWith('$2a$') && !password.startsWith('$2b$');  // Check if it's not already a bcrypt hash
};

const customerSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true
  },
  lastName: {
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
  phone: {
    type: String,
    required: true
  },
  dateOfBirth: {
    type: Date
  },
  addresses: [{
    label: {
      type: String,
      required: true
    },
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
    },
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  imageUrl: {
    type: String,
    default: DEFAULT_PROFILE_IMAGE
  },
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant'
  }]
}, {
  timestamps: true
});

// Hash password before saving
customerSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Pre-save middleware to hash password
customerSchema.pre('save', async function(next) {
  const customer = this;
  
  // Only hash the password if it has been modified (or is new)
  if (!customer.isModified('password')) return next();
  
  try {
    // Check if password needs to be hashed
    if (needsPasswordHash(customer.password)) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(customer.password, salt);
      customer.password = hash;
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
customerSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    return isMatch;
  } catch (error) {
    console.error('Error comparing passwords:', error);
    throw error;
  }
};

const Customer = mongoose.model('Customer', customerSchema);
module.exports = Customer;
