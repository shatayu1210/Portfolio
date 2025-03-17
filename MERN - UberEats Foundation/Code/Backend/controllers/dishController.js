const { Dish, Restaurant } = require('../models');
const { Op } = require('sequelize');


exports.createDish = async (req, res) => {
    try {
        const { name, description, price, restaurant_id, size, image_url } = req.body;

        // Doing Basic validation
        if (!name || !price || !restaurant_id) {
            return res.status(400).json({ error: "Required fields are missing" });
        }

        // Checking if restaurant_id exists
        const restaurant = await Restaurant.findByPk(restaurant_id);
        if (!restaurant) {
            return res.status(400).json({ error: `Restaurant ID: ${restaurant_id} not found` });
        }

        // Creating Dish if Restaurant is Valid
        const dish = await Dish.create({
            name,
            description,
            price,
            restaurant_id,
            size: size || null,
            image_url: image_url || null
        });

        res.status(201).json({ msg: "Dish Created", dish });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            res.status(400).json({
              message: 'This dish with the same name, size, and restaurant already exists. Please check your entry.',
            });
        }
        else {
            res.status(500).json({ error: error.message });
        }
    }
};


exports.viewAllDishes = async (req, res) => {
    try {
        const dishes = await Dish.findAll({
            attributes: ['id', 'name', 'description', 'price', 'restaurant_id', 'size', 'image_url', 'created_at', 'updated_at']
        });
        res.status(200).json(dishes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


exports.viewDishesByRestaurant = async (req, res) => {
    try {
        const dishes = await Dish.findAll({
            where: { restaurant_id: req.params.id },
            attributes: ['id', 'name', 'description', 'price', 'restaurant_id', 'size', 'image_url', 'created_at', 'updated_at']
        });
        if (dishes.length > 0) {
            res.status(200).json(dishes);
        } else {
            res.status(404).json({ error: `No dishes found for Restaurant ID: ${req.params.id}` });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};



exports.viewSingleDish = async (req, res) => {
    try {
        const dish = await Dish.findByPk(req.params.id, {
            attributes: ['id', 'name', 'description', 'price', 'restaurant_id', 'size', 'image_url', 'created_at', 'updated_at']
        });
        if (dish) {
            res.status(200).json(dish);
        } else {
            res.status(404).json({ error: `No Dish found with ID: ${req.params.id}` });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


exports.updateDish = async (req, res) => {
    try {
        const { name, description, price, restaurant_id, size, image_url } = req.body;

        const dish = await Dish.findByPk(req.params.id);
        if (!dish) {
            return res.status(404).json({ error: `No Dish found with ID: ${req.params.id}` });
        }
        // Check if restaurant exists
        const restaurant = await Restaurant.findByPk(restaurant_id);
        if (restaurant_id && !restaurant) {
            return res.status(400).json({ error: `Restaurant ID: ${restaurant_id} not found` });
        }
        // Update Dish if valid Restaurant ID
        await Dish.update(
            { 
                name, 
                description, 
                price, 
                restaurant_id, 
                size: size || null, 
                image_url: image_url || null
            },
            { where: { id: req.params.id } }
        );
        const updatedDish = await Dish.findByPk(req.params.id, {
            attributes: ['id', 'name', 'description', 'price', 'restaurant_id', 'size', 'image_url', 'created_at', 'updated_at']
        });

        res.status(200).json({ msg: "Dish Updated", updatedDish });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


exports.deleteDish = async (req, res) => {
    try {
        const dish = await Dish.findByPk(req.params.id);
        if (dish) {
            await Dish.destroy({ where: { id: req.params.id } });
            res.status(200).json({ msg: `Deleted Dish: ${dish.name} (ID: ${dish.id})` });
        } else {
            res.status(404).json({ msg: `No Dish found with ID: ${req.params.id}` });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
