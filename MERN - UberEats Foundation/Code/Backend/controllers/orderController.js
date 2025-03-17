const { Order, OrderItem, Dish, Customer, Restaurant } = require('../models');
const { Op } = require('sequelize');


exports.createOrder = async (req, res) => {
    try {
        const { customer_id, restaurant_id, order_type, order_items } = req.body;

        // Basic validation
        if (!customer_id || !restaurant_id || !order_items || order_items.length === 0) {
            return res.status(400).json({ error: 'Missing required fields or no items in the order' });
        }

        // Checking if customer_id exists
        const customer = await Customer.findByPk(customer_id);
        if (!customer) {
            return res.status(404).json({ error: `Customer with ID: ${customer_id} not found` });
        }

        // Check if restaurant_id exists
        const restaurant = await Restaurant.findByPk(restaurant_id);
        if (!restaurant) {
            return res.status(404).json({ error: `Restaurant with ID: ${restaurant_id} not found` });
        }

        // Check if the restaurant offers the requested order_type
        if (order_type.toLowerCase() === 'delivery' && !restaurant.offers_delivery) {
            return res.status(400).json({ error: `${restaurant.name} doesn't offer Delivery` });
        }

        if (order_type.toLowerCase() === 'pickup' && !restaurant.offers_pickup) {
            return res.status(400).json({ error: `${restaurant.name} doesn't offer Pickup` });
        }

        // Check if each dish_id in order_items is valid
        const dishIds = order_items.map(item => item.dish_id);
        const dishes = await Dish.findAll({
            where: {
                id: { [Op.in]: dishIds },
            },
            attributes: ['id', 'price', 'name', 'description', 'size']
        });

        if (dishes.length !== dishIds.length) {
            return res.status(400).json({ error: 'One or more dish IDs are invalid' });
        }

        // Validate the quantity of each order item
        for (const item of order_items) {
            if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
                return res.status(400).json({ error: 'Quantity should be greater than zero and should be an integer' });
            }
        }

        let calculatedTotal = 0;

        // Loop through order items and calculate total
        for (const item of order_items) {
            const dish = dishes.find(d => d.id === item.dish_id);
            if (dish) {
                calculatedTotal += dish.price * item.quantity;
            }
        }

        // Generating unique order_number with 'O' followed by 7 random digits
        const order_number = 'O' + Math.floor(1000000 + Math.random() * 9000000).toString();

        // Creating new order entry with the calculated total
        const newOrder = await Order.create({
            customer_id,
            restaurant_id,
            order_type,
            total: calculatedTotal, 
            order_number,
            status: 'pending',
        });

        // Creating the order items associated with this order
        await createOrderItems(newOrder.id, order_items, dishes);

        // Create a response object with dish details and quantity
        const orderItemsWithDetails = order_items.map(item => {
            const dish = dishes.find(d => d.id === item.dish_id);
            return {
                ...dish.toJSON(),  // Convert dish data to a plain object
                quantity: item.quantity
            };
        });

        // Returning the created order details
        res.status(201).json({
            message: 'Order placed successfully',
            order_id: newOrder.id,
            order_number: order_number,
            order_number: newOrder.order_number,
            total: calculatedTotal,
            items: orderItemsWithDetails   // Return calculated total in the response
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// Helper function to create order items
async function createOrderItems(orderId, items, dishes) {
    for (const item of items) {
        const { dish_id, size, quantity, price } = item;

        // Find the dish in the fetched dishes data
        const dish = dishes.find(d => d.id === dish_id);
        if (!dish) {
            throw new Error(`Dish with ID ${dish_id} not found`);
        }

        // Use the size and price from the fetched dish data if not provided in the request
        const finalSize = size || dish.size;
        const finalPrice = price || dish.price;

        // Create the order item record in the order_items table
        await OrderItem.create({
            order_id: orderId,
            dish_id,
            size: finalSize,
            quantity,
            price: finalPrice,
        });
    }
}


// View all Customer Orders
exports.viewAllOrdersCustomer = async (req, res) => {
    try {
        const { customer_id } = req.params;
        const orders = await Order.findAll({
            where: { customer_id },
            attributes: ['id', 'customer_id', 'restaurant_id', 'status', 'order_number', 'created_at', 'updated_at', 'total', 'order_type'],
            include: [
                { model: Customer, attributes: ['id', 'first_name', 'last_name'] },
                { model: Restaurant, attributes: ['id', 'name', 'address'] },
            ],
        });
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// View all Restaurant Orders
exports.viewAllOrdersRestaurant = async (req, res) => {
    try {
        const { restaurant_id } = req.params;
        const orders = await Order.findAll({
            where: { restaurant_id },
            attributes: ['id', 'customer_id', 'restaurant_id', 'status', 'order_number', 'created_at', 'updated_at', 'total', 'order_type'],
            include: [
                { model: Customer, attributes: ['id', 'first_name', 'last_name'] },
                { model: Restaurant, attributes: ['id', 'name', 'address'] },
            ],
        });
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// Function to view a single detailed order by ID
exports.viewSingleOrder = async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.id, {
            attributes: ['id', 'customer_id', 'restaurant_id', 'status', 'order_number', 'created_at', 'updated_at', 'total', 'order_type'],
            include: [
                // Include Customer details
                { model: Customer, attributes: ['first_name', 'last_name', 'address'] },

                // Include Restaurant details
                { model: Restaurant, attributes: ['name', 'description', 'email', 'image_url', 'phone', 'address', 'ratings'] },

                // Include OrderItems and associated Dish details
                { 
                    model: OrderItem,
                    attributes: ['id', 'quantity', 'size', 'price'],  
                    include: [
                        { 
                            model: Dish, 
                            attributes: ['id', 'name', 'description', 'price', 'size', 'image_url']
                        }
                    ]
                }
            ]
        });

        if (order) {
            res.status(200).json(order);
        } else {
            res.status(404).json({ error: `No Order found with ID: ${req.params.id}` });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// Function to update an order status
exports.updateOrder = async (req, res) => {
    try {
        const url_id = req.params.id;
        const { status } = req.body;

        // Check if order exists by id
        const order = await Order.findOne({ where: { id: url_id } });
        if (!order) {
            return res.status(404).json({
                error: `No Entry found for Order ID: ${url_id}`,
            });
        }

        // Validate status if provided
        let lower_status = status?.toLowerCase();
        if (status) {
            const validStatuses = ['pending', 'processing', 'out for delivery', 'delivered', 'cancelled'];
            if (!validStatuses.includes(lower_status)) {
                return res.status(400).json({
                    error: 'Status must be one of: pending, processing, out for delivery, cancelled, delivered',
                });
            }
        }

        // Build update object dynamically
        const updateFields = {};
        if (status) updateFields.status = lower_status;

        // Only update if there are changes
        if (Object.keys(updateFields).length > 0) {
            await Order.update(updateFields, { where: { id: url_id } });
        }

        const updatedOrder = await Order.findByPk(url_id, {
            attributes: ['id', 'customer_id', 'restaurant_id', 'status', 'order_number', 'created_at', 'updated_at', 'total', 'order_type'],
        });

        res.status(200).json({ msg: 'Order Updated', updatedOrder });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


exports.deleteOrder = async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.id);
        if (order) {
            await Order.destroy({ where: { id: req.params.id } });
            res.status(200).json({ msg: `Deleted Order Number: ${order.order_number} (ID: ${order.id})` });
        } else {
            res.status(404).json({ msg: `No Order found with ID: ${req.params.id}` });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};