# UberEats Clone - Backend API

## What This Does
Powers the food delivery app with a robust REST API handling user accounts, restaurant data, menu management, and order processing. Built on Node.js and Express with a MySQL database.

## Tech Stack Highlights
- **Node.js** - JavaScript runtime for server-side logic
- **Express** - Fast, minimal web framework
- **MySQL** - Reliable relational database
- **Sequelize** - ORM for intuitive database operations
- **Express Session** - Secure authentication handling
- **Bcrypt** - Password encryption
- **Multer** - Image upload management

## API Endpoints Map

### User Authentication
- `POST /api/customers/login` - Log in as customer
- `POST /api/customers/logout` - End customer session
- `GET /api/customers/auth` - Verify customer login status
- `POST /api/restaurantOwners/login` - Log in as restaurant owner
- `POST /api/restaurantOwners/logout` - End owner session
- `GET /api/restaurantOwners/auth` - Verify owner login status

### Customer Management
- `POST /api/customers` - Register new customer
- `GET /api/customers` - List all customers (admin)
- `GET /api/customers/:id` - Get customer details
- `PUT /api/customers/:id` - Update customer info
- `DELETE /api/customers/:id` - Remove customer account

### Restaurant Owner Management
- `POST /api/restaurantOwners` - Register new owner
- `GET /api/restaurantOwners` - List all owners (admin)
- `GET /api/restaurantOwners/:id` - Get owner details
- `PUT /api/restaurantOwners/:id` - Update owner info
- `DELETE /api/restaurantOwners/:id` - Remove owner account

### Restaurant Management
- `POST /api/restaurants` - Add new restaurant
- `GET /api/restaurants` - List all restaurants
- `GET /api/restaurants/:id` - Get restaurant details
- `PUT /api/restaurants/:id` - Update restaurant info
- `DELETE /api/restaurants/:id` - Remove restaurant
- `GET /api/restaurants/owner/:ownerId` - Get owner's restaurants

### Menu Management
- `POST /api/dishes` - Add new dish
- `GET /api/dishes` - List all dishes
- `GET /api/dishes/:id` - Get dish details
- `PUT /api/dishes/:id` - Update dish info
- `DELETE /api/dishes/:id` - Remove dish
- `GET /api/dishes/restaurant/:restaurantId` - Get restaurant's menu

### Order Processing
- `POST /api/orders` - Create new order
- `GET /api/orders` - List all orders (admin)
- `GET /api/orders/:id` - Get order details
- `PUT /api/orders/:id` - Update order status
- `GET /api/orders/restaurant/:restaurantId` - Get restaurant's orders
- `GET /api/orders/customer/:customerId` - Get customer's orders

### Favorites Handling
- `POST /api/favorites` - Add restaurant to favorites
- `GET /api/favorites/:customerId` - List customer's favorites
- `DELETE /api/favorites` - Remove from favorites

## Setup Instructions

### Requirements
- Node.js 14+
- MySQL server
- npm or yarn

### Quick Start
1. Install dependencies:
   ```
   npm install
   ```

2. Set up environment variables in `.env`:
   ```
   PORT=3000
   DB_HOST=localhost
   DB_USER=your_username
   DB_PASSWORD=your_password
   DB_NAME=ubereats_clone
   SESSION_SECRET=your_secret_key
   ```

3. Run database migrations:
   ```
   npx sequelize-cli db:migrate
   ```

4. Start the server:
   ```
   npm start
   ```

## Database Design
The app uses these Sequelize models:
- **Customer** - End user who orders food
- **RestaurantOwner** - Business manager
- **Restaurant** - Food establishment details
- **Dish** - Menu items with details and pricing
- **Order** - Transaction records
- **OrderItem** - Individual items in orders
- **Favourite** - Saved restaurants for customers

## File Upload System
Handles images for:
- Customer profiles
- Restaurant owner profiles
- Restaurant images
- Dish photos

Files are stored in `/public/uploads/` directory.

## Contributing
This is an individual project developed as a portfolio piece. The codebase is available for reference and educational purposes. 