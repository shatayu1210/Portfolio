# UberEats Clone (MERN+Kafka+WebSocket+EKS)

## What Is This?
This is a full-stack food delivery web app inspired by UberEats, built using the MERN stack (MongoDB, Express.js, React.js with Redux, and Node.js). It supports both Customers and Restaurant Owners as separate user roles.
While the design takes inspiration from UberEats, most of the screens and interactions reflect my own creative spin and UI/UX thinking.
The complete app was containerized and deployed on Amazon EKS using a t3.small EC2 instance with 2 nodes. Everything was tested to ensure reliability and responsiveness.

## Key Features

### Customer Experience
- Easy signup and login
- Browse restaurants and their menus
- Add items to cart and place orders with a few clicks
- Store Multiple Labelled Personal Addresses
- Track your orders live in real-time
- Mark favorite restaurants
- Manage your profile with ease

### Restaurant Owner Tools
- Quick signup and authentication
- Manage restaurant details and menu
- Add, update or remove dishes or toggle their availability
- View and fulfill incoming customer orders in real-time

## How It's Built

### Frontend
- **React.js** for building reusable UI components
- **Redux** for clean state management across components
- **React Router** for smooth, route-based navigation
- **Bootstrap** for responsive, and minimalistic styling
- **JWT-based protected routes** for secure access control

### Backend
- **Node.js + Express.js** powering RESTful APIs
- **MongoDB Atlas with Mongoose** for offering flexible, evolving data models backed by built-in validations.
- **JWT Auth** for secure login and role-based access
- **Apache Kafka** to decouple high-traffic operations like order placement and updates
- **Socket.IO (WebSocket)** for real-time updates on restaurant dashboards and customer order history
- **Apache JMeter** to stress-test backend endpoints and validate their efficiency under concurrent load
- **Cloudinary** for scalable media storage
- **Apache JMeter** to stress-test vital backend endpoints and validate their efficiency under concurrent load

## Project Organization
- `Code/Frontend` - React app
- `Code/Backend` - Express.js API server
- `UI Snaps` - User Interface Screenshots
- `Apache Jmeter` - Load testing script and configuration
- `Docker` - Consisting of docker-compose.yml for containerizing the services(backend, frontend, zookeeper, kafka)
- `Kubernetes` - Kubernetes deployment manifests(.yaml) for Amazon EKS/Minikube deployment

## Design Philosophy
This app isn’t just about CRUD — I focused a lot on scalability and performance too:
- REST APIs are designed thoughtfully with clean URIs and consistent resource architecture
- Mongoose models come with validation to ensure data integrity
- Kafka + WebSocket architecture makes sure real-time updates and high-frequency operations don’t slow down the system
- Only essential data is transmitted — especially important when you start simulating scale
- Apache JMeter was used to simulate real-world load and validate backend efficiency

## Quick Start Guide

### Backend Setup
1. Navigate to the Backend folder:
   ```
   cd Code/Backend
   ```
2. Install required packages:
   ```
   npm install
   ```
3. Create `.env` file with your settings:
   ```
   PORT=3000
   JWT_SECRET=JWT_SECRET
   MONGODB_URI=<uri>
   CLOUDINARY_CLOUD_NAME=<>
   CLOUDINARY_API_KEY=<>
   CLOUDINARY_API_SECRET=<>
   KAFKA_BROKER=localhost:9092
   VITE_API_URL=http://localhost:3000
   ```
4. Start the server:
   ```
   node server.js
   ```

### Frontend Setup
1. Navigate to the Frontend folder:
   ```
   cd Code/Frontend
   ```
2. Install required packages:
   ```
   npm install
   ```
3. Launch development server:
   ```
   npm run dev
   ```

## Future Plans
- Add Stripe or PayPal for online payments
- Build a driver portal for delivery tracking
- Developed an advanced analytics dashboard for restaurants offering interactivity and granular controls
- Create a mobile version (React Native or Flutter)

## Contributing
This is an individual project developed as a portfolio piece. The codebase is available for reference and educational purposes.

## License
MIT License 