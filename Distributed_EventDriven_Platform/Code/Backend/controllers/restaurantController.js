const Restaurant = require('../models/restaurant');
const Dish = require('../models/dish');
const Order = require('../models/order');
const bcrypt = require('bcryptjs');

const { connectProducer, publishOrderStatus } = require('../kafka/kafkaClient');

// Ensure Kafka producer is connected when the server starts
connectProducer().catch(console.error);

// Validation functions
const validateZipCode = (zipCode) => {
  const zipRegex = /^[0-9]{5,6}$/;
  return zipRegex.test(zipCode);
};

// Formatting order status (e.g on_the_way to On The Way, new to New)
function formatStatus(status) {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Password validation function (exported for reuse)
const validatePassword = (password) => {
  const errors = [];
  if (!password || password.length < 6) errors.push('Password must be at least 6 characters long');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)');
  return errors;
};

const validateAddress = (address) => {
  const errors = [];
  
  if (!address) {
    return ['Address object is required'];
  }

  const { street, city, state, country, zipCode } = address;

  if (!street || street.length < 5) errors.push('Street address must be at least 5 characters. Example: 123 Main Street');
  if (!city || city.length < 2) errors.push('City must be at least 2 characters and contain only letters, spaces, or hyphens');
  if (!state || state.length < 2) errors.push('State must be at least 2 characters and contain only letters, spaces, or hyphens');
  if (!country || country.length < 2) errors.push('Country must be at least 2 characters and contain only letters, spaces, or hyphens');
  if (!validateZipCode(zipCode)) errors.push('Zip code must be 5-6 digits. Example: 12345');

  return errors;
};

// Check restaurant authentication status
exports.checkAuth = async (req, res) => {
  try {
    // Check if user is authenticated via jwt
    if (req.user?.id || req.user?._id && req.user?.role === 'restaurant') {
      // Find the restaurant to verify they exist in the database
      const restaurant = await Restaurant.findById(req.user?.id || req.user?._id);
      
      if (restaurant) {
        return res.json({
          isRestaurantAuthenticated: true,
          restaurant: {
            id: restaurant._id,
            name: restaurant.name,
            email: restaurant.email,
            phone: restaurant.phone,
            address: restaurant.address,
            status: restaurant.status,
            imageUrl: restaurant.imageUrl,
            offersDelivery: restaurant.offersDelivery,
            offersPickup: restaurant.offersPickup
          }
        });
      }
    }
    
    // If no valid jwt or restaurant not found
    return res.json({
      isRestaurantAuthenticated: false
    });
  } catch (error) {
    console.error('Error checking authentication:', error);
    return res.status(500).json({ 
      message: 'Error checking authentication status', 
      error: error.message 
    });
  }
};

