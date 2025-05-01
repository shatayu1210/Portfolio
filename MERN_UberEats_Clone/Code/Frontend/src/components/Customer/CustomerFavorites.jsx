import React, { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { resetOrderStatus } from "../../redux/slices/customer/orderSlice";
import { fetchFavorites, removeFavorite } from "../../redux/slices/customer/favoriteSlice";
import NavbarDark from "../Common/NavbarDark";
import { useNavigate, Link } from "react-router-dom";
import axiosConfig from "../../config/axios";
import { selectOrderPreference } from "../../redux/slices/customer/cartSlice";

const DEFAULT_IMAGE_PLACEHOLDER = "https://res.cloudinary.com/dvylvq84d/image/upload/v1744151036/ImagePlaceholder_gg1xob.png";

const CustomerFavorites = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const { favoriteRestaurants, status: favoritesStatus } = useSelector((state) => state.favorites);
    const { customer } = useSelector((state) => state.auth);
    const orderStatus = useSelector((state) => state.order.orderStatus);
    const orderPreference = useSelector(selectOrderPreference);

    // State to store fetched restaurant data for displaying as cards
    const [restaurants, setRestaurants] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (orderStatus === "succeeded") {
            dispatch(resetOrderStatus());
        }
    }, [orderStatus, dispatch]);

    useEffect(() => {
        if (customer) {
            dispatch(fetchFavorites(customer.id));
        }
    }, [customer, dispatch]);

    useEffect(() => {
        const fetchRestaurantData = async () => {
            if (favoriteRestaurants.length === 0) {
                setRestaurants([]);
                return;
            }
            
            setLoading(true);
            
            try {
                const restaurantData = await Promise.all(
                    favoriteRestaurants.map(async (restaurant) => {
                        try {
                            // Handle both string IDs and object IDs
                            const restaurantId = typeof restaurant === 'object' ? restaurant.id || restaurant._id : restaurant;
                            
                            // Skip if ID is undefined or null
                            if (!restaurantId) {
                                console.log("Skipping restaurant with undefined or null ID");
                                return null;
                            }
                            
                            const response = await axiosConfig.get(`/api/restaurants/${restaurantId}`);
                            return response.data;
                        } catch (error) {
                            const restaurantId = typeof restaurant === 'object' ? restaurant.id || restaurant._id : restaurant;
                            console.log(`Could not fetch restaurant with ID ${restaurantId}:`, error.message);
                            return null; // Return null for restaurants that couldn't be fetched
                        }
                    })
                );

                // Filter out null values for restaurants that couldn't be fetched
                const validRestaurants = restaurantData.filter(restaurant => restaurant !== null);
                setRestaurants(validRestaurants);
            } catch (error) {
                console.log("Error fetching restaurant data:", error.message);
                setRestaurants([]);
            } finally {
                setLoading(false);
            }
        };

        if (favoriteRestaurants && favoriteRestaurants.length > 0) {
            fetchRestaurantData();
        } else {
            setRestaurants([]);
        }
    }, [favoriteRestaurants]);

    // Filter restaurants based on orderPreference
    const filteredRestaurants = useMemo(() => {
        if (!restaurants || restaurants.length === 0) return [];
        
        return restaurants.filter(restaurant => {
            if (orderPreference === "delivery") {
                return restaurant.offersDelivery;
            } else if (orderPreference === "pickup") {
                return restaurant.offersPickup;
            }
            return true; // Show all if no preference
        });
    }, [restaurants, orderPreference]);

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
    
    // Function to get correct image URL
    // Only absolute URLs (e.g., from Cloudinary) are supported. Relative paths are not used.
    const getImageUrl = (imagePath) => {
        if (!imagePath) return DEFAULT_IMAGE_PLACEHOLDER;
        // Only use the image if it's an absolute URL (starts with http)
        if (imagePath.startsWith('http')) {
            return imagePath;
        }
        // Fallback to placeholder if not absolute
        return DEFAULT_IMAGE_PLACEHOLDER;
    };

    return (
        <>
            <NavbarDark />
            <Link to="/restaurants" style={{ textDecoration: 'none' }}>
                <button
                    className="btn text-dark border-0 d-flex align-items-center mt-3 ms-4 fw-bold"
                    style={{ backgroundColor: 'transparent' }}
                >
                    <span className="fs-5 me-1">←</span><u>Back to Home</u>
                </button>
            </Link>
            <div className="container mt-4">
                <h2 className="mb-4 fw-bold">My Favorites</h2>

                {/* Show loading state */}
                {(favoritesStatus === "loading" || loading) && (
                    <div className="text-center py-3">
                        <div className="spinner-border text-success me-2" role="status"></div>
                    </div>
                )}

                {/* Show empty state only when not loading */}
                {!loading && favoritesStatus !== "loading" && restaurants.length === 0 && (
                    <div>
                        <p className="text-dark">You have no favorite restaurants yet. <Link to="/restaurants" className="text-decoration-underline text-dark">Explore restaurants</Link> to add to favorites.
                        </p>
                    </div>
                )}

                {/* Show no restaurants for current preference */}
                {!loading && favoritesStatus !== "loading" && restaurants.length > 0 && filteredRestaurants.length === 0 && (
                    <div className="alert alert-light w-50">
                        No favorite restaurants available for {orderPreference}. 
                        Try switching to {orderPreference === "delivery" ? "pickup" : "delivery"} mode instead.
                    </div>
                )}

                {/* Show results only when not loading */}
                {!loading && favoritesStatus !== "loading" && (
                    <div className="row">
                        {filteredRestaurants.map((restaurant) => {
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
                                        style={{ overflow: "hidden" }}
                                        onClick={() => handleRestaurantClick(restaurant.id)}
                                    >
                                        <img
                                            src={getImageUrl(restaurant.imageUrl)}
                                            className="card-img-top"
                                            alt={restaurant.name}
                                            style={{ 
                                                height: "140px", 
                                                objectFit: "cover",
                                                borderRadius: "16px"
                                            }}
                                            onError={(e) => {
                                                e.target.onerror = null; // Prevent infinite loop
                                                e.target.src = DEFAULT_IMAGE_PLACEHOLDER;
                                            }}
                                        />
                                        <div className="card-body ms-0 p-0 mt-2 position-relative">
                                            {/* Heart Icon for Favorites */}
                                            <i
                                                className="bi bi-heart-fill text-danger"
                                                style={{
                                                    position: "absolute",
                                                    right: "20px",
                                                    top: "5px",
                                                    fontSize: "1.4rem",
                                                    cursor: "pointer",
                                                    transition: "color 0.5s ease-in-out"
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation(); // Prevent clicking on card
                                                    toggleFavorite(restaurant.id); // Remove from favorites
                                                }}
                                            ></i>
                                            
                                            <p className="card-title fw-bold fs-6 my-0">{restaurant.name}</p>
                                            
                                            {restaurant?.rating && (
                                                <p className="card-text my-0 d-flex align-items-center">
                                                <span>{restaurant.rating || "N/A"}</span>
                                                <i className="bi bi-star-fill ms-1" style={{ color: "#000", fontSize: "0.85rem" }}></i>
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
};

export default CustomerFavorites;