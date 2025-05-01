const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurantController');
const { checkRestaurant } = require('../utils/passport');
const { uploadImage } = require('../utils/imageUpload');
const passport = require('passport');

// Public routes
router.post('/register', restaurantController.register);
router.post('/login', restaurantController.login);
router.get('/check-auth', passport.authenticate('jwt', { session: false }), restaurantController.checkAuth);
router.get('/', restaurantController.getAllRestaurants);

// Protected routes
router.post('/logout', checkRestaurant, restaurantController.logout);
router.get('/profile/:restaurantId', checkRestaurant, restaurantController.getRestaurantProfile);
router.put('/profile/:restaurantId', checkRestaurant, restaurantController.updateRestaurantProfile);
router.put('/operating-hours/:restaurantId', checkRestaurant, restaurantController.updateOperatingHours);
router.put('/status/:restaurantId', checkRestaurant, restaurantController.toggleStatus);
router.put('/delivery/:restaurantId', checkRestaurant, restaurantController.toggleDelivery);
router.put('/pickup/:restaurantId', checkRestaurant, restaurantController.togglePickup);
router.delete('/account/:restaurantId', checkRestaurant, restaurantController.deleteRestaurant);

// Image upload route
router.post('/upload-image', async (req, res) => {
  try {
    if (!req.files || !req.files.image) {
      return res.status(400).json({ message: 'No image file uploaded' });
    }

    // Check if multiple files were uploaded
    if (Array.isArray(req.files.image)) {
      return res.status(400).json({ message: 'Multiple file upload is not allowed. Please upload a single image.' });
    }

    const file = req.files.image;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ 
        message: 'Invalid file type. Only JPG, JPEG, and PNG images are allowed' 
      });
    }

    const imageUrl = await uploadImage(file, 'restaurants');
    res.json({ imageUrl });
  } catch (error) {
    console.error('Error uploading restaurant image:', error);
    res.status(500).json({ message: 'Error uploading image' });
  }
});

// Order management
router.get('/:restaurantId/orders', checkRestaurant, restaurantController.getRestaurantOrders);
router.get('/orders/:orderId', checkRestaurant, restaurantController.getRestaurantOrderDetails);
router.put('/orders/:orderId/status', checkRestaurant, restaurantController.updateOrderStatus);

// Public Get restaurant by ID
router.get('/:id', restaurantController.getRestaurantById);

module.exports = router;
