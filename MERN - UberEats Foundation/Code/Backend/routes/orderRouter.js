const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

router.post('/', orderController.createOrder);
router.get('/customer/:customer_id', orderController.viewAllOrdersCustomer);
router.get('/restaurant/:restaurant_id', orderController.viewAllOrdersRestaurant);
router.get('/:id', orderController.viewSingleOrder);
router.put('/:id', orderController.updateOrder);
router.delete('/:id', orderController.deleteOrder);

module.exports = router;