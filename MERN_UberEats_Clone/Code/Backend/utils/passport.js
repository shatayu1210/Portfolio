const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const passport = require('passport');
const mongoose = require('mongoose');
const Customer = require('../models/customer');
const Restaurant = require('../models/restaurant');
const { JWT_SECRET } = process.env;

function configurePassport() {
    const opts = {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: JWT_SECRET || 'your_jwt_secret_key',
    };
    passport.use(new JwtStrategy(opts, async (jwt_payload, done) => {
        try {
            let user = null;
            if (jwt_payload.role === 'customer') {
                user = await Customer.findById(new mongoose.Types.ObjectId(jwt_payload.id));
            } else if (jwt_payload.role === 'restaurant') {
                user = await Restaurant.findById(new mongoose.Types.ObjectId(jwt_payload.id));
            }
            if (user) {
                return done(null, { ...user.toObject(), role: jwt_payload.role });
            } else {
                return done(null, false);
            }
        } catch (error) {
            return done(error, false);
        }
    }));
}

const checkAuth = (req, res, next) => {
    passport.authenticate('jwt', { session: false }, (err, user) => {
        if (err) return res.status(500).json({ message: 'Internal Server Error' });
        if (!user) return res.status(401).json({ message: 'Unauthorized - Please log in' });
        req.user = user;
        next();
    })(req, res, next);
};

const checkCustomer = (req, res, next) => {
    checkAuth(req, res, () => {
        if (req.user && req.user.role === 'customer') {
            next();
        } else {
            return res.status(403).json({ message: 'Forbidden - Customer access required' });
        }
    });
};

const checkRestaurant = (req, res, next) => {
    checkAuth(req, res, () => {
        if (req.user && req.user.role === 'restaurant') {
            next();
        } else {
            return res.status(403).json({ message: 'Forbidden - Restaurant access required' });
        }
    });
};

module.exports = { configurePassport, checkAuth, checkCustomer, checkRestaurant };
