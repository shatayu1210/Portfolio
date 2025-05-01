const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  dishId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dish',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  size: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  totalPrice: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  ingredients: {
    type: [String],
    default: []
  },
  imageUrl: {
    type: String
  }
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  // Customer details at time of order
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  customerDetails: {
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
      required: true
    },
    phone: {
      type: String,
      required: true
    }
  },
  // Restaurant details
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  restaurantDetails: {
    name: {
      type: String,
      required: true
    },
    imageUrl: {
      type: String,
      default: null
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
    email: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    }
  },
  items: [orderItemSchema],
  subtotal: {
    type: Number,
    required: true
  },
  taxRate: {
    type: Number,
    required: true
  },
  taxAmount: {
    type: Number,
    required: true
  },
  deliveryFee: {
    type: Number,
    default: null
  },
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['new', 'received', 'preparing', 'on_the_way', 'pickup_ready', 'delivered', 'picked_up', 'cancelled'],
    default: 'new'
  },
  // --- New field to disable status dropdown if cancelled by customer ---
  cancelledByCustomer: {
    type: Boolean,
    default: null
  },
  customerNote: {
    type: String,
    maxlength: 350,
    default: ''
  },
  restaurantNote: {
    type: String,
    maxlength: 350,
    default: null
  },
  deliveryAddress: {
    label: {
      type: String,
      required: function() { return this.isDelivery; }
    },
    street: {
      type: String,
      required: function() { return this.isDelivery; }
    },
    city: {
      type: String,
      required: function() { return this.isDelivery; }
    },
    state: {
      type: String,
      required: function() { return this.isDelivery; }
    },
    country: {
      type: String,
      required: function() { return this.isDelivery; }
    },
    zipCode: {
      type: String,
      required: function() { return this.isDelivery; }
    }
  },
  isDelivery: {
    type: Boolean,
    required: true
  }
}, {
  timestamps: true
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
