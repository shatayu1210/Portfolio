const Customer = require('../models/customer');
const Order = require('../models/order');
const Restaurant = require('../models/restaurant');
const Dish = require('../models/dish');
const { uploadImage } = require('../utils/imageUpload');

const bcrypt = require('bcryptjs');

const { connectProducer, publishOrder, publishOrderCancel } = require('../kafka/kafkaClient');

// Ensure Kafka producer is connected when the server starts
connectProducer().catch(console.error);

// Tax rates by state (in percentage)
const STATE_TAX_RATES = {
  'Alabama': 4.0,
  'Alaska': 0.0,
  'Arizona': 5.6,
  'Arkansas': 6.5,
  'California': 7.25,
  'Colorado': 2.9,
  'Connecticut': 6.35,
  'Delaware': 0.0,
  'Florida': 6.0,
  'Georgia': 4.0,
  'Hawaii': 4.0,
  'Idaho': 6.0,
  'Illinois': 6.25,
  'Indiana': 7.0,
  'Iowa': 6.0,
  'Kansas': 6.5,
  'Kentucky': 6.0,
  'Louisiana': 4.45,
  'Maine': 5.5,
  'Maryland': 6.0,
  'Massachusetts': 6.25,
  'Michigan': 6.0,
  'Minnesota': 6.875,
  'Mississippi': 7.0,
  'Missouri': 4.225,
  'Montana': 0.0,
  'Nebraska': 5.5,
  'Nevada': 6.85,
  'New Hampshire': 0.0,
  'New Jersey': 6.625,
  'New Mexico': 5.125,
  'New York': 4.0,
  'North Carolina': 4.75,
  'North Dakota': 5.0,
  'Ohio': 5.75,
  'Oklahoma': 4.5,
  'Oregon': 0.0,
  'Pennsylvania': 6.0,
  'Rhode Island': 7.0,
  'South Carolina': 6.0,
  'South Dakota': 4.5,
  'Tennessee': 7.0,
  'Texas': 6.25,
  'Utah': 6.1,
  'Vermont': 6.0,
  'Virginia': 5.3,
  'Washington': 6.5,
  'West Virginia': 6.0,
  'Wisconsin': 5.0,
  'Wyoming': 4.0,
  'District of Columbia': 6.0
};

// Default tax rate if state is not found
const DEFAULT_TAX_RATE = 5.0;

// Get tax rate for a given state
const getTaxRate = (state) => {
  if (!state) return DEFAULT_TAX_RATE;
  
  // Look up directly without converting to uppercase
  return STATE_TAX_RATES[state] || DEFAULT_TAX_RATE;
};

// Generate a unique order number
const generateOrderNumber = async () => {
  let isUnique = false;
  let orderNumber;
  
  while (!isUnique) {
    // Generate a random 7-digit number
    const randomNum = Math.floor(1000000 + Math.random() * 9000000);
    orderNumber = `O${randomNum}`;
    
    // Check if this order number already exists
    const existingOrder = await Order.findOne({ orderNumber });
    if (!existingOrder) {
      isUnique = true;
    }
  }
  
  return orderNumber;
};

// Validation functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone) => {
  const phoneRegex = /^\+?\d{10,15}$/;
  return phoneRegex.test(phone);
};

const validatePassword = (password) => {
  const errors = [];
  if (!password || password.length < 6) errors.push('Password must be at least 6 characters long');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)');
  return errors;
};

const validateZipCode = (zipCode) => {
  const zipRegex = /^[0-9]{5,6}$/;
  return zipRegex.test(zipCode);
};

