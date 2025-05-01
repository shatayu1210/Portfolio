import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { checkCustomerAuth, checkRestaurantAuth } from './redux/slices/auth/authSlice';
import { useDispatch, useSelector } from 'react-redux';

import LandingPage from './components/Landing/Landing';
import Footer from './components/Common/Footer';
import AboutUs from './components/Common/AboutUs';

// Customer
import CustomerSignup from './components/Auth/CustomerSignup';
import CustomerLogin from './components/Auth/CustomerLogin';
import CustomerHome from './components/Customer/CustomerHome';
import RestaurantDetail from './components/Customer/RestaurantDetail';
import CustomerEditProfile from './components/Customer/CustomerProfile';
import Cart from './components/Customer/Cart';
import CustomerOrders from './components/Customer/CustomerOrders';
import CustomerFavorites from './components/Customer/CustomerFavorites';

// Restaurant
import RestaurantSignup from './components/Auth/RestaurantSignup';
import RestaurantLogin from './components/Auth/RestaurantLogin';
import RestaurantDashboard from './components/Restaurant/RestaurantDashboard';
import ManageDishes from './components/Restaurant/ManageDishes';
import Performance from './components/Restaurant/Performance';

import './App.css';

// Protected route component for customers
const CustomerProtectedRoute = ({ children }) => {
  const { isCustomerAuthenticated, loading } = useSelector((state) => state.auth);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const dispatch = useDispatch();
  
  useEffect(() => {
    const checkAuth = async () => {
      await dispatch(checkCustomerAuth());
      setInitialCheckDone(true);
    };
    
    if (!isCustomerAuthenticated) {
      checkAuth();
    } else {
      setInitialCheckDone(true);
    }
  }, [dispatch, isCustomerAuthenticated]);
  
  if (!initialCheckDone || loading) {
    return <div className="d-flex justify-content-center mt-5"><div className="spinner-border text-success" role="status"></div></div>;
  }
  
  return isCustomerAuthenticated ? children : <Navigate to="/customer/login" state={{ signedOut: true }} />;
};

// Protected route component for restaurants
const RestaurantProtectedRoute = ({ children }) => {
  const { isRestaurantAuthenticated, loading } = useSelector((state) => state.auth);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const dispatch = useDispatch();
  
  useEffect(() => {
    const checkAuth = async () => {
      await dispatch(checkRestaurantAuth());
      setInitialCheckDone(true);
    };
    
    if (!isRestaurantAuthenticated) {
      checkAuth();
    } else {
      setInitialCheckDone(true);
    }
  }, [dispatch, isRestaurantAuthenticated]);
  
  if (!initialCheckDone || loading) {
    return <div className="d-flex justify-content-center mt-5"><div className="spinner-border text-success" role="status"></div></div>;
  }
  
  return isRestaurantAuthenticated ? children : <Navigate to="/restaurant/login" state={{ signedOut: true }} />;
};

// Wrapper component to handle conditional footer rendering
const AppContent = () => {
  const location = useLocation();
  const showFooter = location.pathname !== '/';

  return (
    <div className="d-flex flex-column min-vh-100">
      <div className="flex-grow-1">
        <Routes>
          {/* Landing */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/about" element={<AboutUs />} />

          {/* Customer */}
          <Route path="/customer/signup" element={<CustomerSignup />} />
          <Route path="/customer/login" element={<CustomerLogin />} />
          <Route path="/restaurants" element={<CustomerHome />} />
          <Route path="/restaurant/:id" element={<RestaurantDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/customer/profile" element={
            <CustomerProtectedRoute>
              <CustomerEditProfile />
            </CustomerProtectedRoute>
          } />
          <Route path="/customer/orders" element={
            <CustomerProtectedRoute>
              <CustomerOrders />
            </CustomerProtectedRoute>
          } />
          <Route path="/customer/favorites" element={
            <CustomerProtectedRoute>
              <CustomerFavorites />
            </CustomerProtectedRoute>
          } />

          {/* Restaurant */}
          <Route path="/restaurant/signup" element={<RestaurantSignup />} />
          <Route path="/restaurant/login" element={<RestaurantLogin />} />
          <Route path="/restaurant/dashboard" element={
            <RestaurantProtectedRoute>
              <RestaurantDashboard />
            </RestaurantProtectedRoute>
          } />
          <Route path="/restaurant/dishes" element={
            <RestaurantProtectedRoute>
              <ManageDishes />
            </RestaurantProtectedRoute>
          } />
          <Route path="/restaurant/performance" element={
            <RestaurantProtectedRoute>
              <Performance />
            </RestaurantProtectedRoute>
          } />
        </Routes>
      </div>
      {showFooter && <Footer />}
    </div>
  );
};

function App() {
  const dispatch = useDispatch();
  const [authChecked, setAuthChecked] = useState(false);
  const { isCustomerAuthenticated, isRestaurantAuthenticated } = useSelector((state) => state.auth);

  // Check customer and restaurant authentication when the app loads
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Run both auth checks in parallel
        await Promise.all([
          dispatch(checkCustomerAuth()),
          dispatch(checkRestaurantAuth())
        ]);
      } catch (error) {
        console.error("Error checking authentication:", error);
      } finally {
        setAuthChecked(true);
      }
    };
    
    checkAuth();
  }, [dispatch]);

  if (!authChecked) {
    return <div className="d-flex justify-content-center mt-5"><div className="spinner-border text-success" role="status"></div></div>;
  }

  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
