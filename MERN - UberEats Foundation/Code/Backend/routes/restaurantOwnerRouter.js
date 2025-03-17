const express = require('express');
const router = express.Router();
const restaurantOwnerController = require('../controllers/restaurantOwnerController');

// Owner Authentication
router.post('/login', restaurantOwnerController.restaurantOwnerLogin);
router.post('/logout', restaurantOwnerController.restaurantOwnerLogout);
router.get('/check-auth', restaurantOwnerController.checkOwnerAuth);

// Owner CRUD
router.post('/', restaurantOwnerController.createRestaurantOwner);
router.get('/', restaurantOwnerController.viewAllRestaurantOwners);
router.get('/:id', restaurantOwnerController.viewSingleRestaurantOwner);
router.put('/:id', restaurantOwnerController.updateRestaurantOwner);
router.delete('/:id', restaurantOwnerController.deleteRestaurantOwner);

module.exports = router;