const validateName = (name) => {
  const nameRegex = /^[A-Za-z\s'-]+$/;
  return nameRegex.test(name);
};

const validateAddress = (address) => {
  const errors = [];
  
  if (!address) {
    return ['Address object is required'];
  }

  const { street, city, state, country, zipCode } = address;

  if (!street) errors.push('Street address is required');
  if (!city || city.length < 2) errors.push('City must be at least 2 characters and contain only letters, spaces, or hyphens');
  if (!state || state.length < 2) errors.push('State must be at least 2 characters and contain only letters, spaces, or hyphens');
  if (!country || country.length < 2) errors.push('Country must be at least 2 characters and contain only letters, spaces, or hyphens');
  if (!validateZipCode(zipCode)) errors.push('Zip code must be 5-6 digits. Example: 12345');

  return errors;
};


// Controller functions
exports.register = async (req, res) => {
  try {
    // Handle image upload if present
    let imageUrl = null;
    if (req.files && req.files.image) {
      try {
        const file = req.files.image;
        imageUrl = await uploadImage(file, 'customers');
      } catch (uploadError) {
        console.error('Error uploading image:', uploadError);
        return res.status(500).json({ message: 'Error uploading profile image' });
      }
    }

    // Parse addresses if it's a string (from FormData)
    let addresses = req.body.addresses;
    if (typeof addresses === 'string') {
      try {
        addresses = JSON.parse(addresses);
      } catch (error) {
        console.error('Error parsing addresses:', error);
        return res.status(400).json({ message: 'Invalid addresses format' });
      }
    }

    // Validate all fields
    const validationErrors = [];

    if (!validateName(req.body.firstName)) validationErrors.push('First name must be 2-50 characters and contain only letters, spaces, hyphens, or apostrophes');
    if (!validateName(req.body.lastName)) validationErrors.push('Last name must be 2-50 characters and contain only letters, spaces, hyphens, or apostrophes');
    if (!validateEmail(req.body.email)) validationErrors.push('Invalid email format. Example: user@domain.com');
    validationErrors.push(...validatePassword(req.body.password));
    if (!validatePhone(req.body.phone)) validationErrors.push('Phone number must be 10-15 digits with optional + prefix. Example: +1234567890');

    // Validate first address
    if (addresses && addresses.length > 0) {
      const addressErrors = validateAddress(addresses[0]);
      validationErrors.push(...addressErrors);
    } else {
      validationErrors.push('At least one address is required');
    }

    if (validationErrors.length > 0) {
      console.error('Validation errors:', validationErrors);
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    const { 
      firstName, 
      lastName, 
      email, 
      password, 
      phone, 
      dateOfBirth
    } = req.body;

    // Check if customer already exists
    const existingCustomer = await Customer.findOne({ email });
    if (existingCustomer) {
      return res.status(400).json({ message: 'Customer already exists' });
    }

    // Create new customer
    const customer = new Customer({
      firstName,
      lastName,
      email,
      password,
      phone,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      imageUrl: imageUrl,
      addresses: addresses.map((addr, index) => ({
        ...addr,
        isPrimary: index === 0  // First address is primary
      }))
    });

    await customer.save();

    res.status(201).json({
      message: 'Customer registered successfully',
      customer: {
        id: customer._id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        imageUrl: customer.imageUrl
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Error registering customer', error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    // Find customer
    const customer = await Customer.findOne({ email });
    if (!customer) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password using model method
    const isValidPassword = await customer.comparePassword(password);
    
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Issue JWT
    const { generateToken } = require('../utils/jwt');
    const token = generateToken({ _id: customer._id, role: 'customer' });
    res.json({
        message: 'Login successful',
        token,
        customer: {
          id: customer._id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          imageUrl: customer.imageUrl
        }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    // Always use ID from params
    const customerId = req.user.id || req.user._id;
    if (customerId.toString() !== req.params.id.toString()) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    console.error('Error in getProfile:', error);
    res.status(500).json({ message: 'Error fetching profile', error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    // Always use ID from params
    const customerId = req.user.id || req.user._id;
    if (customerId.toString() !== req.params.id.toString()) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const { firstName, lastName, email, phone, dateOfBirth, imageUrl, currentPassword, newPassword } = req.body;

    // Validate email format if provided
    if (email && !validateEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Validate phone format if provided
    if (phone && !validatePhone(phone)) {
      return res.status(400).json({ message: 'Invalid phone number format' });
    }

    // Find customer by ID
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Handle password change if requested
    if (currentPassword && newPassword) {
      
      // Validate new password
      const passwordErrors = validatePassword(newPassword);
      if (passwordErrors.length > 0) {
        return res.status(400).json({ 
          message: 'Invalid new password', 
          errors: passwordErrors 
        });
      }
      
      // Verify current password
      const isPasswordValid = await customer.comparePassword(currentPassword);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }
      
      // Set new password
      customer.password = newPassword;
    }

    // Check if email is already in use by another customer
    if (email && email !== customer.email) {
      const existingCustomer = await Customer.findOne({ email });
      if (existingCustomer && existingCustomer._id.toString() !== customerId) {
        return res.status(400).json({ message: 'Email already in use by another customer' });
      }
    }

    // Update customer fields
    if (firstName) customer.firstName = firstName;
    if (lastName) customer.lastName = lastName;
    if (email) customer.email = email;
    if (phone) customer.phone = phone;
    if (dateOfBirth) customer.dateOfBirth = new Date(dateOfBirth);
    
    // Handle imageUrl explicitly - allow setting to null to remove profile image
    if (imageUrl !== undefined) {
      customer.imageUrl = imageUrl;
    }

    await customer.save();

    // Return updated customer data
    const updatedCustomer = await Customer.findById(customerId).select('-password');

    res.json({
      message: 'Profile updated successfully',
      customer: updatedCustomer
    });
  } catch (error) {
    console.error("Error in updateProfile:", error);
    res.status(500).json({ message: 'Error updating profile', error: error.message });
  }
};

exports.addAddress = async (req, res) => {
  try {
    const addressErrors = validateAddress(req.body);
    
    if (addressErrors.length > 0) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: addressErrors
      });
    }
    const { label, street, city, state, country, zipCode, isPrimary } = req.body;
    const customerId = req.user.id || req.user._id;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Check if an address with this label already exists
    const existingAddress = customer.addresses.find(addr => addr.label.toLowerCase() === label.toLowerCase());
    if (existingAddress) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: [`An address with label '${label}' already exists. Please use a different label.`]
      });
    }

    // Handle primary address logic
    const isNewAddressPrimary = isPrimary === true || isPrimary === 'true';
    
    // Only modify other addresses if new address is explicitly set as primary
    if (isNewAddressPrimary) {
      customer.addresses.forEach(addr => addr.isPrimary = false);
    }

    // Add new address
    customer.addresses.push({
      label,
      street,
      city,
      state,
      country,
      zipCode,
      isPrimary: isNewAddressPrimary
    });

    await customer.save();

    res.json({
      message: 'Address added successfully',
      addresses: customer.addresses
    });
  } catch (error) {
    res.status(500).json({ message: 'Error adding address', error: error.message });
  }
};

exports.updateAddress = async (req, res) => {
  try {
    const addressErrors = validateAddress(req.body);
    
    if (addressErrors.length > 0) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: addressErrors
      });
    }
    const { addressId } = req.params;
    const { label, street, city, state, country, zipCode, isPrimary } = req.body;
    const customerId = req.user.id || req.user._id;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const address = customer.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    // Check if another address has the same label (excluding the current address)
    const existingAddress = customer.addresses.find(
      addr => addr._id.toString() !== addressId && 
      addr.label.toLowerCase() === label.toLowerCase()
    );
    if (existingAddress) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: [`An address with label '${label}' already exists. Please use a different label.`]
      });
    }

    // Handle primary address logic for update
    const isBeingSetAsPrimary = isPrimary === true || isPrimary === 'true';
    const isBeingSetAsNonPrimary = isPrimary === false || isPrimary === 'false';
    
    // If trying to set a primary address to non-primary, prevent it
    if (address.isPrimary && isBeingSetAsNonPrimary) {
      return res.status(400).json({
        message: 'Cannot set primary address to non-primary',
        errors: ['Please mark another address as primary first to automatically change this address to non-primary']
      });
    }
    
    // If this address is being set as primary and wasn't primary before, update others to be non-primary
    if (isBeingSetAsPrimary && !address.isPrimary) {
      customer.addresses.forEach(addr => addr.isPrimary = false);
    }

    // Update address
    address.label = label;
    address.street = street;
    address.city = city;
    address.state = state;
    address.country = country;
    address.zipCode = zipCode;
    address.isPrimary = isBeingSetAsPrimary || address.isPrimary; // Keep existing primary status if not explicitly set to true

    await customer.save();

    res.json({
      message: 'Address updated successfully',
      addresses: customer.addresses
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating address', error: error.message });
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const customerId = req.user.id || req.user._id;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const address = customer.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    // Check if trying to delete a primary address
    if (address.isPrimary === true || address.isPrimary === 'true') {
      return res.status(400).json({
        message: 'Cannot delete primary address',
        errors: ['Please set another address as primary first before deleting this address']
      });
    }

    // Remove address using pull()
    customer.addresses.pull({ _id: addressId });
    await customer.save();

    res.json({
      message: 'Address deleted successfully. Find your current addresses below:',
      addresses: customer.addresses
    });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting address', error: error.message });
  }
};

