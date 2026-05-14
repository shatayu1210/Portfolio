const express = require('express');
const router = express.Router();
const { uploadImage } = require('../utils/imageUpload');
const customerController = require('../controllers/customerController');
const favoriteController = require('../controllers/favoriteController');
const { checkCustomer } = require('../utils/passport');
const passport = require('passport');

// Public routes
router.post('/register', customerController.register);
router.post('/login', customerController.login);
router.get('/check-auth', passport.authenticate('jwt', { session: false }), customerController.checkAuth);

// Protected routes
router.get('/profile/:id', checkCustomer, customerController.getProfile);
router.put('/profile/:id', checkCustomer, customerController.updateProfile);
router.post('/logout', checkCustomer, customerController.logout);

// Address management
router.post('/address', checkCustomer, customerController.addAddress);
router.put('/address/:addressId', checkCustomer, customerController.updateAddress);
router.delete('/address/:addressId', checkCustomer, customerController.deleteAddress);

// Favorite routes
router.post('/favorites/add', checkCustomer, favoriteController.addFavorite);
router.delete('/favorites/remove/:restaurantId', checkCustomer, favoriteController.removeFavorite);
router.get('/favorites/:id', checkCustomer, favoriteController.getFavorites);

// Account deletion
router.delete('/account/:id', checkCustomer, customerController.deleteAccount);

// Order management
router.post('/orders/create/:restaurantId', checkCustomer, customerController.createOrder);
router.get('/orders/:customerId', checkCustomer, customerController.getCustomerOrders);
router.get('/orders/single/:orderId', checkCustomer, customerController.getOrderDetails);
router.put('/orders/:orderId/cancel', checkCustomer, customerController.cancelOrder);

// Upload profile image
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

        const imageUrl = await uploadImage(file, 'customers');
        res.json({ imageUrl });
    } catch (error) {
        console.error('Error uploading customer image:', error);
        res.status(500).json({ message: 'Error uploading image' });
    }
});

module.exports = router;