exports.register = async (req, res) => {
  try {
    const { 
      name, 
      email, 
      password, 
      description, 
      phone, 
      address: {
        street,
        city,
        state,
        country,
        zipCode
      } = {},
      operatingHours, 
      offersPickup, 
      offersDelivery,
      priceRange,
      imageUrl
    } = req.body;

    // Validate address
    const addressErrors = validateAddress(req.body.address);
    if (addressErrors.length > 0) {
      return res.status(400).json({
        message: 'Address validation failed',
        errors: addressErrors
      });
    }
    
    // Check if restaurant already exists
    const existingRestaurant = await Restaurant.findOne({ email });
    if (existingRestaurant) {
      return res.status(400).json({ message: 'Restaurant already exists with this email' });
    }

    // Create new restaurant - password will be hashed in pre-save hook
    const restaurant = new Restaurant({
      name,
      email,
      password,
      description,
      phone,
      address: {
        street,
        city,
        state,
        country,
        zipCode
      },
      operatingHours,
      offersPickup,
      offersDelivery,
      cuisine: [],  // Starting with no cuisines as they will populate via dishes
      priceRange,
      imageUrl,
      status: 'inactive', // Start as inactive until dishes are added
      rating: 0,
      ratingCount: 0
    });

    await restaurant.save();

    res.status(201).json({
        message: 'Restaurant registered successfully',
        restaurant: {
          id: restaurant._id,
          name: restaurant.name,
          email: restaurant.email
        }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error registering restaurant', error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find restaurant
    const restaurant = await Restaurant.findOne({ email });
    if (!restaurant) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password using model method
    const isMatch = await restaurant.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Issue JWT
    const { generateToken } = require('../utils/jwt');
    const token = generateToken({ _id: restaurant._id, role: 'restaurant' });
    res.json({
        message: 'Login successful',
        token,
        restaurant: {
          id: restaurant._id,
          name: restaurant.name,
          email: restaurant.email
        }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
};

exports.getRestaurantProfile = async (req, res) => {
  try {
    const restaurantId = req.params.restaurantId;    
    const restaurant = await Restaurant.findById(restaurantId).select('-password');
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }
    
    const {
      _id, name, email, description, phone,
      imageUrl, createdAt, updatedAt, address,
      operatingHours, offersPickup, offersDelivery,
      cuisine, priceRange, status
    } = restaurant;

    const reorderedRestaurant = {
      id: _id,
      name,
      email,
      description,
      phone,
      imageUrl,
      status,
      offersPickup,
      offersDelivery,
      cuisine,
      priceRange,
      createdAt,
      updatedAt,
      address,
      operatingHours
    };

    res.json(reorderedRestaurant);

  } catch (error) {
    res.status(500).json({ message: 'Error fetching restaurant profile', error: error.message });
  }
};

exports.updateRestaurantProfile = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const updates = req.body;
    
    // Validate that the logged-in restaurant is updating their own data
    const loggedInRestaurantId = req.user?.id || req.user?._id;
    if (loggedInRestaurantId.toString() !== restaurantId.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this restaurant' });
    }
    
    // Fields that should not be updated through this endpoint
    delete updates.password; // Don't allow direct password updates through this route
    delete updates.status; // Status should be updated through a separate endpoint
    delete updates.dishes; // Dishes should be updated through a separate endpoint
    delete updates.rating; // Rating should be calculated by the database
    delete updates.ratingCount; // Rating count should be calculated by the database
    delete updates.operatingHours; // Operating hours should be updated via a separate endpoint

    // --- Password Change Logic ---
    // If both currentPassword and newPassword are provided, attempt password change
    const { currentPassword, newPassword } = req.body;
    if (currentPassword && newPassword) {
      // Validate new password
      const passwordErrors = validatePassword(newPassword);
      if (passwordErrors.length > 0) {
        return res.status(400).json({
          message: 'Invalid new password',
          errors: passwordErrors
        });
      }
      // Fetch the restaurant by ID
      const restaurant = await Restaurant.findById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ message: 'Restaurant not found' });
      }
      // Verify the current password
      const isPasswordValid = await restaurant.comparePassword(currentPassword);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }
      // Set the new password
      restaurant.password = newPassword;
      await restaurant.save();
      // Human-friendly success message
      return res.json({
        message: 'Password updated successfully.'
      });
    }

    // Validate all fields
    const validationErrors = [];

    // Validate name if provided
    if (updates.name !== undefined) {
      if (!updates.name || typeof updates.name !== 'string' || updates.name.trim().length < 2) {
        validationErrors.push('Restaurant name must be at least 2 characters long');
      }
    }

    // Validate email if provided
    if (updates.email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates.email)) {
        validationErrors.push('Invalid email format');
      }

      // Check if email is already in use by another restaurant
      if (updates.email) {
        const existingRestaurant = await Restaurant.findOne({ 
          email: updates.email,
          _id: { $ne: req.user?.id || req.user?._id } // Exclude current restaurant
        });
        
        if (existingRestaurant) {
          validationErrors.push('Email is already in use by another restaurant');
        }
      }
    }

    // Validate description if provided
    if (updates.description !== undefined) {
      if (typeof updates.description !== 'string') {
        validationErrors.push('Description must be a string');
      }
    }

    // Validate phone if provided
    if (updates.phone !== undefined) {
      const phoneRegex = /^\+?[1-9]\d{9,14}$/;
      if (!phoneRegex.test(updates.phone)) {
        validationErrors.push('Invalid phone number format. Must be 10-15 digits with optional + prefix');
      }
    }

    // Validate imageUrl if provided
    if (updates.imageUrl !== undefined && updates.imageUrl !== null) {
      if (typeof updates.imageUrl !== 'string' || !updates.imageUrl.match(/^https?:\/\/.+/)) {
        validationErrors.push('Image URL must be a valid URL starting with http:// or https://');
      }
    }

    // Validate offersPickup if provided
    if (updates.offersPickup !== undefined) {
      if (typeof updates.offersPickup !== 'boolean') {
        validationErrors.push('Offers pickup must be a boolean value');
      }
    }

    // Validate offersDelivery if provided
    if (updates.offersDelivery !== undefined) {
      if (typeof updates.offersDelivery !== 'boolean') {
        validationErrors.push('Offers delivery must be a boolean value');
      }
    }

    // Validate cuisine if provided
    if (updates.cuisine !== undefined) {
      if (!Array.isArray(updates.cuisine) || updates.cuisine.some(c => typeof c !== 'string')) {
        validationErrors.push('Cuisine must be an array of strings');
      }
    }

    // Validate priceRange if provided
    if (updates.priceRange !== undefined) {
      const validPriceRanges = ['$', '$$', '$$$', '$$$$'];
      if (!validPriceRanges.includes(updates.priceRange)) {
        validationErrors.push('Price range must be one of: $, $$, $$$, $$$$');
      }
    }

    // Validate address if it's being updated
    if (updates.address) {
      const addressErrors = validateAddress(updates.address);
      validationErrors.push(...addressErrors);
    }

    // Return validation errors if any
    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      restaurantId,
      { $set: updates },
      { new: true }
    ).select('-password');

    // Format the response to match getProfile format
    const {
      _id, name, email, description, phone, 
      imageUrl, createdAt, updatedAt, address,
      operatingHours, offersPickup, offersDelivery,
      cuisine, priceRange, status, rating, ratingCount
    } = restaurant;

    const reorderedRestaurant = {
      id: _id,
      name,
      email,
      description,
      phone,
      imageUrl,
      status,
      offersPickup,
      offersDelivery,
      rating,
      ratingCount,
      cuisine,
      priceRange,
      createdAt,
      updatedAt,
      address,
      operatingHours
    };

    res.json({
      message: 'Restaurant profile updated successfully',
      restaurant: reorderedRestaurant
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating restaurant profile', error: error.message });
  }
};

