import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import { fetchRestaurants, clearRestaurantDetails } from "../../redux/slices/customer/restaurantSlice";
import { checkCustomerAuth } from "../../redux/slices/auth/authSlice";
import "bootstrap/dist/css/bootstrap.min.css";
import NavbarDark from "../Common/NavbarDark";
import { resetOrderStatus } from "../../redux/slices/customer/orderSlice";
import { fetchFavorites, addFavorite, removeFavorite } from "../../redux/slices/customer/favoriteSlice";
import { useNavigate } from "react-router-dom";

const CustomerHome = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    
    const { restaurants, status, error } = useSelector((state) => state.restaurants);
    const { isCustomerAuthenticated, customer, loading } = useSelector((state) => state.auth);
    const { favoriteRestaurants } = useSelector((state) => state.favorites);
    
    const orderStatus = useSelector((state) => state.order.orderStatus);

    useEffect(() => {
        dispatch(clearRestaurantDetails());
        if (orderStatus === "succeeded") {
            dispatch(resetOrderStatus());
        }
    }, [orderStatus, dispatch]);

    useEffect(() => {
        if (status === "idle" && !loading) {
            if (!isCustomerAuthenticated) {
                dispatch(checkCustomerAuth());
            } else {
                dispatch(fetchRestaurants());
            }
        }
    }, [isCustomerAuthenticated, status, dispatch, loading]);

    useEffect(() => {
        if (!loading && !isCustomerAuthenticated) {
            navigate("/customer/login", { state: { signedOut: true } });
        }
    }, [isCustomerAuthenticated, navigate, loading]);

    useEffect(() => {
        if (customer) {
            dispatch(fetchFavorites(customer.id));
        }
    }, [customer, dispatch]);

    const handleRestaurantClick = (restaurantId) => {
        navigate(`/restaurant/${restaurantId}`);
    };

    const toggleFavorite = (restaurantId) => {
        if (!customer) return;
        if (favoriteRestaurants.includes(restaurantId)) {
            dispatch(removeFavorite({ customerId: customer.id, restaurantId }));
        } else {
            dispatch(addFavorite({ customerId: customer.id, restaurantId }));
        }
    };

    // Simplified card styling using Bootstrap classes
    const cardStyle = {
        cursor: "pointer",
        boxShadow: "0px 0px 5px rgba(0, 0, 0, 0.2)",
        borderRadius: "8px",
        border: "none",
        height: "100%"  // This makes all cards stretch to match the tallest in the row
    };
    
    const cardImageStyle = {
        height: "160px",
        objectFit: "cover"
    };

    return (
        <>
            <NavbarDark />
            <h2 className="mb-4 fw-bold ms-5">Restaurants</h2>
            <div className="container mt-4">
                {status === "loading" && <p>Loading restaurants...</p>}
                {status === "failed" && <p className="text-danger">{error}</p>}
                {status === "succeeded" && restaurants.length === 0 && (
                    <p className="text-warning">No Restaurants Available</p>
                )}

                <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-4">
                    {restaurants.map((restaurant) => (
                        <div key={restaurant.id} className="col">
                            <div 
                                className="card h-100"
                                style={cardStyle}
                                onClick={() => handleRestaurantClick(restaurant.id)}
                            >
                                <img
                                    src={
                                        restaurant.image_url 
                                            ? `http://localhost:3000${restaurant.image_url}` 
                                            : `http://localhost:3000/uploads/blank_post.png`
                                    }
                                    className="card-img-top"
                                    alt={restaurant.name}
                                    style={cardImageStyle}
                                />
                                <div className="card-body d-flex flex-column">
                                    <div className="mb-auto">
                                        <h5 className="card-title fw-bold">{restaurant.name}</h5>
                                        <p className="card-text">
                                            <strong>☆</strong> {restaurant.ratings}
                                        </p>
                                    </div>
                                    
                                    <div className="d-flex justify-content-between align-items-center mt-3">
                                        <div>
                                            <span className="badge bg-light text-dark me-1">
                                                Pickup: {restaurant.offers_pickup ? 
                                                    <i className="bi bi-check-circle-fill text-success ms-1"></i> : 
                                                    <i className="bi bi-x-circle-fill text-danger ms-1"></i>}
                                            </span>
                                            <span className="badge bg-light text-dark">
                                                Delivery: {restaurant.offers_delivery ? 
                                                    <i className="bi bi-check-circle-fill text-success ms-1"></i> : 
                                                    <i className="bi bi-x-circle-fill text-danger ms-1"></i>}
                                            </span>
                                        </div>
                                        <i
                                            className={`bi ${favoriteRestaurants.includes(restaurant.id) ? "bi-heart-fill text-danger" : "bi-heart text-secondary"}`}
                                            style={{
                                                fontSize: '1.2rem',
                                                cursor: 'pointer',
                                                transition: 'color 0.3s ease'
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation(); // Prevent clicking on card
                                                toggleFavorite(restaurant.id);
                                            }}
                                        ></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default CustomerHome;