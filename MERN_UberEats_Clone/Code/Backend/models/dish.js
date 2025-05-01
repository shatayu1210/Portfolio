const mongoose = require('mongoose');

const dishSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  sizes: [
    {
      size: {
        type: String,
        required: true
      },
      price: {
        type: Number,
        required: true
      }
    }
  ],
  category: {
    type: [String],
    required: true,
    validate: {
      validator: function(v) {
        return v.length > 0;
      },
      message: 'At least one category must be selected'
    }
  },
  ingredients: {
    type: [String],
    default: []
  },
  imageUrl: {
    type: String,
    default: null
  },
  isAvailable: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const Dish = mongoose.model('Dish', dishSchema);
module.exports = Dish;