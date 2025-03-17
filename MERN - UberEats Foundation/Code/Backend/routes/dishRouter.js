const express = require('express');
const router = express.Router();
const dishController = require('../controllers/dishController');

router.post('/', dishController.createDish);
router.get('/', dishController.viewAllDishes);
router.get('/:id', dishController.viewSingleDish);
router.put('/:id', dishController.updateDish);
router.delete('/:id', dishController.deleteDish);
router.get('/restaurant/:id', dishController.viewDishesByRestaurant);

module.exports = router;