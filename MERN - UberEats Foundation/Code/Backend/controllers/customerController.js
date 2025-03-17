const bcrypt = require('bcrypt');
const { Customer } = require('../models');
const { Op } = require('sequelize');


/* Authentication methods for customers */

// Process customer login
exports.customerLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Verify customer exists in database
        const customer = await Customer.findOne({ where: { email } });
        if (!customer) {
            return res.status(400).json({ error: "Invalid email or password" });
        }

        // Verify password match
        const isMatch = await bcrypt.compare(password, customer.password);
        if (!isMatch) {
            return res.status(400).json({ error: "Invalid email or password" });
        }

        // Create secure session (excluding sensitive data)
        req.session.customer = {
            id: customer.id,
            first_name: customer.first_name,
            last_name: customer.last_name,
            email: customer.email,
            phone: customer.phone,
            address: customer.address
        };

        res.status(200).json({ message: "Login successful!", customer: req.session.customer });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// Handle customer logout
exports.customerLogout = (req, res) => {
    req.session.destroy(() => {
        res.json({ message: "Logged out successfully!" });
    });
};


// Verify customer authentication status
exports.checkCustomerAuth = (req, res) => {
    if (req.session && req.session.customer) {
        res.json({ isAuthenticated: true, customer: req.session.customer });
    } else {
        res.json({ isAuthenticated: false });
    }
};


/* CRUD operations for customers */

// Register a new customer account
exports.createCustomer = async (req, res) => {
    try {
        const { first_name, last_name, email, password, phone, address, date_of_birth, image_url } = req.body;

        // Validate required information
        if (!first_name || !last_name || !email || !password || !phone || !address || !date_of_birth) {
            return res.status(400).json({ error: "All fields are required" });
        }
 
        // Prevent duplicate email registrations
        const existingCustomer = await Customer.findOne({ where: { email } });
        if (existingCustomer) {
            return res.status(400).json({ error: "Email is already in use" });
        }

        // Securely hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create customer record
        const customer = await Customer.create({
            first_name,
            last_name,
            email,
            password: hashedPassword,
            phone,
            address,
            date_of_birth,
            image_url: image_url || null, // Handle optional profile image
        });

        res.status(201).json({ msg: "Created Customer Successfully", customer });
    }
    catch(error) {
        res.status(500).json({ error: error.message });
    }
};


// Retrieve all customers (admin function)
exports.viewAllCustomers = async (req, res) => {
    try {
        // Exclude sensitive data from response
        const customers = await Customer.findAll({
            attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'address', 'date_of_birth', 'created_at', 'updated_at', 'image_url']
        });
        res.status(200).json(customers);
    }
    catch(error) {
        res.status(500).json({ error: error.message });
    }
};


// Retrieve a specific customer by ID
exports.viewSingleCustomer = async (req, res) => {
    try {
        const customer = await Customer.findByPk(req.params.id, {
            attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'address', 'date_of_birth', 'created_at', 'updated_at', 'image_url']
        });
        if(customer) {
            res.status(200).json(customer);
        }
        else {
            res.status(404).json({ error: `Customer Not Found for ID: ${req.params.id}` });
        }
    }
    catch(error) {
        res.status(500).json({ error: error.message });
    }
};


// Update customer information
exports.updateCustomer = async (req, res) => {
    try {
        const { first_name, last_name, email, phone, address, date_of_birth } = req.body;

        // Validate required fields
        if (!first_name || !last_name || !email || !phone || !address || !date_of_birth) {
            return res.status(400).json({ error: "Required fields are missing" });
        }

        // Verify customer exists
        const customer = await Customer.findByPk(req.params.id);
        if (!customer) {
            return res.status(404).json({ error: `Customer Not Found for ID: ${req.params.id}` });
        }

        // Ensure email is not already used by another customer
        const existingCustomer = await Customer.findOne({
            where: {
                email,
                id: { [Op.ne]: req.params.id }
            }
        });
        if (existingCustomer) {
            return res.status(400).json({ error: "Email is already in use by another customer" });
        }

        // Prepare update data
        const updateData = { 
            first_name, 
            last_name, 
            email, 
            phone, 
            address, 
            date_of_birth
        };
        
        // Handle optional image update
        if (req.body.image_url !== undefined) {
            updateData.image_url = req.body.image_url;
        }
        
        // Only update password if provided
        if (req.body.password) {
            updateData.password = await bcrypt.hash(req.body.password, 10);
        }

        // Update customer record
        const [updated] = await Customer.update(
            updateData,
            { where: { id: req.params.id } }
        );

        if (updated) {
            // Return updated information (excluding password)
            const updatedCustomer = await Customer.findByPk(req.params.id, {
                attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'address', 'date_of_birth', 'image_url', 'created_at', 'updated_at']
            });
            
            // Update session if this is the logged-in customer
            if (req.session && req.session.customer && req.session.customer.id === parseInt(req.params.id)) {
                req.session.customer = {
                    id: updatedCustomer.id,
                    first_name: updatedCustomer.first_name,
                    last_name: updatedCustomer.last_name,
                    email: updatedCustomer.email,
                    phone: updatedCustomer.phone,
                    address: updatedCustomer.address
                };
            }
            
            res.status(200).json({ 
                msg: `Updated Customer: ${updatedCustomer.first_name}`, 
                customer: updatedCustomer 
            });
        } else {
            res.status(404).json({ error: `No Customer found with ID: ${req.params.id}` });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// Delete a customer account
exports.deleteCustomer = async (req, res) => {
    try {
        const customer = await Customer.findByPk(req.params.id);
        if (customer) {
            // Store customer info before deletion
            const { id, first_name, last_name } = customer;
            
            // Remove customer record
            await Customer.destroy({ where: { id: req.params.id } });
            
            res.status(200).json({ msg: `Deleted Customer ${first_name} ${last_name} (ID: ${id})` });
        } else {
            res.status(404).json({ msg: `No Customer Found by ID: ${req.params.id}` });
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
