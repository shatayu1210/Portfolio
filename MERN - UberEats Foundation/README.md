# UberEats Clone - Food Delivery Platform

## What Is This?
A complete food delivery app similar to UberEats built with MySQL, Express, React, and Node.js. Customers can find restaurants and order food, while restaurant owners can manage menus and fulfill orders.

## Key Features

### Customer Experience
- Simple account creation and login
- Browse nearby restaurants
- View restaurant menus with appealing dish photos
- Easy cart management and ordering
- Order tracking
- Save favorite restaurants for quick access
- Update personal profile

### Restaurant Owner Tools
- Quick signup and authentication
- Manage restaurant profiles and menus
- Add, edit or remove dishes
- Track and fulfill incoming orders

## Tech Stack

### Frontend
- **React** - Modern UI components
- **Redux** - State management
- **Bootstrap** - Responsive design
- **React Router** - Seamless navigation

### Backend
- **Node.js & Express** - Fast API server
- **MySQL & Sequelize** - Robust data storage
- **Express Session & Bcrypt** - Secure authentication
- **Multer** - Image upload handling

## Project Organization
- `Code/Frontend` - React application
- `Code/Backend` - Express API server
- `Postman API Collections` - API testing tools

## Quick Start Guide

### Backend Setup
1. Open the backend folder:
   ```
   cd Code/Backend
   ```
2. Install packages:
   ```
   npm install
   ```
3. Create `.env` file with your settings:
   ```
   PORT=3000
   DB_HOST=localhost
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=your_db_name
   SESSION_SECRET=your_session_secret
   ```
4. Start the server:
   ```
   npm start
   ```

### Frontend Setup
1. Open the frontend folder:
   ```
   cd Code/Frontend
   ```
2. Install packages:
   ```
   npm install
   ```
3. Launch development server:
   ```
   npm run dev
   ```

## Future Plans
- Real-time delivery tracking
- Online payment processing
- Dedicated delivery driver interface
- Mobile app versions
- Advanced restaurant analytics

## Contributing
This is an individual project developed as a portfolio piece. The codebase is available for reference and educational purposes.

## License
MIT License 