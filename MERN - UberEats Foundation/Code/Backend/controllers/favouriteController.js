const { Favourite, Customer, Restaurant } = require('../models');

exports.addFavorite = async (req, res) => {
    try {
        const { customer_id, restaurant_id } = req.body;

        if (!customer_id || !restaurant_id) {
            return res.status(400).json({ error: "Customer ID and Restaurant ID are required" });
        }

        // Validating if customer already has restaurant in favourites
        const existingFavorite = await Favourite.findOne({ 
            where: { customer_id, restaurant_id } 
        });

        if (existingFavorite) {
            return res.status(400).json({ error: `Restaurant ID: ${restaurant_id} is already under Customer ID: ${customer_id} favourites` });
        }

        // Else create a new favorite entry
        const favorite = await Favourite.create({ customer_id, restaurant_id });

        res.status(201).json({ msg: "Restaurant added to Customer favorites!", favorite });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getFavoritesByCustomer = async (req, res) => {
    try {
        const { customer_id } = req.params;

        // Checking if valid customer
        const customer = await Customer.findByPk(customer_id);
        if (!customer) {
            return res.status(404).json({ error: `Customer Not Found for ID: ${customer_id}` });
        }

        // Else fetch all favorite restaurants for the customer
        const favorites = await Favourite.findAll({
            where: { customer_id },
            include: [{ model: Restaurant, attributes: ['id', 'image_url', 'name', 'ratings'] }]
        });

        if (favorites.length === 0) {
            return res.status(200).json({ message: `No favorites for Customer ID: ${customer_id}` });
        }

        res.status(200).json(favorites);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.removeFavorite = async (req, res) => {
    try {
        const { customer_id, restaurant_id } = req.body;

        // Check if both customer_id and restaurant_id are provided
        if (!customer_id || !restaurant_id) {
            return res.status(400).json({ error: "Both Customer ID and Restaurant ID are required" });
        }

        const favorite = await Favourite.findOne({ where: { customer_id, restaurant_id } });

        if (!favorite) {
            return res.status(404).json({ error: "Favorite entry not found" });
        }

        await Favourite.destroy({ where: { customer_id, restaurant_id } });

        res.status(200).json({ msg: "Removed from favorites" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};