const Favorite = require('../models/favorite');
const Customer = require('../models/customer');
const Restaurant = require('../models/restaurant');

exports.addFavorite = async (req, res) => {
  try {
    const customerId = req.user?.id || req.user?._id;
    const { restaurantId } = req.body;

    const customer = await Customer.findById(customerId);
    const restaurant = await Restaurant.findById(restaurantId);

    if (!customer || !restaurant) {
      return res.status(404).json({ message: 'Customer or Restaurant not found' });
    }

    let favorite = await Favorite.findOne({ customerId });
    if (!favorite) {
      favorite = new Favorite({ customerId, favorites: [restaurantId] });
    } else {
      if (favorite.favorites.includes(restaurantId)) {
        return res.status(400).json({ message: `Customer ${customer.firstName} ${customer.lastName} already has ${restaurant.name} in favorites` });
      }
      favorite.favorites.push(restaurantId);
    }

    await favorite.save();
    res.status(200).json({ message: `Customer: ${customer.firstName} ${customer.lastName} added Restaurant: ${restaurant.name} to favorites`, favorites: favorite.favorites });
  } catch (error) {
    res.status(500).json({ message: 'Error adding favorite', error: error.message });
  }
};

exports.removeFavorite = async (req, res) => {
  try {
    const customerId = req.user?.id || req.user?._id;
    const restaurantId = req.params.restaurantId;

    const customer = await Customer.findById(customerId);
    const restaurant = await Restaurant.findById(restaurantId);

    if (!customer || !restaurant) {
      return res.status(404).json({ message: 'Customer or Restaurant not found' });
    }

    const favorite = await Favorite.findOne({ customerId });
    if (!favorite) {
      return res.status(404).json({ message: `No favorites found for Customer: ${customer.firstName} ${customer.lastName}` });
    }

    if (!favorite.favorites.includes(restaurantId)) {
      return res.status(400).json({ message: `Restaurant: ${restaurant.name} is not in Customer: ${customer.firstName} ${customer.lastName}'s favorites` });
    }

    favorite.favorites = favorite.favorites.filter(id => id.toString() !== restaurantId);
    await favorite.save();

    res.status(200).json({ message: `Restaurant: ${restaurant.name} removed from favorites`, favorites: favorite.favorites });
  } catch (error) {
    res.status(500).json({ message: 'Error removing favorite', error: error.message });
  }
};

exports.getFavorites = async (req, res) => {
  try {
    const customerId = req.params.id;
    const customer = await Customer.findById(customerId);
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    const favorite = await Favorite.findOne({ customerId }).populate('favorites');
    
    // Return empty array if no favorites found
    if (!favorite) {
      return res.status(200).json({ favorites: [] });
    }

    res.status(200).json({ favorites: favorite.favorites });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching favorites', error: error.message });
  }
};
