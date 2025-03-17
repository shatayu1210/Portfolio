import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { checkCustomerAuth, checkOwnerAuth } from './redux/slices/auth/authSlice';
import { useDispatch, useSelector } from 'react-redux';

import LandingPage from './components/Landing/Landing';

// Customer
import CustomerSignup from './components/Auth/CustomerSignup';
import CustomerLogin from './components/Auth/CustomerLogin';
import CustomerHome from './components/Customer/CustomerHome';
import RestaurantDetail from './components/Customer/RestaurantDetail';
import CustomerEditProfile from './components/Customer/CustomerProfile';
import Cart from './components/Customer/Cart';
import CustomerOrders from './components/Customer/CustomerOrders';
import CustomerFavorites from './components/Customer/CustomerFavorites';


// Owner
import OwnerSignup from './components/Auth/RestaurantOwnerSignup';
import OwnerLogin from './components/Auth/RestaurantOwnerLogin';
import OwnerRestaurantList from './components/Owner/OwnerRestaurantList';
import RestaurantOrders from './components/Owner/RestaurantOrders';
import OwnerEditProfile from './components/Owner/OwnerProfile';

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
    return <div className="d-flex justify-content-center mt-5"><div className="spinner-border" role="status"></div></div>;
  }
  
  return isCustomerAuthenticated ? children : <Navigate to="/customer/login" state={{ signedOut: true }} />;
};

// Protected route component for restaurant owners
const OwnerProtectedRoute = ({ children }) => {
  const { isOwnerAuthenticated, loading } = useSelector((state) => state.auth);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const dispatch = useDispatch();
  
  useEffect(() => {
    const checkAuth = async () => {
      await dispatch(checkOwnerAuth());
      setInitialCheckDone(true);
    };
    
    if (!isOwnerAuthenticated) {
      checkAuth();
    } else {
      setInitialCheckDone(true);
    }
  }, [dispatch, isOwnerAuthenticated]);
  
  if (!initialCheckDone || loading) {
    return <div className="d-flex justify-content-center mt-5"><div className="spinner-border" role="status"></div></div>;
  }
  
  return isOwnerAuthenticated ? children : <Navigate to="/owner/login" state={{ signedOut: true }} />;
};

function App() {
  const dispatch = useDispatch();
  const [authChecked, setAuthChecked] = useState(false);
  const { isCustomerAuthenticated, isOwnerAuthenticated } = useSelector((state) => state.auth);

  // Check customer and restaurant owner authentication when the app loads
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Run both auth checks in parallel
        await Promise.all([
          dispatch(checkCustomerAuth()),
          dispatch(checkOwnerAuth())
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
    return <div className="d-flex justify-content-center mt-5"><div className="spinner-border" role="status"></div></div>;
  }

  return (
    <Router>
      <Routes>
        {/* Landing */}
        <Route path="/" element={<LandingPage />} />

        {/* Customer */}
        <Route path="/customer/signup" element={<CustomerSignup />} />
        <Route path="/customer/login" element={<CustomerLogin />} />
        <Route path="/customer/profile/:id" element={<CustomerEditProfile />} />
        <Route path="/customer/home" element={
          <CustomerProtectedRoute>
            <CustomerHome />
          </CustomerProtectedRoute>
        } />
        <Route path="/restaurant/:id" element={
          <CustomerProtectedRoute>
            <RestaurantDetail />
          </CustomerProtectedRoute>
        } />
        <Route path="/cart" element={<Cart />} />
        <Route path="/customer/orders" element={<CustomerOrders />} />
        <Route path="/customer/favorites" element={<CustomerFavorites />} />


        {/* Owner */}
        <Route path="/owner/signup" element={<OwnerSignup />} />
        <Route path="/owner/login" element={<OwnerLogin />} />
        <Route path="/owner/home" element={
          <OwnerProtectedRoute>
            <OwnerRestaurantList />
          </OwnerProtectedRoute>
        } />
        <Route path="/owner/restaurants/:restaurantId/orders" element={
          <OwnerProtectedRoute>
            <RestaurantOrders />
          </OwnerProtectedRoute>
        } />
        <Route path="/owner/profile/:id" element={<OwnerEditProfile />} />


      </Routes>
    </Router>
  );
}

export default App
