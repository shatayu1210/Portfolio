const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favouriteController');

router.post('/', favoriteController.addFavorite);
router.get('/:customer_id', favoriteController.getFavoritesByCustomer);
router.delete('/', favoriteController.removeFavorite);

module.exports = router;