const bcrypt = require('bcrypt');
const { RestaurantOwner } = require('../models');
const { Op } = require('sequelize');


/* Authentication methods for restaurant owners */

// Handle restaurant owner login request
exports.restaurantOwnerLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Verify restaurant owner exists in the database
        const owner = await RestaurantOwner.findOne({ where: { email } });
        if (!owner) {
            return res.status(400).json({ error: "Invalid email or password" });
        }

        // Verify password matches
        const isMatch = await bcrypt.compare(password, owner.password);
        if (!isMatch) {
            return res.status(400).json({ error: "Invalid email or password" });
        }

        // Create secure session (excluding sensitive data)
        req.session.owner = {
            id: owner.id,
            first_name: owner.first_name,
            last_name: owner.last_name,
            email: owner.email,
            phone: owner.phone,
            address: owner.address
        };

        res.status(200).json({ message: "Login successful!", owner: req.session.owner });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// Verify owner authentication status
exports.checkOwnerAuth = (req, res) => {
    if (req.session && req.session.owner) {
        res.json({ isAuthenticated: true, owner: req.session.owner });
    } else {
        res.json({ isAuthenticated: false });
    }
};


// Handle restaurant owner logout
exports.restaurantOwnerLogout = (req, res) => {
    req.session.destroy(() => {
        res.json({ message: "Logged out successfully!" });
    });
};

/* CRUD operations for restaurant owners */

// Create new restaurant owner account
exports.createRestaurantOwner = async (req, res) => {
    try {
        const { first_name, last_name, email, password, phone, date_of_birth, image_url, address } = req.body;

        // Validate required fields
        if (!first_name || !last_name || !email || !password || !phone || !date_of_birth || !address) {
            return res.status(400).json({ error: "Required fields are missing" });
        }

        // Prevent duplicate email registrations
        const existingOwner = await RestaurantOwner.findOne({ where: { email } });
        if (existingOwner) {
            return res.status(400).json({ error: "Email is already in use" });
        }

        // Securely hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new restaurant owner record
        const owner = await RestaurantOwner.create({
            first_name,
            last_name,
            email,
            password: hashedPassword,
            phone,
            date_of_birth,
            image_url: image_url || null,  // Handle optional image
            address: address
        });

        res.status(201).json({ msg: "Restaurant Owner Created", owner });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// Retrieve all restaurant owners (admin function)
exports.viewAllRestaurantOwners = async (req, res) => {
    try {
        const owners = await RestaurantOwner.findAll({
            attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'date_of_birth', 'image_url', 'address', 'created_at', 'updated_at']
        });
        res.status(200).json(owners);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// Retrieve a specific restaurant owner by ID
exports.viewSingleRestaurantOwner = async (req, res) => {
    try {
        const owner = await RestaurantOwner.findByPk(req.params.id, {
            attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'date_of_birth', 'image_url', 'address', 'created_at', 'updated_at']
        });
        if (owner) {
            res.status(200).json(owner);
        } else {
            res.status(404).json({ error: `No Restaurant Owner found with ID: ${req.params.id}` });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// Update restaurant owner information
exports.updateRestaurantOwner = async (req, res) => {
    try {
        const { first_name, last_name, email, password, phone, date_of_birth, image_url, address } = req.body;

        const owner = await RestaurantOwner.findByPk(req.params.id);
        if (!owner) {
            return res.status(404).json({ error: `No Restaurant Owner found with ID: ${req.params.id}` });
        }

        // Validate required fields
        if (!first_name || !last_name || !email || !phone || !date_of_birth || !address) {
            return res.status(400).json({ error: "Required fields are missing" });
        }

        // Ensure email is not already used by another owner
        const existingOwner = await RestaurantOwner.findOne({
            where: {
                email,
                id: { [Op.ne]: req.params.id }
            }
        });
        if (existingOwner) {
            return res.status(400).json({ error: "Email is already in use by another owner" });
        }

        // Only hash password if it's being updated
        const hashedPassword = password ? await bcrypt.hash(password, 10) : owner.password;

        // Update owner record
        await RestaurantOwner.update(
            { 
                first_name, 
                last_name, 
                email, 
                password: hashedPassword, 
                phone, 
                date_of_birth, 
                image_url: image_url || null,
                address: address
            },
            { where: { id: req.params.id } }
        );

        const updatedOwner = await RestaurantOwner.findByPk(req.params.id, {
            attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'date_of_birth', 'image_url', 'address', 'created_at', 'updated_at']
        });

        res.status(200).json({ msg: "Restaurant Owner Updated", updatedOwner });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// Delete a restaurant owner account
exports.deleteRestaurantOwner = async (req, res) => {
    try {
        const owner = await RestaurantOwner.findByPk(req.params.id);
        if (owner) {
            const ownerName = `${owner.first_name} ${owner.last_name}`;
            await RestaurantOwner.destroy({ where: { id: req.params.id } });
            res.status(200).json({ msg: `Deleted Restaurant Owner: ${ownerName} (ID: ${owner.id})` });
        } else {
            res.status(404).json({ msg: `No Restaurant Owner found with ID: ${req.params.id}` });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};