import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { checkCustomerAuth } from "../../redux/slices/auth/authSlice";
import { resetOrderStatus } from "../../redux/slices/customer/orderSlice";
import { fetchFavorites, removeFavorite } from "../../redux/slices/customer/favoriteSlice";
import NavbarDark from "../Common/NavbarDark";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";

const CustomerFavorites = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const { favoriteRestaurants } = useSelector((state) => state.favorites);
    const { isCustomerAuthenticated, customer, loading } = useSelector((state) => state.auth);
    const orderStatus = useSelector((state) => state.order.orderStatus);

    // State to store fetched restaurant data for displaying as cards
    const [restaurants, setRestaurants] = useState([]);

    useEffect(() => {
        if (orderStatus === "succeeded") {
            dispatch(resetOrderStatus());
        }
    }, [orderStatus, dispatch]);

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

    useEffect(() => {
        console.log("Favorite Restaurants:", favoriteRestaurants);

        const fetchRestaurantData = async () => {
            const restaurantData = await Promise.all(
                favoriteRestaurants.map(async (restaurantId) => {
                    const response = await axios.get(`http://127.0.0.1:3000/api/restaurants/${restaurantId}`);
                    return response.data;
                })
            );

            setRestaurants(restaurantData);
        };

        if (favoriteRestaurants.length > 0) {
            fetchRestaurantData();
        }
    }, [favoriteRestaurants]);

    const handleRestaurantClick = (restaurantId) => {
        navigate(`/restaurant/${restaurantId}`);
    };

    const toggleFavorite = (restaurantId) => {
        if (!customer) return;
        
        // Removing the restaurant from favorites
        dispatch(removeFavorite({ customerId: customer.id, restaurantId }))
            .then(() => {
                // Updating restaurant's state by filtering out the removed restaurant
                setRestaurants((prevRestaurants) =>
                    prevRestaurants.filter((restaurant) => restaurant.id !== restaurantId)
                );
            });
    };
    

    return (
        <>
            <NavbarDark />
            <Link to="/customer/home" style={{ textDecoration: 'none' }}>
                <button
                    className="btn text-dark border-0 d-flex align-items-center mt-3 ms-4 fw-bold"
                    style={{ backgroundColor: 'transparent' }}
                >
                    <span className="fs-5 me-1">←</span><u>Back to Home</u>
                </button>
            </Link>
            <div className="container mt-4">
                <h2 className="mb-4 fw-bold">Favorite Restaurants</h2>

                {restaurants.length === 0 && (
                    <p className="text-warning">You have no favorite restaurants yet.</p>
                )}

                <div className="row">
                    {restaurants.map((restaurant) => {
                        // Check if restaurant data is available before proceeding
                        if (!restaurant) {
                            return null; // Skip this iteration if restaurant data is undefined
                        }

                        return (
                            <div
                                key={restaurant.id}
                                className="col-12 col-sm-6 col-md-4 col-lg-3 mb-4"
                                style={{ cursor: "pointer", position: "relative" }}
                            >
                                <div
                                    className="card border-0"
                                    style={{ boxShadow: "0px 0px 5px rgba(0, 0, 0, 0.2)" }}
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
                                        style={{ height: "160px", objectFit: "cover" }}
                                    />
                                    <div className="card-body p-2 ms-3">
                                        <div className="d-flex justify-content-between align-items-center">
                                            <p className="card-title fw-bold fs-6 my-0">{restaurant.name}</p>
                                            <div className="text-end">
                                                <span className="badge text-black ms-0">Pickup: {restaurant.offers_pickup ? <i className="bi bi-check-circle-fill text-success ms-1"></i> : <i className="bi bi-x-circle-fill text-danger ms-1"></i>}</span>
                                                <span className="badge text-black ms-0">Delivery: {restaurant.offers_delivery ? <i className="bi bi-check-circle-fill text-success ms-1"></i> : <i className="bi bi-x-circle-fill text-danger ms-1"></i>}</span>
                                            </div>
                                        </div>
                                        <p className="card-text my-0">
                                            <strong>☆</strong> {restaurant.ratings}
                                        </p>
                                    </div>
                                </div>
                                {/* Heart Icon for Favorites */}
                                <i
                                    className="bi bi-heart-fill text-danger"
                                    style={{
                                        position: "absolute",
                                        bottom: "5px",
                                        right: "24px",
                                        fontSize: "1.2rem",
                                        cursor: "pointer",
                                        transition: "color 0.5s ease-in-out"
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation(); // Prevent clicking on card
                                        toggleFavorite(restaurant.id); // Remove from favorites
                                    }}
                                ></i>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
};

export default CustomerFavorites;