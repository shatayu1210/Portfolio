import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logoutCustomer, logoutRestaurant } from "../../redux/slices/auth/authSlice";
import { selectOrderPreference, setOrderPreference } from "../../redux/slices/customer/cartSlice";
import "./Navbar.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import { selectCartItemsCount } from '../../redux/slices/customer/cartSlice';

// Add the CSS for delivery/pickup pill toggle here
const toggleStyles = `
.pill-toggle {
  position: relative;
  display: inline-flex;
  background-color: #f0f0f0;
  border-radius: 30px;
  padding: 3px;
  width: 160px;
  height: 32px;
  cursor: pointer;
}

.pill-toggle-option {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1;
  font-size: 0.8rem;
  font-weight: 500;
  color: #555;
  transition: color 0.3s;
}

.pill-toggle-option.active {
  color: #000;
}

.pill-toggle-slider {
  position: absolute;
  left: 3px;
  top: 3px;
  bottom: 3px;
  width: calc(50% - 3px);
  background-color: white;
  border-radius: 30px;
  transition: transform 0.3s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.pill-toggle[data-active="delivery"] .pill-toggle-slider {
  transform: translateX(calc(100% + 0px));
}
`;

const DEFAULT_PROFILE_IMAGE = "https://res.cloudinary.com/dvylvq84d/image/upload/v1744050200/profile_placeholder.png";
const DEFAULT_IMAGE_PLACEHOLDER = "https://res.cloudinary.com/dvylvq84d/image/upload/v1744151036/ImagePlaceholder_gg1xob.png";

const ImageDisplay = () => {
  const [imageUrl, setImageUrl] = useState(DEFAULT_PROFILE_IMAGE);
  const isRestaurantAuthenticated = useSelector((state) => state.auth.isRestaurantAuthenticated);
  const isCustomerAuthenticated = useSelector((state) => state.auth.isCustomerAuthenticated);
  const customer = useSelector((state) => state.auth.customer);
  const restaurant = useSelector((state) => state.auth.restaurant);
  const profileCustomer = useSelector((state) => state.customer.customer);
  const navigate = useNavigate();
  
  useEffect(() => {
    if (isCustomerAuthenticated) {
      // prefer updated image from profileCustomer slice
      const src = profileCustomer?.imageUrl || customer?.imageUrl || DEFAULT_PROFILE_IMAGE;
      setImageUrl(src);
    } else if (isRestaurantAuthenticated && restaurant) {
      setImageUrl(restaurant.imageUrl || DEFAULT_IMAGE_PLACEHOLDER);
    } else {
      setImageUrl(DEFAULT_PROFILE_IMAGE);
    }
  }, [isCustomerAuthenticated, isRestaurantAuthenticated, customer, restaurant, profileCustomer]);

  return (
    <div className="profile-image-container">
      <img
        src={imageUrl}
        alt="Profile"
        className="rounded-circle profile-image"
        style={{ 
          width: '80px', 
          height: '80px', 
          objectFit: 'cover', 
          margin: '10px auto', 
          display: 'block',
          border: '2px solid #e4e4e4'
        }}
        onError={(e) => {
          e.target.onerror = null; // Prevent infinite loop
          e.target.src = isRestaurantAuthenticated ? DEFAULT_IMAGE_PLACEHOLDER : DEFAULT_PROFILE_IMAGE;
        }}
      />
    </div>
  );
};

