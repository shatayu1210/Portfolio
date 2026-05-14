import React, { useEffect, useState } from "react";
import { FaMapMarkerAlt, FaClock } from "react-icons/fa";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import "bootstrap/dist/css/bootstrap.min.css";
import "./Landing.css";
import Navbar from "../Common/Navbar";

const LandingPage = () => {
  // Get authentication state from Redux
  const { customer, isRestaurantAuthenticated, restaurant } = useSelector((state) => state.auth);
  
  return (
    <div className="position-relative min-vh-100 w-100 bg-light home_bg">
        {/* Navbar Component*/}
        <Navbar />
        {/* Main Content */}
        <div className="d-flex flex-column align-items-start justify-content-center text-start min-vh-100 w-60 ms-5">
            <h1 className="display-4 fw-bold text-light mb-3 custom-shadow">Order delivery near you</h1>

            {/* Search Box */}
            {/* <div className="d-flex align-items-stretch justify-content-start w-50">
                <div className="bg-white rounded-1 shadow-lg d-flex align-items-center w-75">
                    <FaMapMarkerAlt className="text-secondary ms-3" />
                    <input
                        type="text"
                        placeholder="Enter delivery address"
                        className="form-control border-0 mx-2"
                        style={{ outline: "none", boxShadow: "none" }}
                    />
                </div>
                <button className="btn btn-dark ms-2 rounded-1 p-2 w-25">Search here</button>
            </div> */}
            <div className="d-flex gap-3">
              <Link to="/restaurants">
                <button className="btn btn-light rounded-pill px-4 py-3 fw-bold">
                  {customer ? "Explore" : "Explore as Guest"}
                </button>
              </Link>
              
              {isRestaurantAuthenticated && (
                <Link to="/restaurant/dashboard">
                  <button className="btn btn-dark rounded-pill px-4 py-3 fw-bold">
                    Manage your Restaurant
                  </button>
                </Link>
              )}
            </div>
      </div>
    </div>
  );
};

export default LandingPage;