// Separate endpoint for updating operating hours
exports.updateOperatingHours = async (req, res) => {
  try {
    const { operatingHours } = req.body;
    const { restaurantId } = req.params;
    
    if (!operatingHours) {
      return res.status(400).json({ message: 'Operating hours are required' });
    }
    
    // Validate that the logged-in restaurant is updating their own data
    const loggedInRestaurantId = req.user?.id || req.user?._id;
    if (loggedInRestaurantId.toString() !== restaurantId.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this restaurant' });
    }
    
    // Validate operating hours
    const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const validationErrors = [];
    
    for (const day of daysOfWeek) {
      const dayData = operatingHours[day];
      
      if (!dayData) {
        validationErrors.push(`Missing data for ${day}`);
        continue;
      }
      
      if (dayData.isClosed !== true && dayData.isClosed !== false) {
        validationErrors.push(`isClosed must be a boolean for ${day}`);
      }
      
      if (dayData.isClosed === false) {
        if (!dayData.open || !dayData.close) {
          validationErrors.push(`Open and close times are required for ${day} when not closed`);
        } else {
          // Validate time format (HH:MM)
          const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
          if (!timeRegex.test(dayData.open)) {
            validationErrors.push(`Invalid open time format for ${day}. Use HH:MM format (e.g., 09:00)`);
          }
          if (!timeRegex.test(dayData.close)) {
            validationErrors.push(`Invalid close time format for ${day}. Use HH:MM format (e.g., 21:00)`);
          }
        }
      }
    }
    
    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: 'Operating hours validation failed',
        errors: validationErrors
      });
    }
    
    const restaurant = await Restaurant.findByIdAndUpdate(
      restaurantId,
      { $set: { operatingHours } },
      { new: true }
    ).select('-password');
    
    res.json({
      message: 'Operating hours updated successfully',
      operatingHours: restaurant.operatingHours
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating operating hours', error: error.message });
  }
};