const NavSidebar = ({ hideToggle = false }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if current page is a restaurant detail page or cart page
  const shouldHideToggle = 
    hideToggle || 
    (location.pathname !== '/restaurants' && 
     location.pathname !== '/customer/favorites');

  // Get authentication state and cart items count from Redux
  const { isCustomerAuthenticated, isRestaurantAuthenticated, customer } = useSelector((state) => state.auth);
  const cartItemCount = useSelector(selectCartItemsCount);
  const restaurantId = useSelector((state) => state.auth.restaurant?.id);
  const orderPreference = useSelector(selectOrderPreference);

  // Toggle between delivery and pickup
  const toggleOrderPreference = () => {
    const newPreference = orderPreference === "delivery" ? "pickup" : "delivery";
    dispatch(setOrderPreference(newPreference));
  };

  // Close sidebar when clicking anywhere outside
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        isMenuOpen &&
        !event.target.closest(".sidebar") &&
        !event.target.closest(".menu-btn")
      ) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [isMenuOpen]);

  // Handle Logout
  const handleLogout = async () => {
    if (isCustomerAuthenticated) {
      await dispatch(logoutCustomer()).then(() => {
        navigate('/customer/login');
      });
    } else if (isRestaurantAuthenticated) {
      await dispatch(logoutRestaurant()).then(() => {
        navigate('/restaurant/login');
      });
    }
  };

  return (
    <>
      {/* Add CSS for pill toggle */}
      <style>{toggleStyles}</style>
      
      {/* Navbar */}
      <nav className="navbar navbar-expand-lg navbar-dark px-4">
        <div className="d-flex align-items-center">
          {/* Sidebar Toggle Button */}
          <button
            className="btn text-black fs-2 me-3 mb-1 menu-btn"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            &#9776;
          </button>
          <Link to="/" className="text-decoration-none">
            <span className="text-black fs-4">
              Uber <b>Eats</b>
            </span>
          </Link>
          
          {/* Add the pill toggle next to UberEats text, but hide it on restaurant detail pages */}
          {!shouldHideToggle && (
            <div className="pill-toggle ms-3" data-active={orderPreference} onClick={toggleOrderPreference}>
              <div className={`pill-toggle-option ${orderPreference === "pickup" ? "active" : ""}`}>
                Pickup
              </div>
              <div className={`pill-toggle-option ${orderPreference === "delivery" ? "active" : ""}`}>
                Delivery
              </div>
              <div className="pill-toggle-slider"></div>
            </div>
          )}
        </div>
        <div className="ms-auto d-flex align-items-center">
          {isCustomerAuthenticated && (
            <Link to="/cart" className="btn btn-white position-relative rounded-circle me-4 fs-4" 
              style={{ padding: "1px"}}>
              <strong>
                <i className="bi bi-cart-fill" style={{ fontWeight: "bold", fontSize: "1.3rem" }}></i>
              </strong>
              <span className="position-absolute top-0 start-100 translate-middle badge rounded-circle bg-success"
                style={{ 
                  fontSize: "0.8rem",  
                  padding: "4px 6px",  
                  transform: "translate(0%, 0%)" 
                }}>
                {cartItemCount}
              </span>
            </Link>
          )}
          {isCustomerAuthenticated || isRestaurantAuthenticated ? (
            <button className="btn btn-light mx-2 rounded-pill w-100"  style={{ backgroundColor: "#e4e4e4" }} onClick={handleLogout}>
              Logout
            </button>
          ) : (
            <>
              <Link to="/customer/login">
                <button className="btn btn-light me-2 rounded-pill" style={{ backgroundColor: "#e4e4e4" }}>
                  Log in
                </button>
              </Link>
              <Link to="/customer/signup">
                <button className="btn btn-dark rounded-pill">Sign up</button>
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Sidebar Overlay */}
      {isMenuOpen && (
        <div className="overlay" onClick={() => setIsMenuOpen(false)}></div>
      )}

      {/* Sidebar Menu */}
      <div className={`sidebar ${isMenuOpen ? "open" : ""}`}>
        {/* Conditionally render profile image if authenticated */}
        {(isCustomerAuthenticated || isRestaurantAuthenticated) && <ImageDisplay />}

        {isCustomerAuthenticated || isRestaurantAuthenticated ? (
          <>
            {/* Edit Profile Button */}
            {isCustomerAuthenticated && customer && (
              <Link to={`/customer/profile`}>
                <button className="btn btn-outline-dark mt-2 w-100">
                  Manage Profile
                </button>
              </Link>
            )}

            <button className="btn btn-light mt-2 w-100"  style={{ backgroundColor: "#e4e4e4" }} onClick={handleLogout}>
              Logout
            </button>
            {isCustomerAuthenticated && customer && (
              <>
                {/* Orders link for customer */}
                <Link to="/customer/orders">
                <button 
                  className="fw-bold mt-4 ms-0 px-2 py-0 text-start text-dark mb-0 w-100 border-0" 
                  style={{ backgroundColor: "transparent", cursor: "pointer" }}
                >
                  Orders   <i className="bi bi-bag text-black" style={{ fontSize: "0.8rem" }}></i>
                </button>
                </Link>
                {/* Orders link for customer */}
                <Link to="/customer/favorites">
                <button 
                  className="fw-bold mt-1 ms-0 px-2 py-0 text-start text-dark w-100 border-0" 
                  style={{ backgroundColor: "transparent", cursor: "pointer" }}
                >
                  Favorites   <i className="bi bi-heart text-black" style={{ fontSize: "0.8rem" }}></i>
                </button>
                </Link>
              </>
            )}
            {isRestaurantAuthenticated && (
              <>
                {/* No links for restaurant */}
              </>
            )}
          </>
        ) : (
          <>
            <Link to="/customer/login">
              <button className="btn w-100 mt-2 custom-grey-button">Log in</button>
            </Link>
            <Link to="/customer/signup">
              <button className="btn btn-dark w-100 mt-2">Sign up</button>
            </Link>
            <Link
              to="/restaurant/login"
              className="text-dark text-decoration-none d-block fw-bolder mt-3"
              style={{ fontSize: "14px" }}
            >
              Manage your Restaurant
            </Link>
            <Link
              to="/restaurant/signup"
              className="text-dark text-decoration-none d-block fw-bold mt-1"
              style={{ fontSize: "14px" }}
            >
              Sign up for a Restaurant
            </Link>
          </>
        )}
      </div>
    </>
  );
};

export default NavSidebar;