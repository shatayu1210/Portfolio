const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

// Customer Authenticqtion
router.post('/login', customerController.customerLogin);
router.post('/logout', customerController.customerLogout);
router.get('/check-auth', customerController.checkCustomerAuth);

// Customer CRUD
router.post('/', customerController.createCustomer);
router.get('/', customerController.viewAllCustomers);
router.get('/:id', customerController.viewSingleCustomer);
router.put('/:id', customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);

module.exports = router;
