const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant'
  }]
});

module.exports = mongoose.model('Favorite', favoriteSchema);