// Logout restaurant (JWT: just tell frontend to remove token)
exports.logout = (req, res) => {
  res.json({ message: 'Logged out successfully' });
};

exports.getAllRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find({ status: 'active' }).select('-password');

    const reorderedRestaurants = restaurants.map(({ 
      _id, name, email, description, phone, status, offersPickup, 
      offersDelivery, rating, ratingCount, cuisine, priceRange, 
      imageUrl, createdAt, updatedAt, address, operatingHours 
    }) => ({
      id: _id, 
      name, 
      email, 
      description, 
      phone, 
      status, 
      offersPickup, 
      offersDelivery, 
      rating, 
      ratingCount, 
      cuisine, 
      priceRange, 
      imageUrl, 
      createdAt, 
      updatedAt,
      address,
      operatingHours
    }));

    res.json(reorderedRestaurants);

  } catch (error) {
    res.status(500).json({ message: 'Error fetching restaurants', error: error.message });
  }
};

exports.getRestaurantById = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id).select('-password');
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }
    
    // Get all dishes for this restaurant
    const dishes = await Dish.find({ restaurantId: req.params.id })
      .sort({ category: 1, name: 1 });
    
    const {
      _id, name, email, description, phone, status, offersPickup, 
      offersDelivery, rating, ratingCount, cuisine, priceRange, 
      imageUrl, createdAt, updatedAt, address, operatingHours
    } = restaurant;

    const reorderedRestaurant = {
      id: _id,
      name,
      email,
      description,
      phone,
      status,
      offersPickup,
      offersDelivery,
      rating,
      ratingCount,
      cuisine,
      priceRange,
      imageUrl,
      createdAt,
      updatedAt,
      address,
      operatingHours,
      dishes: dishes.map(dish => ({
        ...dish.toObject(),
        id: dish._id,
        _id: undefined
      }))
    };

    res.json(reorderedRestaurant);

  } catch (error) {
    res.status(500).json({ message: 'Error fetching restaurant', error: error.message });
  }
};

exports.toggleStatus = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    // Validate that the logged-in restaurant is updating their own data
    const loggedInRestaurantId = req.user?.id || req.user?._id;
    if (loggedInRestaurantId.toString() !== restaurantId.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this restaurant' });
    }
    
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }
    
    // Check if the restaurant is currently inactive and trying to become active
    if (restaurant.status === 'inactive') {
      // Count available dishes
      const availableDishCount = await Dish.countDocuments({ 
        restaurantId: restaurantId,
        isAvailable: true
      });
      
      // If trying to activate with no available dishes, prevent the change
      if (availableDishCount === 0) {
        return res.status(400).json({ 
          message: 'Cannot activate restaurant with no available dishes. Please add at least one available dish first.',
          status: restaurant.status
        });
      }
    }
    
    // Toggle status
    const newStatus = restaurant.status === 'active' ? 'inactive' : 'active';
    restaurant.status = newStatus;
    await restaurant.save();
    
    res.json({
      message: `Restaurant status updated to ${newStatus}`,
      status: newStatus
    });
  } catch (error) {
    res.status(500).json({ message: 'Error toggling restaurant status', error: error.message });
  }
};

