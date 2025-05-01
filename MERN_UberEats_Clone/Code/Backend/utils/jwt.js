// This file is for generating JWT tokens for users after login
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

function generateToken(user) {
    return jwt.sign(
        { id: user._id, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

module.exports = { generateToken };
