const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/ratingController');
const { checkCustomer } = require('../utils/passport');

// Public routes
router.get('/restaurant/:restaurantId', ratingController.getRestaurantRatings);

// Recompute ratings
router.post('/recompute/:restaurantId', checkCustomer, ratingController.recompute);

// Customer routes
router.post('/restaurant/:restaurantId', checkCustomer, ratingController.createRating);
router.put('/:ratingId', checkCustomer, ratingController.updateRating);
router.delete('/:ratingId', checkCustomer, ratingController.deleteRating);

module.exports = router;