// Logout customer (JWT: just tell frontend to remove token)
exports.logout = (req, res) => {
  res.json({ message: 'Logged out successfully' });
};

// Delete customer account
exports.deleteAccount = async (req, res) => {
  try {
    const customerId = req.user.id || req.user._id;
    if (customerId.toString() !== req.params.id.toString()) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Find and delete the customer
    const deletedCustomer = await Customer.findByIdAndDelete(customerId);

    if (!deletedCustomer) {
      return res.status(404).json({ message: `Customer with id ${customerId} not found` });
    }

    res.status(200).json({ message: `Customer account named ${deletedCustomer.firstName} ${deletedCustomer.lastName} deleted successfully` });
  } catch (error) {
    console.error('Error deleting customer account:', error);
    res.status(500).json({ message: 'Error deleting customer account', error: error.message });
  }
};


// Order-related functions

// Create a new order
exports.createOrder = async (req, res) => {
  try {
    const { items, isDelivery, addressId } = req.body;
    const customerId = req.user.id || req.user._id;
    const restaurantId = req.params.restaurantId;

    // Validate items array
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order must contain at least one item' });
    }
    
    // Validate quantities are whole numbers and filter out items with quantity of 0
    const invalidItems = items.filter(item => item.quantity && (!Number.isInteger(item.quantity) || item.quantity < 0));
    if (invalidItems.length > 0) {
      return res.status(400).json({ 
        message: 'All item quantities must be whole numbers greater than or equal to 0',
        invalidItems: invalidItems.map(item => ({ dishId: item.dishId, quantity: item.quantity }))
      });
    }
    
    // Filter out items with quantity of 0
    const validItems = items.filter(item => item.quantity > 0);
    
    // Check if there are any valid items left after filtering
    if (validItems.length === 0) {
      return res.status(400).json({ message: 'Order must contain at least one item with quantity greater than 0' });
    }

    // Validate and fetch all dishes
    const dishIds = validItems.map(item => item.dishId);
    
    // Get unique dish IDs to handle multiple orders of the same dish with different sizes
    const uniqueDishIds = [...new Set(dishIds.map(id => id.toString()))];
    
    const dishes = await Dish.find({
      _id: { $in: uniqueDishIds },
      restaurantId: restaurantId,
      isAvailable: true
    });
    
    // Check if all unique dishes were found and available
    const foundDishIds = dishes.map(dish => dish._id.toString());
    const unavailableDishIds = uniqueDishIds.filter(id => !foundDishIds.includes(id));
    
    if (unavailableDishIds.length > 0) {
      return res.status(400).json({ 
        message: 'One or more dishes are unavailable',
        unavailableDishIds
      });
    }

    // Get customer details
    const customer = await Customer.findById(customerId)
      .select('firstName lastName email phone addresses');
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Get restaurant details
    const restaurantDetails = await Restaurant.findById(restaurantId)
      .select('name address phone email imageUrl');
    if (!restaurantDetails) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }
    
    // Ensure address is properly structured
    if (!restaurantDetails.address || typeof restaurantDetails.address !== 'object') {
      return res.status(400).json({ message: 'Restaurant address information is invalid' });
    }

    // Calculate total and store dish details
    const itemsWithDetails = validItems.map(item => {
      const dish = dishes.find(d => d._id.toString() === item.dishId.toString());
      
      if (!dish) {
        throw new Error(`Dish not found with ID: ${item.dishId}`);
      }
      
      // Ensure dish has a sizes array
      if (!dish.sizes || !Array.isArray(dish.sizes) || dish.sizes.length === 0) {
        throw new Error(`No size options available for dish: ${dish.name}`);
      }
      
      // Find the selected size from the sizes array
      if (!item.sizeId) {
        throw new Error(`Size ID is required for dish: ${dish.name}`);
      }
      
      const selectedSize = dish.sizes.find(s => s._id && s._id.toString() === item.sizeId.toString());
      if (!selectedSize) {
        throw new Error(`Invalid size selected for dish: ${dish.name}`);
      }
      
      return {
        dishId: dish._id,
        name: dish.name,
        size: selectedSize.size,
        price: selectedSize.price,
        quantity: item.quantity,
        totalPrice: selectedSize.price * item.quantity,
        category: Array.isArray(dish.category) ? dish.category.join(', ') : (typeof dish.category === 'string' ? dish.category : ''),
        ingredients: dish.ingredients,
        imageUrl: dish.imageUrl
      };
    });

    // Calculate subtotal from items
    const subtotal = itemsWithDetails.reduce((sum, item) => sum + item.totalPrice, 0);
    
    // Determine which state to use for tax calculation
    let taxState;
    if (isDelivery && addressId) {
      // For delivery, use the customer's delivery address state
      const selectedAddress = customer.addresses.find(addr => addr._id.toString() === addressId);
      if (!selectedAddress) {
        return res.status(400).json({ message: 'Invalid address selected' });
      }
      taxState = selectedAddress ? selectedAddress.state : null;
    } else {
      // For pickup, use the restaurant's state
      taxState = restaurantDetails.address.state;
    }
    
    // Calculate tax
    const taxRate = getTaxRate(taxState);
    const taxAmount = parseFloat(((subtotal * taxRate) / 100).toFixed(2));
    
    // Calculate delivery fee if applicable
    let deliveryFee = null;
    if (isDelivery) {
      // Apply $4.49 delivery fee if subtotal is less than $20
      deliveryFee = subtotal >= 20 ? 0 : 4.49;
    }
    
    // Calculate total amount including delivery fee if present
    const totalBeforeFee = parseFloat((subtotal + taxAmount).toFixed(2));
    const totalAmount = deliveryFee !== null ? 
      parseFloat((totalBeforeFee + deliveryFee).toFixed(2)) : 
      totalBeforeFee;

    // If delivery, validate the given address by customer
    let deliveryAddress;
    if (isDelivery) {
      if (!addressId) {
        return res.status(400).json({ message: 'An address is required for delivery orders' });
      }

      const selectedAddress = customer.addresses.find(addr => addr._id.toString() === addressId);

      if (!selectedAddress) {
        return res.status(400).json({ message: 'Invalid address selected' });
      }

      deliveryAddress = {
        label: selectedAddress.label,
        street: selectedAddress.street,
        city: selectedAddress.city,
        state: selectedAddress.state,
        country: selectedAddress.country,
        zipCode: selectedAddress.zipCode
      };
    }

    // Generate a unique order number
    const orderNumber = await generateOrderNumber();
    
    const orderEvent = {
      orderNumber,
      customerId: customerId,
      customerDetails: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone
      },
      restaurantId: restaurantId,
      restaurantDetails: {
        name: restaurantDetails.name,
        imageUrl: restaurantDetails.imageUrl || null,
        address: {
          street: restaurantDetails.address.street || '',
          city: restaurantDetails.address.city || '',
          state: restaurantDetails.address.state || '',
          country: restaurantDetails.address.country || '',
          zipCode: restaurantDetails.address.zipCode || ''
        },
        phone: restaurantDetails.phone,
        email: restaurantDetails.email
      },
      items: itemsWithDetails,
      customerNote: req.body.customerNote || '',
      subtotal,
      taxRate,
      taxAmount,
      deliveryFee,
      totalAmount,
      isDelivery,
      deliveryAddress,
      status: 'new'
    };

    // Publish to Kafka (customer-orders topic)
    try {
      await publishOrder(orderEvent);
    } catch (kafkaErr) {
      console.error('Failed to publish order place event to Kafka:', kafkaErr);
    }

    res.status(201).json({
      message: 'Order created successfully',
      order: orderEvent
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating order', error: error.message });
  }
};

