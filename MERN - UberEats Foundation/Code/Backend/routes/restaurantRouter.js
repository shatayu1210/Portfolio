const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurantController');

router.post('/', restaurantController.createRestaurant);
router.get('/', restaurantController.viewAllRestaurants);
router.get('/:id', restaurantController.viewSingleRestaurant);
router.get('/owner/:id', restaurantController.viewOwnerRestaurants);
router.put('/:id', restaurantController.updateRestaurant);
router.delete('/:id', restaurantController.deleteRestaurant);

module.exports = router;