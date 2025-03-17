import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logoutUser, logoutRestaurantOwner } from "../../redux/slices/auth/authSlice";
import "./Navbar.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import { selectCartItemsCount } from '../../redux/slices/customer/cartSlice';
import axios from "axios";
axios.defaults.withCredentials = true;

const ImageDisplay = () => {
  const [imageUrl, setImageUrl] = useState("");
  const customerId = useSelector((state) => state.auth.customer?.id);
  const ownerId = useSelector((state) => state.auth.restaurantOwner?.id);
  const isOwnerAuthenticated = useSelector((state) => state.auth.isOwnerAuthenticated);
  const isCustomerAuthenticated = useSelector((state) => state.auth.isCustomerAuthenticated);
  const navigate = useNavigate();
  
  useEffect(() => {
    // For customer profile picture
    if (isCustomerAuthenticated && customerId) {
      axios
        .get(`http://127.0.0.1:3000/api/customers/${customerId}`)
        .then((response) => {
          console.log('Customer data:', response.data);
          if (response.data.image_url) {
            setImageUrl(`http://127.0.0.1:3000${response.data.image_url}`);
          } else {
            setImageUrl("http://127.0.0.1:3000/uploads/blank.png"); // Default image
          }
        })
        .catch((error) => {
          console.error("Error fetching customer image:", error);
          setImageUrl("http://127.0.0.1:3000/uploads/blank.png"); // Default image
        });
    } 
    // For restaurant owner profile picture
    else if (isOwnerAuthenticated && ownerId) {
      axios
        .get(`http://127.0.0.1:3000/api/restaurantOwners/${ownerId}`)
        .then((response) => {
          console.log('Owner data:', response.data);
          if (response.data.image_url) {
            setImageUrl(`http://127.0.0.1:3000${response.data.image_url}`);
          } else {
            setImageUrl("http://127.0.0.1:3000/uploads/blank.png"); // Default image
          }
        })
        .catch((error) => {
          console.error("Error fetching owner image:", error);
          setImageUrl("http://127.0.0.1:3000/uploads/blank.png"); // Default image
        });
    } else {
      setImageUrl("http://127.0.0.1:3000/uploads/blank.png"); // Default image
    }
  }, [customerId, ownerId, isCustomerAuthenticated, isOwnerAuthenticated]);

  return (
    <div className="profile-image-container">
      {imageUrl && (
        <img
          src={imageUrl}
          alt="Profile"
          className="rounded-circle profile-image"
          style={{ width: '80px', height: '80px', objectFit: 'cover', margin: '10px auto', display: 'block' }}
        />
      )}
    </div>
  );
};

const NavSidebar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const dispatch = useDispatch();

  // Get authentication state and cart items count from Redux
  const { isCustomerAuthenticated, isOwnerAuthenticated, customer } = useSelector((state) => state.auth);
  const cartItemCount = useSelector(selectCartItemsCount); // Assuming cart item count is in Redux state
  const ownerId = useSelector((state) => state.auth.restaurantOwner?.id);

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
  const handleLogout = () => {
    if (isCustomerAuthenticated) {
      dispatch(logoutUser()).then(() => {
        navigate('/customer/login');
      });
    } else if (isOwnerAuthenticated) {
      dispatch(logoutRestaurantOwner()).then(() => {
        navigate('/owner/login');
      });
    }
  };

  return (
    <>
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
          <span className="text-black fs-4">
            Uber <b>Eats</b>
          </span>
        </div>
        <div className="ms-auto d-flex align-items-center">
          {isCustomerAuthenticated && (
            <Link to="/cart" className="btn btn-white position-relative rounded-circle me-4 fs-4" 
              style={{ padding: "1px"}}>
              <strong>
                <i className="bi bi-cart" style={{ fontWeight: "bolder", fontSize: "1.5rem" }}></i>
              </strong>
              <span className="position-absolute top-0 start-100 translate-middle badge rounded-circle bg-danger"
                style={{ 
                  fontSize: "0.8rem",  
                  padding: "4px 6px",  
                  transform: "translate(0%, 0%)" 
                }}>
                {cartItemCount}
              </span>
            </Link>
          )}
          {isCustomerAuthenticated || isOwnerAuthenticated ? (
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
        {(isCustomerAuthenticated || isOwnerAuthenticated) && <ImageDisplay />}

        {isCustomerAuthenticated || isOwnerAuthenticated ? (
          <>
            {/* Edit Profile Button */}
            {isCustomerAuthenticated && customer && (
              <Link to={`/customer/profile/${customer.id}`}>
                <button className="btn btn-outline-dark mt-2 w-100">
                  Edit Profile
                </button>
              </Link>
            )}
            {isOwnerAuthenticated && (
              <Link to={`/owner/profile/${ownerId}`}>
                <button className="btn btn-outline-dark mt-2 w-100">
                  Edit Profile
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
                  Orders  <i className="bi bi-bag"></i>
                </button>
                </Link>
                {/* Orders link for customer */}
                <Link to="/customer/favorites">
                <button 
                  className="fw-bold mt-1 ms-0 px-2 py-0 text-start text-dark w-100 border-0" 
                  style={{ backgroundColor: "transparent", cursor: "pointer" }}
                >
                  Favorites  <i className="bi bi-heart text-black"></i>
                </button>
                </Link>
              </>
            )}
            {isOwnerAuthenticated && (
              <>
                <Link to="/owner/home">
                  <button className="fw-bold mt-3 ms-0 px-2 py-0 text-start text-dark w-100 border-0" 
                  style={{ backgroundColor: "transparent", cursor: "pointer" }}>
                    My Restaurants  <i className="bi bi-building text-black"></i>
                  </button>
                </Link>
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
              to="/owner/login"
              className="text-dark text-decoration-none d-block fw-bolder mt-3"
              style={{ fontSize: "14px" }}
            >
              Manage your Restaurant
            </Link>
            <Link
              to="/owner/signup"
              className="text-dark text-decoration-none d-block fw-bold mt-1"
              style={{ fontSize: "14px" }}
            >
              Sign Up as an Owner
            </Link>
          </>
        )}
      </div>
    </>
  );
};

export default NavSidebar;