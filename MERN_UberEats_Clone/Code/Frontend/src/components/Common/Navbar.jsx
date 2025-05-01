import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logoutCustomer, logoutRestaurant } from "../../redux/slices/auth/authSlice";
import "./Navbar.css";

const NavSidebar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const dispatch = useDispatch();

  // Get authentication state from Redux
  const { isCustomerAuthenticated, isRestaurantAuthenticated } = useSelector((state) => state.auth);

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
      {/* Navbar */}
      <nav className="navbar navbar-expand-lg navbar-light bg-transparent px-4">
        <div className="d-flex align-items-center">
          {/* Sidebar Toggle Button */}
          <button
            className="btn text-white fs-2 me-3 mb-1 menu-btn"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            &#9776;
          </button>
          <Link to="/" className="text-decoration-none">
            <span className="text-white fs-4">
              Uber <b>Eats</b>
            </span>
          </Link>
        </div>
        <div className="ms-auto">
          {isCustomerAuthenticated || isRestaurantAuthenticated ? (
            <button className="btn btn-light me-2 rounded-pill" onClick={handleLogout}>
              Logout
            </button>
          ) : (
            <>
              <Link to="/customer/login">
                <button className="btn btn-light me-2 rounded-pill">Log in</button>
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
        {isCustomerAuthenticated || isRestaurantAuthenticated ? (
          <button className="btn btn-light mt-2 w-100" onClick={handleLogout}>
            Logout
          </button>
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
              Sign Up for a Restaurant
            </Link>
          </>
        )}
      </div>
    </>
  );
};

export default NavSidebar;