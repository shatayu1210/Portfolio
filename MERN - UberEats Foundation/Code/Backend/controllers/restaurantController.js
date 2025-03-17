const { Restaurant, RestaurantOwner, RestaurantOwnerRelationship } = require('../models');
const { Op } = require('sequelize');


exports.createRestaurant = async (req, res) => {
    try {
        const { name, description, email, phone, address, offers_pickup, offers_delivery, ratings, image_url, owner_id } = req.body;

        // Basic validation
        if (!name || !email || !phone || !address || !owner_id) {
            return res.status(400).json({ error: "Required fields are missing" });
        }

        // Check if email is already in use
        const existingRestaurant = await Restaurant.findOne({ where: { email } });
        if (existingRestaurant) {
            return res.status(400).json({ error: "Email is already in use" });
        }

        // Check if owner exists
        const ownerExists = await RestaurantOwner.findOne({ where: { id: owner_id } });
        if (!ownerExists) {
            return res.status(404).json({ error: `Owner ID: ${owner_id} not found` });
        }

        // Create Restaurant
        const restaurant = await Restaurant.create({
            name,
            description,
            email,
            phone,
            address,
            offers_pickup,
            offers_delivery,
            ratings,
            image_url: image_url || null,  // Default to null if not provided
            owner_id  // Owner ID from the request body
        });

        // Inserting owner-restaurant entry into the restaurant_owner_relationships table
        await RestaurantOwnerRelationship.create({
            owner_id,
            restaurant_id: restaurant.id,
            created_at: new Date(),
            updated_at: new Date()
        });

        res.status(201).json({ msg: "Restaurant Created", restaurant });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


exports.viewAllRestaurants = async (req, res) => {
    try {
        const restaurants = await Restaurant.findAll({
            attributes: ['id', 'name', 'description', 'email', 'phone', 'address', 'offers_pickup', 'offers_delivery', 'ratings', 'image_url', 'owner_id', 'created_at', 'updated_at']
        });
        res.status(200).json(restaurants);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


exports.viewSingleRestaurant = async (req, res) => {
    try {
        const restaurant = await Restaurant.findByPk(req.params.id, {
            attributes: ['id', 'name', 'description', 'email', 'phone', 'address', 'offers_pickup', 'offers_delivery', 'ratings', 'image_url', 'owner_id', 'created_at', 'updated_at']
        });
        if (restaurant) {
            res.status(200).json(restaurant);
        } else {
            res.status(404).json({ error: `No Restaurant found with ID: ${req.params.id}` });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


exports.viewOwnerRestaurants = async (req, res) => {
    try {
        // Check if the owner exists in RestaurantOwner by owner_id
        const owner = await RestaurantOwner.findByPk(req.params.id);
        if (!owner) {
            // If the owner does not exist, return a 404 error
            return res.status(404).json({ error: `No owner found with ID: ${req.params.id}` });
        }
        // If the owner exists, fetch the restaurants linked to the owner_id
        const restaurants = await Restaurant.findAll({
            where: { owner_id: req.params.id },
            attributes: ['id', 'name', 'description', 'email', 'phone', 'address', 'offers_pickup', 'offers_delivery', 'ratings', 'image_url', 'owner_id', 'created_at', 'updated_at']
        });
        if (restaurants.length > 0) {
            // If restaurants are found, return them
            return res.status(200).json(restaurants);
        } else {
            return res.status(404).json({ error: `No Restaurants found for Owner with ID: ${req.params.id}` });
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};


exports.updateRestaurant = async (req, res) => {
    try {
        const { name, description, email, phone, address, offers_pickup, offers_delivery, ratings, image_url, owner_id } = req.body;

        const restaurant = await Restaurant.findByPk(req.params.id);
        if (!restaurant) {
            return res.status(404).json({ error: `No Restaurant found with ID: ${req.params.id}` });
        }

        // Check for email uniqueness
        const existingRestaurant = await Restaurant.findOne({
            where: {
                email,
                id: { [Op.ne]: req.params.id }
            }
        });
        if (existingRestaurant) {
            return res.status(400).json({ error: "Email is already in use by another restaurant" });
        }

        // Check if owner exists
        const ownerExists = await RestaurantOwner.findOne({ where: { id: owner_id } });
        if (!ownerExists) {
            return res.status(404).json({ error: `Owner ID: ${owner_id} not found` });
        }

        // Remove existing restaurant-owner relationship before inserting new association
        await RestaurantOwnerRelationship.destroy({
            where: {
                restaurant_id: restaurant.id
            }
        });

        // Update Restaurant
        await Restaurant.update(
            { 
                name, 
                description, 
                email, 
                phone, 
                address, 
                offers_pickup: offers_pickup || false,  // Default to false if not provided
                offers_delivery: offers_delivery || false,  // Default to false if not provided
                ratings: ratings || null,  // Default to null if not provided
                image_url: image_url || null,  // Default to null if not provided
                owner_id  // Update the owner_id
            },
            { where: { id: req.params.id } }
        );

        const updatedRestaurant = await Restaurant.findByPk(req.params.id, {
            attributes: ['id', 'name', 'description', 'email', 'phone', 'address', 'offers_pickup', 'offers_delivery', 'ratings', 'image_url', 'owner_id', 'created_at', 'updated_at']
        });

        // Inserting owner-restaurant entry into the restaurant_owner_relationships table
        await RestaurantOwnerRelationship.create({
            owner_id,
            restaurant_id: restaurant.id,
            created_at: new Date(),
            updated_at: new Date()
        });

        res.status(200).json({ msg: "Restaurant Updated", updatedRestaurant });
    } catch (error) {
        res.status(500).json({ error: error.message });
        console.error(error);
    }
};


exports.deleteRestaurant = async (req, res) => {
    try {
        const restaurant = await Restaurant.findByPk(req.params.id);
        if (restaurant) {
            const restaurantName = restaurant.name;
            await Restaurant.destroy({ where: { id: req.params.id } });
            res.status(200).json({ msg: `Deleted Restaurant: ${restaurantName} (ID: ${restaurant.id})` });
        } else {
            res.status(404).json({ msg: `No Restaurant found with ID: ${req.params.id}` });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};