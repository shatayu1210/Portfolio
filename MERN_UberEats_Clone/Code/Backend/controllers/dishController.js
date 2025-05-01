const Dish = require('../models/dish');
const Restaurant = require('../models/restaurant');

// Create a new dish
exports.createDish = async (req, res) => {
  try {
    const { name, description, sizes, category, ingredients, imageUrl, isAvailable } = req.body;
    const restaurantId = req.user?.id || req.user?._id;

    // Validate required fields
    if (!name || !sizes || !Array.isArray(sizes) || sizes.length === 0 || !category || !Array.isArray(category) || category.length === 0) {
      return res.status(400).json({ message: 'Name, at least one size with price, and at least one category are required' });
    }
    
    // Validate each size in the sizes array
    for (const sizeObj of sizes) {
      if (!sizeObj.size || !sizeObj.price) {
        return res.status(400).json({ message: 'Each size must have both size name and price' });
      }
    }
    
    // Check for duplicate dish name for this restaurant
    const existingDish = await Dish.findOne({ 
      restaurantId, 
      name: { $regex: new RegExp('^' + name + '$', 'i') } // Case-insensitive match
    });
    
    if (existingDish) {
      return res.status(400).json({ 
        message: 'A dish with this name already exists for your restaurant' 
      });
    }

    // Create new dish
    const dish = new Dish({
      restaurantId,
      name,
      description: description || null,
      sizes,
      category,
      ingredients: ingredients || [],
      imageUrl: imageUrl || null,
      isAvailable: isAvailable !== undefined ? isAvailable : true
    });

    await dish.save();
    // Add new categories to restaurant cuisine
    await Restaurant.findByIdAndUpdate(restaurantId, { $addToSet: { cuisine: { $each: category } } });
    
    res.status(201).json({
      message: 'Dish created successfully',
      dish
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating dish', error: error.message });
  }
};


// Get a specific dish by ID
exports.getDishById = async (req, res) => {
  try {
    const dishId = req.params.dishId;
    
    const dish = await Dish.findById(dishId);
    
    if (!dish) {
      return res.status(404).json({ message: 'Dish not found' });
    }
    
    res.json(dish);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching dish', error: error.message });
  }
};

// Update a dish
exports.updateDish = async (req, res) => {
  try {
    const dishId = req.params.dishId;
    const restaurantId = req.user?.id || req.user?._id;
    const updates = req.body;
    
    // Find the dish
    const dish = await Dish.findById(dishId);
    
    if (!dish) {
      return res.status(404).json({ message: 'Dish not found' });
    }
    
    // Check if the dish belongs to the restaurant
    if (dish.restaurantId.toString() !== restaurantId.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this dish' });
    }
    
    // Validate category if provided
    if (updates.category && (!Array.isArray(updates.category) || updates.category.length === 0)) {
      return res.status(400).json({ message: 'At least one category must be provided' });
    }
    
    // Capture original categories before updating for removal logic
    const originalCategories = [...dish.category];
    
    // Update the dish
    Object.keys(updates).forEach(key => {
      if (key !== 'restaurantId') { // Prevent changing restaurantId
        dish[key] = updates[key];
      }
    });
    
    await dish.save();
    
    // Update restaurant cuisine: add new categories and remove stale ones
    if (updates.category) {
      // Add any new categories if dish is available
      if (dish.isAvailable) {
        await Restaurant.findByIdAndUpdate(restaurantId, { $addToSet: { cuisine: { $each: updates.category } } });
      }
      // Remove categories no longer present in any available dish
      const removedCategories = originalCategories.filter(cat => !updates.category.includes(cat));
      for (const cat of removedCategories) {
        const count = await Dish.countDocuments({ restaurantId, category: cat, isAvailable: true });
        if (count === 0) {
          await Restaurant.findByIdAndUpdate(restaurantId, { $pull: { cuisine: cat } });
        }
      }
    }
    
    // Check if this update made the dish unavailable
    if (updates.isAvailable === false) {
      // Check if all dishes for this restaurant are now unavailable
      const availableDishes = await Dish.countDocuments({ 
        restaurantId, 
        isAvailable: true 
      });
      
      // If no available dishes remain, set restaurant status to inactive
      if (availableDishes === 0) {
        const restaurant = await Restaurant.findById(restaurantId);
        if (restaurant && restaurant.status === 'active') {
          restaurant.status = 'inactive';
          await restaurant.save();
        }
      }
    }
    
    res.json({
      message: 'Dish updated successfully',
      dish
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating dish', error: error.message });
  }
};

// Delete a dish
exports.deleteDish = async (req, res) => {
  try {
    const dishId = req.params.dishId;
    const restaurantId = req.user?.id || req.user?._id;
    
    // Find the dish
    const dish = await Dish.findById(dishId);
    
    if (!dish) {
      return res.status(404).json({ message: 'Dish not found' });
    }
    
    // Check ownership
    if (dish.restaurantId.toString() !== restaurantId.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this dish' });
    }
    // Keep copy of categories before deletion
    const originalCategories = [...dish.category];
    
    await Dish.findByIdAndDelete(dishId);
    
    // Check if restaurant has any dishes left
    const dishCount = await Dish.countDocuments({ restaurantId });
    
    // If no dishes left, set restaurant status to inactive
    if (dishCount === 0) {
      const restaurant = await Restaurant.findById(restaurantId);
      if (restaurant) {
        restaurant.status = 'inactive';
        await restaurant.save();
      }
    }
    // Remove restaurant cuisinecategories no longer used by any available dishes
    for (const cat of originalCategories) {
      const count = await Dish.countDocuments({ restaurantId, category: cat, isAvailable: true });
      if (count === 0) {
        await Restaurant.findByIdAndUpdate(restaurantId, { $pull: { cuisine: cat } });
      }
    }
    
    res.json({ message: 'Dish deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting dish', error: error.message });
  }
};

// Toggle dish availability
exports.toggleAvailability = async (req, res) => {
  try {
    const dishId = req.params.dishId;
    const restaurantId = req.user?.id || req.user?._id;
    
    // Find the dish
    const dish = await Dish.findById(dishId);
    
    if (!dish) {
      return res.status(404).json({ message: 'Dish not found' });
    }
    
    // Check ownership by comparing both as strings for reliability
    if (dish.restaurantId.toString() !== restaurantId.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this dish' });
    }
    // Copy categories for cuisine update
    const categories = [...dish.category];
    // Check current availability
    const wasUnavailable = !dish.isAvailable;
    
    // Toggle availability
    dish.isAvailable = !dish.isAvailable;
    
    await dish.save();
    // Update cuisine: remove or add categories based on new availability
    if (!dish.isAvailable) {
      // Remove categories with no other available dishes
      for (const cat of categories) {
        const count = await Dish.countDocuments({ restaurantId, category: cat, isAvailable: true });
        if (count === 0) {
          await Restaurant.findByIdAndUpdate(restaurantId, { $pull: { cuisine: cat } });
        }
      }
    } else {
      // Add all categories back when dish becomes available
      await Restaurant.findByIdAndUpdate(restaurantId, { $addToSet: { cuisine: { $each: categories } } });
    }
    
    // Handle dish being set to unavailable - existing logic...
    if (!dish.isAvailable) {
      // Count available dishes for this restaurant
      const availableDishCount = await Dish.countDocuments({ 
        restaurantId, 
        isAvailable: true 
      });
      
      // If no available dishes remain, set restaurant status to inactive
      if (availableDishCount === 0) {
        const restaurant = await Restaurant.findById(restaurantId);
        if (restaurant && restaurant.status === 'active') {
          restaurant.status = 'inactive';
          await restaurant.save();
          
          // Include a status change flag in the response
          return res.json({
            message: `Dish unavailable for ordering. All dishes are now unavailable, restaurant has been set to inactive.`,
            dish,
            restaurantStatusChanged: true,
            newStatus: 'inactive'
          });
        }
      }
    } 
    // Handle dish being set to available - check if it's the first available dish
    else if (wasUnavailable) {
      // Count how many available dishes there are now including this one
      const availableDishCount = await Dish.countDocuments({ 
        restaurantId, 
        isAvailable: true 
      });
      
      // If this is the first available dish (count = 1)
      if (availableDishCount === 1) {
        // Checking restaurant status
        const restaurant = await Restaurant.findById(restaurantId);
        if (restaurant && restaurant.status === 'inactive') {
          // Just including info for frontend
          return res.json({
            message: `Dish available for ordering. This is your first available dish.`,
            dish,
            firstAvailableDish: true,
            restaurantStatus: 'inactive'
          });
        }
      }
    }

    res.json({
      message: `Dish ${dish.isAvailable ? 'available' : 'unavailable'} for ordering`,
      dish,
      restaurantStatusChanged: false,
      firstAvailableDish: false
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating dish availability', error: error.message });
  }
};
