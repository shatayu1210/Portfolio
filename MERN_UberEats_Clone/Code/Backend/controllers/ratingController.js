const Restaurant = require('../models/restaurant');
const Rating = require('../models/rating');
const Customer = require('../models/customer');

exports.createRating = async (req, res) => {
  try {
    const { rating, review } = req.body;
    const restaurantId = req.params.restaurantId;
    const customerId = req.user.id || req.user._id;

    // Validate rating is a whole number between 1-5
    const ratingNum = parseInt(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ message: 'Rating must be a whole number between 1 and 5' });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    // Check if customer has already rated this restaurant
    const existingRating = await Rating.findOne({ 
      customerId: customerId,
      restaurantId: restaurantId
    });

    if (existingRating) {
      return res.status(400).json({ message: 'You have already rated this restaurant. Please update your existing rating if needed.' });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Create new rating
    const newRating = new Rating({
      customerId,
      restaurantId,
      rating: ratingNum,
      review: review || null
    });

    await newRating.save();

    // Calculate new average with one decimal precision
    const newTotal = (restaurant.rating * restaurant.ratingCount) + ratingNum;
    restaurant.ratingCount += 1;
    restaurant.rating = Number((newTotal / restaurant.ratingCount).toFixed(1));

    await restaurant.save();

    res.status(201).json({
      message: `Thank you ${customer.firstName} ${customer.lastName} for rating ${restaurant.name}!`,
      rating: newRating,
      restaurantRating: restaurant.rating,
      ratingCount: restaurant.ratingCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Error adding rating', error: error.message });
  }
};

exports.getRestaurantRatings = async (req, res) => {
  try {
    const restaurantId = req.params.restaurantId;
    
    // Get restaurant info
    const restaurant = await Restaurant.findById(restaurantId)
      .select('name rating ratingCount');

    if(restaurant.ratingCount === 0) {
      return res.status(400).json({
        message: `No ratings available for ${restaurant.name} yet`
      })
    }
      
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    // Get all ratings for this restaurant in descending order of review dates and populate customer info for those who dropped a review
    const ratings = await Rating.find({ restaurantId })
      .populate('customerId', 'firstName lastName imageUrl')
      .sort({ createdAt: -1 });

    // Format the ratings for frontend consumption
    const formattedRatings = ratings.map(rating => ({
      id: rating._id,
      rating: rating.rating,
      review: rating.review,
      customer: {
        id: rating.customerId._id,
        name: `${rating.customerId.firstName} ${rating.customerId.lastName}`,
        imageUrl: rating.customerId.imageUrl || null
      },
      createdAt: rating.createdAt,
      updatedAt: rating.updatedAt
    }));

    res.json({
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        averageRating: restaurant.rating,
        ratingCount: restaurant.ratingCount
      },
      ratings: formattedRatings
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching ratings', error: error.message });
  }
};

exports.updateRating = async (req, res) => {
  try {
    const { rating, review } = req.body;
    const ratingId = req.params.ratingId;
    const customerId = req.user.id || req.user._id;

    // Validate rating is a whole number between 1-5
    const ratingNum = parseInt(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ message: 'Rating must be a whole number between 1 and 5' });
    }

    // Find the rating
    const existingRating = await Rating.findById(ratingId);
    
    if (!existingRating) {
      return res.status(404).json({ message: 'Rating not found' });
    }

    // Check if the rating belongs to the customer
    if (existingRating.customerId.toString() !== customerId.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this rating' });
    }

    // Get the restaurant
    const restaurant = await Restaurant.findById(existingRating.restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    // Calculate new restaurant average rating
    const oldTotal = restaurant.rating * restaurant.ratingCount;
    const newTotal = oldTotal - existingRating.rating + ratingNum;
    restaurant.rating = Number((newTotal / restaurant.ratingCount).toFixed(1));

    // Update the rating
    existingRating.rating = ratingNum;
    existingRating.review = review || null;
    existingRating.updatedAt = Date.now();

    await existingRating.save();
    await restaurant.save();

    res.json({
      message: 'Rating updated successfully',
      rating: existingRating,
      restaurantRating: restaurant.rating
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating rating', error: error.message });
  }
};

exports.deleteRating = async (req, res) => {
  try {
    const ratingId = req.params.ratingId;
    const customerId = req.user.id || req.user._id;

    // Find the rating
    const rating = await Rating.findById(ratingId);
    
    if (!rating) {
      return res.status(404).json({ message: 'Rating not found' });
    }

    // Check if the rating belongs to the customer
    if (rating.customerId.toString() !== customerId.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this rating' });
    }

    // Get the restaurant
    const restaurant = await Restaurant.findById(rating.restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    // Calculate new restaurant average rating
    if (restaurant.ratingCount > 1) {
      const oldTotal = restaurant.rating * restaurant.ratingCount;
      const newTotal = oldTotal - rating.rating;
      restaurant.ratingCount -= 1;
      restaurant.rating = Number((newTotal / restaurant.ratingCount).toFixed(1));
    } else {
      // If this was the only rating, reset to 0
      restaurant.rating = 0;
      restaurant.ratingCount = 0;
    }

    // Delete the rating
    await Rating.findByIdAndDelete(ratingId);
    await restaurant.save();

    res.json({
      message: 'Rating deleted successfully',
      restaurantRating: restaurant.rating,
      ratingCount: restaurant.ratingCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting rating', error: error.message });
  }
};

// Temporary function for development purpose
exports.recompute = async (req, res) => {
  try {
    const restaurantId = req.params.restaurantId;

    // Fetch all ratings for the restaurant
    const ratings = await Rating.find({ restaurantId });
    const ratingCount = ratings.length;
    const totalRating = ratings.reduce((sum, rating) => sum + rating.rating, 0);
    const averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;

    // Update the restaurant with the new average rating and count
    await Restaurant.findByIdAndUpdate(restaurantId, {
      rating: averageRating.toFixed(1),
      ratingCount: ratingCount
    });

    res.status(200).json({
      message: 'Recomputed ratings successfully',
      rating: averageRating.toFixed(1),
      ratingCount: ratingCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Error recomputing ratings', error: error.message });
  }
};