// Get all orders for a customer
exports.getCustomerOrders = async (req, res) => {
  try {
    const customerId = req.params.customerId;
    
    // Get customer details to display name in message
    const customer = await Customer.findById(customerId).select('firstName lastName');
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Get only the necessary fields for the orders list
    const orders = await Order.find({ customerId: customerId })
      .sort({ createdAt: -1 });

    // Check if customer has any orders
    if (orders.length === 0) {
      return res.json({
        message: `No orders yet for ${customer.firstName} ${customer.lastName}`,
        orders: [],
        count: 0
      });
    }

    // Transform the data to a more frontend-friendly format
    // Ensure we maintain the descending order by createdAt
    const simplifiedOrders = orders.map(order => ({
      id: order._id,
      orderNumber: order.orderNumber,
      restaurantName: order.restaurantDetails.name,
      restaurantNote: order.restaurantNote,
      restaurantImage: order.restaurantDetails.imageUrl || null,
      restaurantAddress: order.restaurantDetails.address ? {
        street: order.restaurantDetails.address.street || '',
        city: order.restaurantDetails.address.city || '',
        state: order.restaurantDetails.address.state || '',
        zipCode: order.restaurantDetails.address.zipCode || ''
      } : null,
      deliveryAddress: order.deliveryAddress ? {
        street: order.deliveryAddress.street || '',
        city: order.deliveryAddress.city || '',
        state: order.deliveryAddress.state || '',
        zipCode: order.deliveryAddress.zipCode || '',
        label: order.deliveryAddress.label || ''
      } : null,
      items: order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        size: item.size || null
      })),
      totalItems: order.items.length,
      status: order.status,
      deliveryType: order.isDelivery ? 'Delivery' : 'Pickup',
      totalAmount: order.totalAmount,
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

// Get order details for a customer
exports.getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findOne({
      _id: orderId,
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Process order to convert comma-separated categories to arrays
    const processedOrder = {
      ...order.toObject(),
      items: order.items.map(item => ({
        ...item.toObject(),
        category: item.category ? item.category.split(', ') : []
      }))
    };

    res.json(processedOrder);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching order details', error: error.message });
  }
};

// Cancel an order
exports.cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const customerId = req.user.id || req.user._id;
    const order = await Order.findOne({
      _id: orderId,
      customerId: customerId
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if order is in 'received' or 'new' status to be eligible to cancel
    if (order.status !== 'received' && order.status !== 'new') {
      return res.status(400).json({ 
        message: 'Order has been processed already and cannot be cancelled. Please contact the restaurant for support.'
      });
    }

    order.status = 'cancelled';
    order.cancelledByCustomer = true;
    await order.save();

    // Publish order cancellation event to Kafka
    await publishOrderCancel(order);

    res.json({
      message: 'Order cancelled successfully',
      order
    });
  } catch (error) {
    res.status(500).json({ message: 'Error cancelling order', error: error.message });
  }
};

// Check customer authentication status
exports.checkAuth = async (req, res) => {
  try {
    if (req.user && req.user.role === 'customer') {
      // Find the customer to verify they exist in the database
      const customer = await Customer.findById(req.user.id || req.user._id);
      if (customer) {
        return res.json({
          isCustomerAuthenticated: true,
          customer: {
            id: customer._id,
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
            phone: customer.phone,
            imageUrl: customer.imageUrl
          }
        });
      }
    }
    // If no valid JWT or customer not found
    return res.json({
      isCustomerAuthenticated: false
    });
  } catch (error) {
    console.error('Error checking authentication:', error);
    return res.status(500).json({ 
      message: 'Error checking authentication status', 
      error: error.message 
    });
  }
};