// Toggle delivery option for restaurant
exports.toggleDelivery = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    // Validate that the logged-in restaurant is updating their own data
    const loggedInRestaurantId = req.user?.id || req.user?._id;
    if (loggedInRestaurantId.toString() !== restaurantId.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this restaurant' });
    }
    
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }
    
    // Toggle the delivery option
    restaurant.offersDelivery = !restaurant.offersDelivery;
    await restaurant.save();
    
    res.json({
      message: `Delivery option ${restaurant.offersDelivery ? 'enabled' : 'disabled'} successfully for ${restaurant.name}`,
      offersDelivery: restaurant.offersDelivery,
      email: restaurant.email,
      address: restaurant.address
    });
  } catch (error) {
    res.status(500).json({ message: 'Error toggling delivery option', error: error.message });
  }
};

// Toggle pickup option for restaurant
exports.togglePickup = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    // Validate that the logged-in restaurant is updating their own data
    const loggedInRestaurantId = req.user?.id || req.user?._id;
    if (loggedInRestaurantId.toString() !== restaurantId.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this restaurant' });
    }
    
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }
    
    // Toggle the pickup option
    restaurant.offersPickup = !restaurant.offersPickup;
    await restaurant.save();
    
    res.json({
      message: `Pickup option ${restaurant.offersPickup ? 'enabled' : 'disabled'} successfully for ${restaurant.name}`,
      offersPickup: restaurant.offersPickup,
      email: restaurant.email,
      address: restaurant.address
    });
  } catch (error) {
    res.status(500).json({ message: 'Error toggling pickup option', error: error.message });
  }
};

exports.deleteRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    // Validate that the logged-in restaurant is deleting their own account
    const loggedInRestaurantId = req.user?.id || req.user?._id;
    if (loggedInRestaurantId.toString() !== restaurantId.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this restaurant' });
    }

    // Find and delete all dishes associated with this restaurant
    await Dish.deleteMany({ restaurantId });
    
    // Find and delete the restaurant
    const deletedRestaurant = await Restaurant.findByIdAndDelete(restaurantId);

    if (!deletedRestaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    res.status(200).json({ 
  message: `Restaurant account '${deletedRestaurant.name}' and all associated dishes deleted successfully` 
});
  } catch (error) {
    console.error('Error deleting restaurant account:', error);
    res.status(500).json({ message: 'Error deleting restaurant account', error: error.message });
  }
};

// Order-related functions

