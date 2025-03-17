import React, { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams, Link } from "react-router-dom";
import { fetchRestaurantDetails } from "../../redux/slices/customer/restaurantSlice";
import { addToCart } from "../../redux/slices/customer/cartSlice";
import NavbarDark from "../Common/NavbarDark";

const RestaurantDetail = () => {
    const { id } = useParams(); 
    const dispatch = useDispatch();
    
    // Get restaurant data from Redux store
    const { restaurant, dishes, status, error } = useSelector((state) => state.restaurants);
    
    // Get cart items with safe fallback
    const cartItems = useSelector((state) => state.cart?.items || []);
    
    // Memoize quantities instead of using state to avoid update loops
    const quantities = useMemo(() => {
        const initialQuantities = {};
        if (cartItems && cartItems.length > 0) {
            cartItems.forEach(item => {
                if (item && item.id) {
                    initialQuantities[item.id] = item.quantity || 0;
                }
            });
        }
        return initialQuantities;
    }, [cartItems]);
    
    // Memoize cart quantity total to avoid unnecessary calculations
    const cartItemCount = useMemo(() => {
        return cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
    }, [cartItems]);

    // Fetch restaurant details on component mount or id change
    useEffect(() => {
        if (id) {
            dispatch(fetchRestaurantDetails(id));
        }
    }, [dispatch, id]);

    const handleAddToCart = (dish) => {
        // Create a copy of quantities to avoid mutating the memoized value
        const quantityToAdd = quantities[dish.id] || 1;
        
        dispatch(addToCart({ 
            ...dish, 
            quantity: quantityToAdd,
            restaurant_id: restaurant?.id
        }));
    };
    
    // Handle quantity changes by adding directly to cart
    const handleIncreaseQuantity = (dish) => {
        const newQuantity = (quantities[dish.id] || 0) + 1;
        
        dispatch(addToCart({ 
            ...dish, 
            quantity: 1, // Add just 1 more
            restaurant_id: restaurant?.id
        }));
    };

    const handleDecreaseQuantity = (dish) => {
        if (quantities[dish.id] > 0) {
            // To decrease, add with negative quantity
            dispatch(addToCart({ 
                ...dish, 
                quantity: -1, // Remove just 1
                restaurant_id: restaurant?.id
            }));
        }
    };

    // Show loading state
    if (status === "loading") {
        return (
            <>
                <NavbarDark />
                <div className="container mt-4">
                    <p>Loading restaurant details...</p>
                </div>
            </>
        );
    }

    // Show error state
    if (status === "failed") {
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
                    <div className="text-warning">
                        <p>No restaurant dishes found</p>
                    </div>
                </div>
            </>
        );
    }

    // Only render the main content when data is available
    if (!restaurant) {
        return (
            <>
                <NavbarDark />
                <div className="container mt-4">
                    <p>Restaurant details not available</p>
                </div>
            </>
        );
    }

    return (
        <>
            <NavbarDark />
            <Link to="/customer/home" style={{ textDecoration: 'none' }}>
                <button
                    className="btn text-dark border-0 d-flex align-items-center mt-3 ms-5 fw-bold"
                    style={{ backgroundColor: 'transparent' }}
                >
                    <span className="fs-5 me-1">←</span><u>Back to Home</u>
                </button>
            </Link>
            <div className="container mt-4">
                <div className="d-flex align-items-center mb-3">
                <img
                    src={restaurant.image_url 
                        ? restaurant.image_url.startsWith('http') 
                            ? restaurant.image_url 
                            : `http://localhost:3000${restaurant.image_url}`
                        : "http://localhost:3000/uploads/blank_post.png"}
                    alt={restaurant.name}
                    className="rounded-circle me-3"
                    style={{ 
                        width: "140px", 
                        height: "140px", 
                        objectFit: "cover", 
                        border: "2px solid black"
                    }}
                />
                    <h2 className="m-0"><strong>{restaurant.name}</strong></h2>
                </div>
                <p className="my-0"><strong>Rating: </strong>{restaurant.ratings} ☆</p>
                <p className="my-0"><strong>Description: </strong>{restaurant.description}</p>
                <p className="my-0"><strong>Address: </strong>{restaurant.address}</p>
                <p className="my-0"><strong>Email: </strong>{restaurant.email}</p>
                <p className="my-0"><strong>Phone: </strong>{restaurant.phone}</p>
                
                <div className="row mb-5">
                    {dishes && dishes.length > 0 ? (
                        dishes.map((dish) => (
                            <div key={dish.id} className="col-md-3 mb-3">
                                <div className="card border-0 shadow-sm">
                                <img 
                                    src={dish.image_url 
                                        ? dish.image_url.startsWith('http') 
                                            ? dish.image_url 
                                            : `http://localhost:3000${dish.image_url}`
                                        : "http://localhost:3000/uploads/blank_dish.png"}
                                    className="card-img-top" 
                                    alt={dish.name} 
                                    style={{ height: "200px", objectFit: "cover" }} 
                                />
                                    <div className="card-body text-center">
                                        <h5 className="card-title">{dish.name}</h5>
                                        <p className="card-text fw-bold">${dish.price}</p>
                                        
                                        {/* Quantity controls */}
                                        <div className="d-flex justify-content-center align-items-center mb-2">
                                            <button 
                                                className="btn btn-sm btn-outline-dark" 
                                                onClick={() => handleDecreaseQuantity(dish)}
                                            >
                                                -
                                            </button>
                                            <span className="mx-2">{quantities[dish.id] || 0}</span>
                                            <button 
                                                className="btn btn-sm btn-outline-dark" 
                                                onClick={() => handleIncreaseQuantity(dish)}
                                            >
                                                +
                                            </button>
                                        </div>
                                        
                                        <button 
                                            className="btn btn-dark"
                                            onClick={() => handleAddToCart(dish)}
                                            disabled={!quantities[dish.id]}
                                        >
                                            Add to Cart
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-12">
                            <div className="alert alert-info">
                                No dishes available for this restaurant.
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default RestaurantDetail;