// Get all orders for a restaurant
exports.getRestaurantOrders = async (req, res) => {
  try {
    const restaurantId = req.params.restaurantId;
    const { status } = req.query;
    
    // Get restaurant details
    const restaurant = await Restaurant.findById(restaurantId).select('name');
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }
    
    // Build query
    let query = { restaurantId };
    if (status) {
      query.status = status;
    }

    // Get only the necessary fields for the orders list
    const orders = await Order.find(query)
      .select({
        orderNumber: 1,
        'customerDetails.firstName': 1,
        'customerDetails.lastName': 1,
        'customerDetails.phone': 1,
        'customerDetails.email': 1,
        items: 1,
        status: 1,
        restaurantNote: 1,
        cancelledByCustomer: 1,
        isDelivery: 1,
        subtotal: 1,
        taxRate: 1,
        taxAmount: 1,
        deliveryFee: 1,
        totalAmount: 1,
        customerNote: 1,
        deliveryAddress: 1,
        createdAt: 1,
        updatedAt: 1
      })
      .sort({ createdAt: -1 });

    // Check if restaurant has any orders
    if (orders.length === 0) {
      return res.json({
        message: `No orders yet for ${restaurant.name}`,
        orders: [],
        count: 0
      });
    }

    // Transform the data to a more frontend-friendly format
    // Ensure we maintain the descending order by createdAt
    const simplifiedOrders = orders.map(order => ({
      id: order._id,
      orderNumber: order.orderNumber,
      customer: {
        name: `${order.customerDetails.firstName} ${order.customerDetails.lastName}`,
        phone: order.customerDetails.phone,
        email: order.customerDetails.email
      },
      items: order.items.map(item => ({
        name: item.name,
        size: item.size,
        price: item.price,
        quantity: item.quantity,
        totalPrice: item.price * item.quantity
      })),
      totalItems: order.items.map(item => item.quantity).reduce((a, b) => a + b, 0),
      status: order.status,
      isDelivery: order.isDelivery,
      deliveryAddress: order.deliveryAddress,
      customerNote: order.customerNote,
      restaurantNote: order.restaurantNote,
      cancelledByCustomer: order.cancelledByCustomer,
      financials: {
        subtotal: order.subtotal,
        taxRate: order.taxRate,
        taxAmount: order.taxAmount,
        deliveryFee: order.deliveryFee,
        totalAmount: order.totalAmount
      },
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }));

    res.json({
      orders: simplifiedOrders,
      count: simplifiedOrders.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
};

// Update order status from restaurant-side
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, restaurantNote } = req.body;

    const order = await Order.findOne({
      _id: orderId,
      restaurantId: req.user?.id || req.user?._id
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    const oldStatus = order.status;

    // Show error if old status matches new status
    if (oldStatus === status) {
      return res.status(400).json({
        message: 'Order status is already \'' + status + '\'. Choose another status for update.'
      })
    }

    // Defined valid statuses based on delivery type
    let validStatuses;
    if (order.isDelivery) {
      validStatuses = [
        'new',
        'received',
        'preparing',
        'on_the_way',
        'delivered',
        'cancelled'
      ];
    } else {
      validStatuses = [
        'new',
        'received',
        'preparing',
        'pickup_ready',
        'picked_up',
        'cancelled'
      ];
    }

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: `Invalid status for \'${order.isDelivery ? 'delivery' : 'pickup'}\' order`,
        validStatuses
      });
    }

    // If cancelling the order, require a note from the restaurant
    if (status === 'cancelled' && oldStatus !== 'cancelled') {
      if (!restaurantNote) {
        return res.status(400).json({ 
          message: 'A note is required when cancelling an order. Please explain the reason for cancellation to notify the customer.'
        });
      }
      
      // Set the restaurant note (required for restaurant-initiated cancellations)
      order.restaurantNote = restaurantNote;
    }

    order.status = status;
    await order.save();

    await publishOrderStatus(order, formatStatus(oldStatus), formatStatus(status));

    res.json({
      message: `Order status updated from ${oldStatus} to ${status} successfully`,
      order
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating order status', error: error.message });
  }
};

// Get order details for a restaurant
exports.getRestaurantOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const restaurantId = req.user?.id || req.user?._id;

    // Find the order with full details
    const order = await Order.findOne({
      _id: orderId,
      restaurantId
    })
      .populate('customerId', 'firstName lastName email phone')
      .populate('items.dishId');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Format the order details for better frontend consumption
    const formattedOrder = {
      id: order._id,
      orderNumber: order.orderNumber,
      customer: {
        id: order.customerId?._id || order.customerId,
        name: order.customerId ? `${order.customerId.firstName} ${order.customerId.lastName}` : 
              `${order.customerDetails.firstName} ${order.customerDetails.lastName}`,
        email: order.customerId?.email || order.customerDetails.email,
        phone: order.customerId?.phone || order.customerDetails.phone
      },
      items: order.items.map(item => ({
        id: item._id,
        dishId: item.dishId?._id || item.dishId,
        name: item.name,
        size: item.size,
        price: item.price,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        category: item.category ? item.category.split(', ') : [],
        ingredients: item.ingredients || []
      })),
      customerNote: order.customerNote,
      deliveryInfo: {
        isDelivery: order.isDelivery,
        address: order.isDelivery ? order.deliveryAddress : null
      },
      financials: {
        subtotal: order.subtotal,
        taxRate: order.taxRate,
        taxAmount: order.taxAmount,
        totalAmount: order.totalAmount
      },
      status: order.status,
      timestamps: {
        created: order.createdAt,
        updated: order.updatedAt
      }
    };

    res.json(formattedOrder);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching order details', error: error.message });
  }
};
