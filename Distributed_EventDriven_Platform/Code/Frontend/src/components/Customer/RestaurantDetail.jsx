import React, { useEffect, useMemo, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams, Link, useNavigate } from "react-router-dom";
import { fetchRestaurant } from "../../redux/slices/restaurant/restaurantSlice";
import { fetchCustomer } from "../../redux/slices/customer/customerSlice";
import { 
    fetchRestaurantRatings, 
    clearRatings, 
    updateRating, 
    deleteRating, 
    createRating,
    selectRestaurantRatingStats
} from "../../redux/slices/customer/ratingSlice";
import { 
    addToCart,
    clearCart,
    selectOrderPreference,
    setOrderPreference 
} from "../../redux/slices/customer/cartSlice";
import NavbarDark from "../Common/NavbarDark";
import { Modal, Button } from "react-bootstrap";
import axios from "../../config/axios";
import {
  fetchFavorites,
  addFavorite, 
  removeFavorite,
  selectFavorites
} from "../../redux/slices/customer/favoriteSlice";

const DEFAULT_IMAGE_PLACEHOLDER = "https://res.cloudinary.com/dvylvq84d/image/upload/v1744151036/ImagePlaceholder_gg1xob.png";
const DEFAULT_PROFILE_IMAGE = "https://res.cloudinary.com/dvylvq84d/image/upload/v1744050200/profile_placeholder.png";

// Use the same pill toggle styles
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

.pill-toggle.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
`;

const RestaurantDetail = () => {
    const { id } = useParams(); 
    const dispatch = useDispatch();
    const navigate = useNavigate();
    

    // Scroll to rating section
    const scrollToRating = () => {
        const el = document.getElementById('ratingSection');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };

    // State for edit modal
    const [showEditModal, setShowEditModal] = useState(false);
    const [editRating, setEditRating] = useState({
        id: null,
        rating: 0,
        review: ""
    });
    const [editRatingError, setEditRatingError] = useState("");
    
    // State for add review modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [newRating, setNewRating] = useState({
        rating: 0,
        review: ""
    });
    const [ratingError, setRatingError] = useState("");
    
    // State for dish modal
    const [showDishModal, setShowDishModal] = useState(false);
    const [selectedDish, setSelectedDish] = useState(null);
    const [selectedSize, setSelectedSize] = useState(null);
    const [quantity, setQuantity] = useState(1);
    
    // Add state for sorting
    const [sortOption, setSortOption] = useState("latest");
    
    // State for showing hours dropdown
    const [showHoursDropdown, setShowHoursDropdown] = useState(false);
    
    // Add this to the state variables
    const [categoryFilter, setCategoryFilter] = useState('all');
    
    // Get restaurant data from Redux store with updated selectors
    const { restaurant, dishes, detailsStatus, detailsError } = useSelector((state) => state.restaurant);
    
    // Determine if restaurant is currently open based on today's operating hours and system time
    const isOpenNow = useMemo(() => {
        if (!restaurant?.operatingHours) return false;
        const now = new Date();
        const day = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const hours = restaurant.operatingHours[day];
        if (!hours || hours.isClosed || !hours.open || !hours.close) return false;
        const [oh, om] = hours.open.split(':').map(Number);
        const [ch, cm] = hours.close.split(':').map(Number);
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const openMinutes = oh * 60 + om;
        const closeMinutes = ch * 60 + cm;
        return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
    }, [restaurant?.operatingHours]);
    
    // Get ratings data from Redux
    const { ratings, status: ratingsStatus, error: ratingsError } = useSelector((state) => state.ratings);
    
    // Get the latest restaurant rating statistics
    const ratingStats = useSelector(selectRestaurantRatingStats);
    
    // Get currently logged in customer
    const { customer } = useSelector((state) => state.auth);
    const isCustomerAuthenticated = !!customer;

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

    // Ref for dropdown element
    const dropdownRef = useRef(null);

    // Get order preference from Redux store
    const orderPreference = useSelector(selectOrderPreference);

    // Get favorites from Redux store
    const favorites = useSelector(selectFavorites);
    const isFavorite = favorites && Array.isArray(favorites) && 
        favorites.some(fav => typeof fav === 'string' 
            ? fav === id 
            : (fav.id === id || fav._id === id || fav.restaurantId === id));

    // Fetch restaurant details on component mount or id change
    useEffect(() => {
        if (id) {
            dispatch(fetchRestaurant(id));
            dispatch(fetchRestaurantRatings(id));
        }
        
        // Clear ratings when component unmounts
        return () => {
            dispatch(clearRatings());
        };
    }, [dispatch, id]);

    // Initialize Bootstrap dropdown
    useEffect(() => {
        // Check if the dropdown element exists in the DOM
        if (dropdownRef.current) {
            // Import Bootstrap JS dynamically to ensure it's loaded
            import('bootstrap/dist/js/bootstrap.bundle.min.js')
                .then(() => {
                    // Access the global bootstrap object
                    if (window.bootstrap) {
                        // Initialize the dropdown
                        const dropdownElement = dropdownRef.current;
                        new window.bootstrap.Dropdown(dropdownElement);
                    }
                })
                .catch(err => console.error('Failed to load Bootstrap JS:', err));
        }
    }, [ratings]); // Re-initialize when ratings change

    // Initialize Bootstrap tooltips
    useEffect(() => {
        // Import Bootstrap JS dynamically
        import('bootstrap/dist/js/bootstrap.bundle.min.js')
            .then(() => {
                if (window.bootstrap) {
                    // Initialize all tooltips on the page
                    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
                    tooltipTriggerList.map(function (tooltipTriggerEl) {
                        return new window.bootstrap.Tooltip(tooltipTriggerEl);
                    });
                }
            })
            .catch(err => console.error('Failed to load Bootstrap JS for tooltips:', err));
            
        // Clean up tooltips when component unmounts
        return () => {
            // Only attempt cleanup if bootstrap is available
            if (window.bootstrap && window.bootstrap.Tooltip) {
                const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
                tooltipTriggerList.forEach(tooltipTriggerEl => {
                    const tooltip = window.bootstrap.Tooltip.getInstance(tooltipTriggerEl);
                    if (tooltip) {
                        tooltip.dispose();
                    }
                });
            }
        };
    }, [restaurant]); // Re-initialize when restaurant data changes

    // Initialize collapse for ingredients when dish modal opens
    useEffect(() => {
        if (showDishModal && window.bootstrap) {
            // Initialize any collapse elements in the dish modal
            const collapseElementList = [].slice.call(document.querySelectorAll('.collapse'));
            collapseElementList.forEach(collapseEl => {
                // Create a new collapse instance for smooth animations
                new window.bootstrap.Collapse(collapseEl, {
                    toggle: false
                });
            });
        }
    }, [showDishModal]);

    // Handle opening the edit modal
    const handleEditClick = (review) => {
        setEditRating({
            id: review.id,
            rating: review.rating,
            review: review.review || ""
        });
        setEditRatingError("");
        setShowEditModal(true);
    };
    
    // Handle opening the add review modal
    const handleAddReviewClick = () => {
        setNewRating({
            rating: 0,
            review: ""
        });
        setRatingError("");
        setShowAddModal(true);
    };
    
    // Handle saving a new review
    const handleSaveNewReview = async () => {
        // Validate rating
        if (newRating.rating === 0) {
            setRatingError("Please select a rating before submitting");
            return;
        }
        
        if (customer) {
            try {
                // Clear any errors
                setRatingError("");
                
                // Include customer information when creating the rating
                const customerInfo = {
                    id: customer.id,
                    firstName: customer.firstName,
                    lastName: customer.lastName,
                    name: customer.name || `${customer.firstName} ${customer.lastName}`,
                    imageUrl: customer.imageUrl
                };
                
                // Dispatch with await to ensure we wait for the operation to complete
                await dispatch(createRating({
                    restaurantId: id,
                    rating: newRating.rating,
                    review: newRating.review,
                    customerInfo: customerInfo  // Pass customer info to the action
                })).unwrap(); // Use unwrap to properly handle the promise

                // Close the modal after successful submission
                setShowAddModal(false);
            } catch (error) {
                console.error("Error adding review:", error);
                setRatingError("Failed to add review. Please try again.");
            }
        }
    };
    
    // Handle saving the edited review
    const handleSaveReview = async () => {
        if (!editRating.rating || editRating.rating === 0) {
            setEditRatingError("Please select a rating before saving changes");
            return;
        }
        
        if (editRating.id) {
            try {
                setEditRatingError("");
                
                // Dispatch with await to ensure we wait for the operation to complete
            await dispatch(updateRating({
                ratingId: editRating.id,
                rating: editRating.rating,
                review: editRating.review
                })).unwrap(); // Use unwrap to properly handle the promise
                
                // Close the modal after successful update
            setShowEditModal(false);
            } catch (error) {
                console.error("Error updating review:", error);
                setEditRatingError("Failed to update review. Please try again.");
            }
        }
    };
    
    // Handle deleting a review
    const handleDeleteReview = async (ratingId) => {
        if (window.confirm("Are you sure you want to delete this review?")) {
            try {
                // Dispatch with await to ensure we wait for the operation to complete
                await dispatch(deleteRating(ratingId)).unwrap(); // Use unwrap to properly handle the promise
                
                // Success is handled by the reducer updating the state
            } catch (error) {
                console.error("Error deleting review:", error);
                alert("Failed to delete review. Please try again.");
            }
        }
    };

    const [showCartNotification, setShowCartNotification] = useState(false);
    const [addedQuantity, setAddedQuantity] = useState(1); // Track last added quantity

    // Helper function to show cart notification and set timeout to hide it
    const showCartBubble = (qty = 1) => {
        setAddedQuantity(qty);
        setShowCartNotification(true);
        
        // Hide notification after 5 seconds
        setTimeout(() => {
            setShowCartNotification(false);
        }, 5000);
    };

    // Cart context to handle switching restaurants
    const cartRestaurantId = useSelector(state => state.cart.restaurantId);
    const [showSwitchModal, setShowSwitchModal] = useState(false);
    const [pendingAdd, setPendingAdd] = useState({ dish: null, quantity: 0 });
    const [oldRestaurantName, setOldRestaurantName] = useState("");
    // Fetch name of previous restaurant for modal message
    useEffect(() => {
        if (cartRestaurantId && restaurant?.id && cartRestaurantId !== restaurant.id) {
            axios.get(`/api/restaurants/${cartRestaurantId}`)
                .then(res => setOldRestaurantName(res.data.name))
                .catch(err => console.error("Error fetching previous restaurant:", err));
        }
    }, [cartRestaurantId, restaurant?.id]);

    // Add to cart handler with switch confirmation
    const handleAddToCart = (dish) => {
        const quantityToAdd = quantities[dish.id] || 1;
        // If cart has items from another restaurant, confirm reset
        if (cartItems.length > 0 && cartRestaurantId && cartRestaurantId !== restaurant.id) {
            setPendingAdd({ dish, quantity: quantityToAdd });
            setShowSwitchModal(true);
            return;
        }
        dispatch(addToCart({ ...dish, quantity: quantityToAdd, restaurant_id: restaurant.id }));
        showCartBubble(quantityToAdd);
    };

    // Confirm clearing cart and adding new item
    const handleConfirmSwitch = () => {
        dispatch(clearCart());
        dispatch(addToCart({ ...pendingAdd.dish, quantity: pendingAdd.quantity, restaurant_id: restaurant.id }));
        showCartBubble(pendingAdd.quantity);
        setShowSwitchModal(false);
    };

    // Add this helper function before the component or inside it
    const getDishPriceDisplay = (dish) => {        
        // If dish has sizes array
        if (dish.sizes && dish.sizes.length > 0) {
            // Sort the sizes by price to find the lowest
            const sortedSizes = [...dish.sizes].sort((a, b) => a.price - b.price);
            const lowestPrice = sortedSizes[0].price;
            
            // If there are multiple sizes, add "onwards" text
            if (dish.sizes.length > 1) {
                return `$${lowestPrice.toFixed(2)} onwards`;
            } else {
                return `$${lowestPrice.toFixed(2)}`;
            }
        }
        
        // Fallback if no price information is available
        return "Price not available";
    };

    // Handle dish click to open the modal
    const handleDishClick = (dish) => {
        setSelectedDish(dish);
        
        // Set default selected size (first size or lowest price size)
        if (dish.sizes && dish.sizes.length > 0) {
            if (dish.sizes.length === 1) {
                setSelectedSize(dish.sizes[0]);
            } else {
                // Select the lowest price size by default
                const sortedSizes = [...dish.sizes].sort((a, b) => a.price - b.price);
                setSelectedSize(sortedSizes[0]);
            }
        }
        
        // Reset quantity
        setQuantity(1);
        
        // Show the modal
        setShowDishModal(true);
    };
    
    // Handle adding the dish to cart
    const handleAddDishToCart = () => {

        if (!isCustomerAuthenticated) {
            if(window.confirm("Please log in to add items to your cart.")) {
                return navigate('/customer/login');
            }
            return;
        }

        if (!selectedDish || !selectedSize) return;
        
        const dishToAdd = {
            ...selectedDish,
            selectedSize: selectedSize,
            price: selectedSize.price,
            quantity: quantity,
            restaurant_id: restaurant?.id
        };
        
        dispatch(addToCart(dishToAdd));
        setShowDishModal(false);
        showCartBubble(quantity);
    };

    // Function to sort ratings based on sort option
    const getSortedRatings = () => {
        if (!ratings || !Array.isArray(ratings)) return [];
        
        // Create a copy to avoid mutating the original
        let sortedRatings = [...ratings];
        
        // Sort based on selected option
        switch (sortOption) {
            case "oldest":
                sortedRatings.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                break;
            case "lowest":
                sortedRatings.sort((a, b) => a.rating - b.rating);
                break;
            case "highest":
                sortedRatings.sort((a, b) => b.rating - a.rating);
                break;
            case "latest":
            default:
                sortedRatings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                
                // Only prioritize the current user's review when using the default sort (latest)
                if (customer) {
                    const userReviewIndex = sortedRatings.findIndex(review => review.customer?.id === customer.id);
                    if (userReviewIndex !== -1) {
                        const userReview = sortedRatings.splice(userReviewIndex, 1)[0];
                        sortedRatings.unshift(userReview);
                    }
                }
                break;
        }
        
        return sortedRatings;
    };

    // Add this function to handle toggle changes
    const handleOrderPreferenceChange = (preference) => {
        // Only allow changing if restaurant offers that option
        if ((preference === "delivery" && restaurant?.offersDelivery) || 
            (preference === "pickup" && restaurant?.offersPickup)) {
            dispatch(setOrderPreference(preference));
        }
    };

    // Add this function to handle favorite toggle
    const handleFavoriteToggle = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!customer || !customer.id) {
            // Not logged in, redirect to login
            navigate('/customer/login');
            return;
        }
        
        if (isFavorite) {
            dispatch(removeFavorite({ 
                customerId: customer.id, 
                restaurantId: id 
            }));
        } else {
            dispatch(addFavorite({ 
                customerId: customer.id, 
                restaurantId: id 
            }));
        }
    };

    // Fetch favorites on component mount
    useEffect(() => {
        if (customer && customer.id) {
            dispatch(fetchFavorites(customer.id));
        }
    }, [dispatch, customer]);

    // Add useEffect to handle clicking outside of dropdown
    useEffect(() => {
        // Function to handle clicks outside the dropdown
        const handleClickOutside = (event) => {
            const isDropdownClick = event.target.closest('.hours-dropdown-btn') !== null;
            const isInsideDropdown = event.target.closest('.hours-dropdown') !== null;
            
            // If dropdown is open and click is outside both the button and dropdown
            if (showHoursDropdown && !isDropdownClick && !isInsideDropdown) {
                setShowHoursDropdown(false);
            }
        };

        // Add event listener when dropdown is open
        if (showHoursDropdown) {
            document.addEventListener('click', handleClickOutside);
        }
        
        // Clean up
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [showHoursDropdown]);

    // Add this function to filter dishes by category
    const getFilteredDishes = () => {
        if (!restaurant.dishes || !Array.isArray(restaurant.dishes)) return [];
        
        // First filter by availability - only show available dishes
        const availableDishes = restaurant.dishes.filter(dish => dish.isAvailable);
        
        // Then filter by category if needed
        if (categoryFilter === 'all') return availableDishes;
        
        return availableDishes.filter(dish => 
            Array.isArray(dish.category) && dish.category.includes(categoryFilter)
        );
    };

    // Add this function to get unique categories from dishes
    const getUniqueCategories = () => {
        if (!restaurant.dishes || !Array.isArray(restaurant.dishes)) return [];
        
        const categorySets = new Set();
        
        // Only consider available dishes for categories
        restaurant.dishes
            .filter(dish => dish.isAvailable)
            .forEach(dish => {
                if (Array.isArray(dish.category)) {
                    dish.category.forEach(cat => categorySets.add(cat));
                }
            });
        
        return Array.from(categorySets).sort();
    };

    // Show loading state
    if (detailsStatus === "loading") {
        return (
            <>
                <NavbarDark hideToggle={true} />
                <div className="container mt-4">
                    <div className="d-flex justify-content-center">
                        <div className="spinner-border text-success" role="status">
                            <span className="visually-hidden">Loading restaurant details...</span>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // Show error state
    if (detailsStatus === "failed") {
        return (
            <>
                <NavbarDark hideToggle={true} />
                <Link to="/restaurants" style={{ textDecoration: 'none' }}>
                    <button
                        className="btn text-dark border-0 d-flex align-items-center mt-3 ms-4 fw-bold"
                        style={{ backgroundColor: 'transparent' }}
                    >
                        <span className="fs-5 me-1">←</span><u>Back to Home</u>
                    </button>
                </Link>
                <div className="container mt-4">
                    <div className="alert alert-danger">
                        <p>{detailsError || "Failed to load restaurant details"}</p>
                    </div>
                </div>
            </>
        );
    }

    // Only render the main content when data is available
    if (!restaurant || detailsStatus !== "succeeded") {
        return (
            <>
                <NavbarDark hideToggle={true} />
                <div className="container mt-4">
                    <p>Restaurant details not available</p>
                </div>
            </>
        );
    }

    // Format date function for reviews
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: '2-digit', 
            month: 'short', 
            day: 'numeric' 
        });
    };

    return (
        <>
            <style>
                {toggleStyles}
                {`
                .hours-dropdown-btn {
                    color: #333;
                    font-size: 0.9rem;
                    background: transparent;
                    border: none;
                    padding: 0.3rem 0.8rem;
                    transition: all 0.2s ease;
                    margin-left: 10px;
                    display: flex;
                    align-items: center;
                    text-decoration: underline;
                    cursor: pointer;
                }
                
                .hours-dropdown-btn:hover {
                    color: #000;
                }
                
                .hours-dropdown {
                    position: absolute;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 3px 10px rgba(0,0,0,0.2);
                    padding: 18px;
                    z-index: 1000;
                    min-width: 300px;
                    margin-top: 10px;
                    right: 0;
                }
                
                .hours-dropdown-day {
                    margin-bottom: 8px;
                    display: flex;
                    justify-content: space-between;
                }
                
                .day-name {
                    font-weight: 600;
                    min-width: 100px;
                    text-transform: capitalize;
                }
                
                .hours-time {
                    color: #444;
                }
                
                .closed-day {
                    color: #dc3545;
                }
                `}
            </style>
            <NavbarDark hideToggle={true} />
            <Link to="/restaurants" style={{ textDecoration: 'none' }}>
                <button
                    className="btn text-dark border-0 d-flex align-items-center mt-3 ms-5 fw-bold"
                    style={{ backgroundColor: 'transparent' }}
                >
                    <span className="fs-5 me-1">←</span><u>Back to Restaurants</u>
                </button>
            </Link>
            <div className="container mt-4">
                <div className="d-flex align-items-center mb-5">
                    <div className="position-relative">
                        <img
                            src={restaurant.imageUrl || DEFAULT_IMAGE_PLACEHOLDER}
                            alt={restaurant.name}
                            className="me-3 rounded-3"
                            style={{ 
                                maxWidth: "300px", 
                                height: "200px", 
                                objectFit: "cover", 
                                border: "1px solid #e6e6e6"
                            }}
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = DEFAULT_IMAGE_PLACEHOLDER;
                            }}
                        />
                        {/* Heart icon positioned on the top right of the image */}
                        {customer && (
                            <button 
                                className={`btn position-absolute d-flex align-items-center justify-content-center bg-white ${isFavorite ? 'text-danger' : 'text-muted'}`}
                                onClick={handleFavoriteToggle}
                                style={{ 
                                    top: "-10px", 
                                    right: "5px", 
                                    width: "36px", 
                                    height: "36px", 
                                    borderRadius: "50%",
                                    border: "none",
                                    boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
                                    padding: "0"
                                }}
                            >
                                <i className={`bi ${isFavorite ? 'bi-heart-fill' : 'bi-heart'} fs-5`}></i>
                            </button>
                        )}
                    </div>
                    <div className="ms-2">
                        <div className="d-flex align-items-center">
                            <h2 className="m-0"><strong>{restaurant.name}</strong></h2>
                            {/* Operating Hours Dropdown - keep this next to restaurant name */}
                            <div className="d-flex align-items-center ms-0">
                                <div className="position-relative">
                                    <button 
                                        className="hours-dropdown-btn m-0"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setShowHoursDropdown(!showHoursDropdown);
                                        }}
                                    >
                                        <i className="bi bi-clock me-1"></i>
                                        Operating Hours <i className={`bi bi-caret-${showHoursDropdown ? 'up' : 'down'}-fill ms-1`} style={{ fontSize: '0.7rem'}}></i>
                                    </button>
                                    
                                    {showHoursDropdown && (
                                        <div className="hours-dropdown rounded-4 py-2 px-4 w-100 dropdown-animate">
                                            {restaurant.operatingHours ? (
                                                Object.entries(restaurant.operatingHours).map(([day, hours]) => (
                                                    <div key={day} className="hours-dropdown-day">
                                                        <span className="day-name">{day}</span>
                                                        {hours && hours.open && hours.close ? (
                                                            <span className="hours-time">{hours.open} - {hours.close}</span>
                                                        ) : (
                                                            <span className="hours-time closed-day">Closed</span>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-muted mb-0">Hours not available</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <span className={`ms-0 fw-bold mb-0 ${isOpenNow ? 'text-success' : 'text-danger'}`}>{isOpenNow ? 'Open' : 'Closed'}</span>
                        {/* Show price range under open/closed status for quick cost reference */}
                        {restaurant.priceRange && (
                            <div className="text-muted" style={{ fontSize: '1.07em' }}>
                                {restaurant.priceRange}
                            </div>
                        )}
                        <div className="my-1" onClick={scrollToRating} style={{ cursor: 'pointer' }}>
                            {(ratingStats.rating > 0 || restaurant.rating > 0) && (
                                <div className="d-flex align-items-center">
                                    <span className="me-1" style={{ 
                                        color: (ratingStats.rating || restaurant.rating) 
                                            ? (parseFloat(ratingStats.rating || restaurant.rating) >= 4.0 
                                                ? "#28a745" 
                                                : parseFloat(ratingStats.rating || restaurant.rating) >= 3.0 
                                                    ? "#ffc107" 
                                                    : "#dc3545") 
                                            : "#000", 
                                        fontWeight: "600" 
                                    }}>
                                        {(ratingStats.rating || restaurant.rating).toFixed(1)}
                                    </span>
                                    <i className="bi bi-star-fill me-1" style={{ 
                                        color: (ratingStats.rating || restaurant.rating) 
                                            ? (parseFloat(ratingStats.rating || restaurant.rating) >= 4.0 
                                                ? "#28a745" 
                                                : parseFloat(ratingStats.rating || restaurant.rating) >= 3.0 
                                                    ? "#ffc107" 
                                                    : "#dc3545") 
                                            : "#000", 
                                        fontSize: "0.85rem" 
                                    }}></i>
                                    {(ratingStats.ratingCount > 0 || restaurant.ratingCount > 0) && (
                                        <span className="text-muted" style={{ fontSize: "0.85rem" }}>
                                            ({ratingStats.ratingCount || restaurant.ratingCount})
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        <p className="my-2 fst-italic text-muted">{restaurant.description}</p>
                        <p className="my-2">
                            <i className="bi bi-geo-alt-fill me-2"></i>
                            {`${restaurant.address.street}, ${restaurant.address.city}, ${restaurant.address.state} ${restaurant.address.zipCode}, ${restaurant.address.country}`}
                        </p>
                        <p className="my-2">
                            <i className="bi bi-envelope-fill me-2"></i>
                            {restaurant.email}
                        </p>
                        <p className="my-2">
                            <i className="bi bi-telephone-fill me-2"></i>
                            {restaurant.phone}
                        </p>
                    </div>
                </div>
                
                <div className="d-flex justify-content-start align-items-center mb-4">
                    <h3 className="fw-bold mb-0">On the Menu</h3>
                    
                    {/* Add the pill toggle under the "On the Menu" text */}
                    {restaurant && (restaurant.offersDelivery || restaurant.offersPickup) && (
                        <div className="d-flex align-items-center">
                            <div 
                                className={`pill-toggle ms-4 ${(!restaurant.offersDelivery || !restaurant.offersPickup) ? 'disabled' : ''}`} 
                                data-active={orderPreference}
                                onClick={() => {
                                    if (restaurant.offersDelivery && restaurant.offersPickup) {
                                        handleOrderPreferenceChange(orderPreference === "delivery" ? "pickup" : "delivery");
                                    }
                                }}
                                data-bs-toggle="tooltip"
                                data-bs-placement="bottom"
                                title={(!restaurant.offersDelivery || !restaurant.offersPickup) ? 
                                    (!restaurant.offersDelivery 
                                        ? "This restaurant currently offers only pickup." 
                                        : "This restaurant currently offers only delivery.")
                                    : ""}
                            >
                                <div className={`pill-toggle-option ${orderPreference === "pickup" ? "active" : ""}`}>
                                    Pickup
                                </div>
                                <div className={`pill-toggle-option ${orderPreference === "delivery" ? "active" : ""}`}>
                                    Delivery
                                </div>
                                <div className="pill-toggle-slider"></div>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Dish Section */}
                <div className="container py-2" id="menuSection">                    
                    {/* Category Filter Dropdown */}
                    {getUniqueCategories().length > 0 && (
                        <div className="d-flex align-items-center mb-4">
                            <label className="me-2 text-muted">Filter by category:</label>
                            <select 
                                className="form-select form-select-sm rounded-pill"
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                style={{ 
                                    width: "auto",
                                    border: "1px solid #dee2e6",
                                    boxShadow: "none",
                                    padding: "0.25rem 2rem 0.25rem 0.75rem",
                                    cursor: "pointer",
                                    display: "inline-block"
                                }}
                            >
                                <option value="all">All Categories</option>
                                {getUniqueCategories().map(category => (
                                    <option key={category} value={category}>
                                        {category.charAt(0).toUpperCase() + category.slice(1).toLowerCase()}
                                    </option>
                                ))}
                            </select>
                            {categoryFilter !== 'all' && (
                                <button 
                                    className="ms-3 btn btn-link p-0 text-success fw-medium"
                                    style={{ textDecoration: 'underline', fontSize: '0.9rem' }}
                                    onClick={() => setCategoryFilter('all')}
                                >
                                    Clear Filter
                                </button>
                            )}
                        </div>
                    )}
                    
                    <div className="row g-4 mb-5">
                        {getFilteredDishes().length > 0 ? (
                            getFilteredDishes().map((dish) => (
                                <div key={dish.id} className="col-md-6">
                                    <div 
                                        className="card border-1 h-100 rounded-4 overflow-hidden" 
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => handleDishClick(dish)}
                                    >
                                        <div className="row g-0 h-100">
                                            <div className="col-8">
                                                <div className="card-body d-flex flex-column h-100">
                                                    <h5 className="card-title">{dish.name}</h5>
                                                    <p className="card-text">{getDishPriceDisplay(dish)}</p>
                                                    <p className="card-text text-muted">{dish.description}</p>
                                                </div>
                                            </div>
                                            <div className="col-4 position-relative">
                                                <img 
                                                    src={dish.imageUrl || DEFAULT_IMAGE_PLACEHOLDER}
                                                    className="img-fluid h-100" 
                                                    alt={dish.name} 
                                                    style={{ 
                                                        objectFit: "cover",
                                                        height: "100%",
                                                        width: "100%"
                                                    }} 
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = DEFAULT_IMAGE_PLACEHOLDER;
                                                    }}
                                                />
                                                <button 
                                                    className="btn btn-light rounded-circle position-absolute d-flex align-items-center justify-content-center"
                                                    style={{ 
                                                        bottom: "10px", 
                                                        right: "10px",
                                                        width: "40px",
                                                        height: "40px",
                                                        boxShadow: "0 2px 5px rgba(0,0,0,0.2)"
                                                    }}
                                                    onClick={() => handleDishClick(dish)}
                                                >
                                                    <i className="bi bi-plus fw-bold" style={{ 
                                                        fontSize: "28px",
                                                        fontWeight: "900",
                                                        marginTop: "-2px"  // Optical centering
                                                    }}></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-12">
                                <div className="alert alert-light w-75">
                                    {restaurant.dishes && restaurant.dishes.length > 0 
                                        ? "No available dishes. Please check back later." 
                                        : "No dishes are currently available for this restaurant."}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Reviews Section */}
            <div className="container mt-4 mb-5" id="ratingSection">
                <h3 className="mb-4 fw-bold">Ratings & Reviews</h3>
                <div className="d-flex align-items-center justify-content-between mb-3">
                    <div className="d-flex align-items-center">
                        <div className="d-flex align-items-center me-3">
                            <span className="me-1" style={{ 
                                color: (ratingStats.rating || restaurant.rating) 
                                    ? (parseFloat(ratingStats.rating || restaurant.rating) >= 4.0 
                                        ? "#28a745" 
                                        : parseFloat(ratingStats.rating || restaurant.rating) >= 3.0 
                                            ? "#ffc107" 
                                            : "#dc3545") 
                                    : "#000", 
                                fontWeight: "600" 
                            }}>
                                {((ratingStats.rating || restaurant.rating) > 0 
                                    ? (ratingStats.rating || restaurant.rating).toFixed(1) 
                                    : 'N/A')}
                            </span>
                            <i className="bi bi-star-fill me-1" style={{ 
                                color: (ratingStats.rating || restaurant.rating) 
                                    ? (parseFloat(ratingStats.rating || restaurant.rating) >= 4.0 
                                        ? "#28a745" 
                                        : parseFloat(ratingStats.rating || restaurant.rating) >= 3.0 
                                            ? "#ffc107" 
                                            : "#dc3545") 
                                    : "#000", 
                                fontSize: "0.85rem" 
                            }}></i>
                            {(ratingStats.ratingCount > 0 || restaurant.ratingCount > 0) && (
                                <span className="text-muted" style={{ fontSize: "0.85rem" }}>
                                    ({ratingStats.ratingCount || restaurant.ratingCount})
                                </span>
                            )}
                        </div>
                        
                        {/* Sort Dropdown - Update to match CustomerOrders.jsx styling */}
                        {ratings && ratings.length > 1 && (
                            <div className="dropdown">
                                <button 
                                    className="btn btn-outline-dark rounded-pill dropdown-toggle py-1 px-3" 
                                    type="button"
                                    ref={dropdownRef}
                                    data-bs-toggle="dropdown"
                                    aria-expanded="false"
                                >
                                    Sort: {sortOption === "latest" ? "Latest" : 
                                          sortOption === "oldest" ? "Oldest" : 
                                          sortOption === "highest" ? "High→Low" : 
                                          "Low→High"}
                                </button>
                                <ul 
                                    className="dropdown-menu shadow-sm rounded-3"
                                    style={{ 
                                        minWidth: "150px", 
                                        fontSize: "0.9rem",
                                        transition: "transform 0.2s ease-out, opacity 0.2s ease-out"
                                    }}
                                >
                                    <li>
                                        <button 
                                            className={`dropdown-item rounded-3 ${sortOption === "latest" ? "fw-bold text-dark" : ""}`}
                                            onClick={() => setSortOption("latest")}
                                        >
                                            Latest
                                        </button>
                                    </li>
                                    <li>
                                        <button 
                                            className={`dropdown-item rounded-3 ${sortOption === "oldest" ? "fw-bold text-dark" : ""}`}
                                            onClick={() => setSortOption("oldest")}
                                        >
                                            Oldest
                                        </button>
                                    </li>
                                    <li>
                                        <button 
                                            className={`dropdown-item rounded-3 ${sortOption === "highest" ? "fw-bold text-dark" : ""}`}
                                            onClick={() => setSortOption("highest")}
                                        >
                                            High→Low
                                        </button>
                                    </li>
                                    <li>
                                        <button 
                                            className={`dropdown-item rounded-3 ${sortOption === "lowest" ? "fw-bold text-dark" : ""}`}
                                            onClick={() => setSortOption("lowest")}
                                        >
                                            Low→High
                                        </button>
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>
                    
                    {customer && ratingsStatus === 'succeeded' && (
                        !ratings.find(review => review.customer?.id === customer?.id) && (
                            <button 
                                className="btn btn-outline-dark rounded-pill"
                                onClick={handleAddReviewClick}
                            >
                                <i className="bi bi-plus-lg me-1"></i>
                                Add Review
                            </button>
                        )
                    )}
                </div>
                
                {ratingsStatus === 'loading' && (
                    <div className="d-flex justify-content-center my-4">
                        <div className="spinner-border text-success" role="status">
                            <span className="visually-hidden">Loading reviews...</span>
                        </div>
                    </div>
                )}
                
                {ratingsStatus === 'failed' && ratingsError && (
                    <div className="alert alert-danger">
                        {ratingsError}
                    </div>
                )}
                
                {ratingsStatus === 'succeeded' && (
                    <>
                        {ratings.length === 0 ? (
                            <div className="alert alert-light">
                                No reviews yet for this restaurant.
                            </div>
                        ) : (
                            <div className="row g-4">
                                {getSortedRatings().map(review => (
                                    <div key={review.id} className="col-md-6">
                                        <div className={`card rating-card h-100 rounded-4 overflow-hidden`}>
                                            <div className="card-body">
                                                <div className="d-flex justify-content-between align-items-start mb-2">
                                                    <div className="d-flex align-items-center">
                                                        <img 
                                                            src={review.customer?.imageUrl || DEFAULT_PROFILE_IMAGE} 
                                                            alt={review.customer?.name}
                                                            className="rounded-circle me-3"
                                                            style={{ width: "50px", height: "50px", objectFit: "cover" }}
                                                        />
                                                        <div>
                                                            <h6 className="mb-0 fw-bold">{review.customer?.name} {customer && customer?.id === review?.customer?.id && <span className="text-muted fw-normal"> (You)</span>}</h6>
                                                            <div className="d-flex align-items-center">
                                                                <div className="me-2">
                                                                    {Array.from({ length: 5 }).map((_, i) => (
                                                                        <i 
                                                                            key={i} 
                                                                            className={`bi ${i < review.rating ? 'bi-star-fill' : 'bi-star'}`}
                                                                            style={{ color: i < review.rating ? '#000' : '#ccc', fontSize: "0.85rem", marginRight: "2px" }}
                                                                        ></i>
                                                                    ))}
                                                                </div>
                                                                <small className="text-muted">{formatDate(review.createdAt)}</small>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    {customer && customer?.id === review?.customer?.id && (
                                                        <div className="d-flex">
                                                            <button 
                                                                className="btn btn-sm btn-outline-dark rounded-circle me-1 d-flex align-items-center justify-content-center" 
                                                                onClick={() => handleEditClick(review)}
                                                                title="Edit review"
                                                                style={{width: "28px", height: "28px"}}
                                                            >
                                                                <i className="bi bi-pencil"></i>
                                                            </button>
                                                            <button 
                                                                className="btn btn-sm btn-outline-danger rounded-circle d-flex align-items-center justify-content-center" 
                                                                onClick={() => handleDeleteReview(review.id)}
                                                                title="Delete review"
                                                                style={{width: "28px", height: "28px"}}
                                                            >
                                                                <i className="bi bi-trash"></i>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {/* Display review text */}
                                                {review.review && (
                                                    <p className="review-text mb-0">{review.review}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
            
            {/* Edit Review Modal */}
            <Modal show={showEditModal} onHide={() => setShowEditModal(false)} contentClassName="rounded-5 p-3">
                <Modal.Header closeButton className="border-0">
                    <Modal.Title contentClassName="fw-bolder">Edit Your Review</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="mb-3">
                        <label className="form-label">Rating <span className="text-danger">*</span></label>
                        <div className="star-rating mb-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <i
                                    key={star}
                                    className={`bi ${star <= editRating.rating ? 'bi-star-fill' : 'bi-star'}`}
                                    style={{ 
                                        fontSize: '1.5rem', 
                                        cursor: 'pointer',
                                        color: star <= editRating.rating ? '#000' : '#ccc',
                                        marginRight: '5px'
                                    }}
                                    onClick={() => {
                                        setEditRating({...editRating, rating: star});
                                        setEditRatingError("");
                                    }}
                                ></i>
                            ))}
                        </div>
                        {editRatingError && (
                            <div className="text-danger small mb-2">
                                {editRatingError}
                            </div>
                        )}
                    </div>
                    <div className="mb-3">
                        <label htmlFor="reviewText" className="form-label">Review (Optional)</label>
                        <textarea
                            className="form-control"
                            id="reviewText"
                            rows="3"
                            value={editRating.review}
                            onChange={(e) => setEditRating({...editRating, review: e.target.value})}
                            placeholder="Share your experience with this restaurant..."
                        ></textarea>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="outline-secondary" onClick={() => setShowEditModal(false)}>
                        Cancel
                    </Button>
                    <Button variant="dark" onClick={handleSaveReview}>
                        Save Changes
                    </Button>
                </Modal.Footer>
            </Modal>
            
            {/* Add Review Modal */}
            <Modal show={showAddModal} onHide={() => setShowAddModal(false)} contentClassName="rounded-5 p-3">
                <Modal.Header closeButton className="border-0">
                    <Modal.Title contentClassName="fw-bolder">Add Your Review</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="mb-3">
                        <label className="form-label">Rating <span className="text-danger">*</span></label>
                        <div className="star-rating mb-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <i
                                    key={star}
                                    className={`bi ${star <= newRating.rating ? 'bi-star-fill' : 'bi-star'}`}
                                    style={{ 
                                        fontSize: '1.5rem', 
                                        cursor: 'pointer',
                                        color: star <= newRating.rating ? '#000' : '#ccc',
                                        marginRight: '5px'
                                    }}
                                    onClick={() => {
                                        setNewRating({...newRating, rating: star});
                                        setRatingError("");
                                    }}
                                ></i>
                            ))}
                        </div>
                        {ratingError && (
                            <div className="text-danger small mb-2">
                                {ratingError}
                            </div>
                        )}
                    </div>
                    <div className="mb-3">
                        <label htmlFor="reviewText" className="form-label">Review (Optional)</label>
                        <textarea
                            className="form-control"
                            id="reviewText"
                            rows="3"
                            value={newRating.review}
                            onChange={(e) => setNewRating({...newRating, review: e.target.value})}
                            placeholder="Share your experience with this restaurant..."
                        ></textarea>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button 
                        variant="dark" 
                        onClick={handleSaveNewReview}
                    >
                        Submit Review
                    </Button>
                </Modal.Footer>
            </Modal>
            
            {/* Dish Detail Modal */}
            <Modal 
                show={showDishModal} 
                onHide={() => setShowDishModal(false)} 
                size="lg"
                contentClassName="rounded-4 border-0 py-2 px-3"
            >
                <Modal.Header closeButton className="border-0 pt-3 pb-0">
                </Modal.Header>
                <Modal.Body>
                    <style>
                        {`
                        #ingredientsCollapse {
                            transition: height 0.3s ease;
                            overflow: hidden;
                        }
                        
                        /* Add CSS to rotate caret when ingredients are shown */
                        [aria-expanded="true"] .bi-caret-down-fill {
                            transform: rotate(180deg);
                        }
                        `}
                    </style>
                    <div className="row">
                        <div className="col-md-6 mb-0 py-0 mb-md-0 d-flex align-items-center justify-content-center">
                            <img 
                                src={selectedDish?.imageUrl || DEFAULT_IMAGE_PLACEHOLDER} 
                                alt={selectedDish?.name}
                                className="img-fluid rounded-2 w-100 h-100"
                                style={{ 
                                    objectFit: "cover",
                                    maxHeight: "300px"
                                }}
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = DEFAULT_IMAGE_PLACEHOLDER;
                                }}
                            />
                        </div>
                        <div className="col-md-6">
                            <h5 className="m-0 mb-2 fs-4 fw-bold">{selectedDish?.name}</h5>
                            <p className="text-muted mb-2">{selectedDish?.description}</p>   
                            {/* Ingredients Section */}
                            {selectedDish?.ingredients && selectedDish.ingredients.length > 0 && (
                                <div className="mb-3">
                                    <p 
                                        className="text-success mb-1 fw-medium text-decoration-underline d-flex align-items-center" 
                                        style={{ cursor: 'pointer' }}
                                        data-bs-toggle="collapse" 
                                        data-bs-target="#ingredientsCollapse" 
                                        aria-expanded="false" 
                                        aria-controls="ingredientsCollapse"
                                        onClick={(e) => {
                                            // Toggle the aria-expanded attribute
                                            const isExpanded = e.currentTarget.getAttribute('aria-expanded') === 'true';
                                            e.currentTarget.setAttribute('aria-expanded', !isExpanded);
                                        }}
                                    >
                                        <span>Show ingredients</span>
                                    </p>
                                    <div className="collapse" id="ingredientsCollapse">
                                        <p className="text-muted small mb-3">
                                            {selectedDish.ingredients.join(', ')}
                                        </p>
                                    </div>
                                </div>
                            )}
                            
                            {/* Size Selection */}
                            <div className="mb-3">
                                <h6 className="mb-2">Size</h6>
                                {selectedDish?.sizes && selectedDish.sizes.length > 1 ? (
                                    <div>
                                        {selectedDish.sizes.map((size, index) => (
                                            <div className="form-check mb-2" key={index}>
                                                <input
                                                    className="form-check-input"
                                                    type="radio"
                                                    name="sizeRadio"
                                                    id={`size-${index}`}
                                                    checked={selectedSize && selectedSize.size === size.size}
                                                    onChange={() => setSelectedSize(size)}
                                                />
                                                <label className="form-check-label d-flex justify-content-between" htmlFor={`size-${index}`}>
                                                    <span>{size.size}</span>
                                                    <span>${size.price.toFixed(2)}</span>
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="mb-3">
                                        <div className="d-flex justify-content-between">
                                            <span>{selectedDish?.sizes && selectedDish.sizes.length > 0 ? selectedDish.sizes[0].size : 'Standard'}</span>
                                            <span>${selectedDish?.sizes && selectedDish.sizes.length > 0 ? selectedDish.sizes[0].price.toFixed(2) : 'N/A'}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Quantity Selection */}
                            <div className="mb-1">
                                <h6 className="mb-2">Quantity</h6>
                                <div className="d-flex align-items-center">
                                    <select 
                                        className="form-select rounded-pill bg-light"
                                        value={quantity}
                                        onChange={(e) => setQuantity(parseInt(e.target.value))}
                                        style={{ 
                                            width: "80px",
                                            border: "1px solid #dee2e6",
                                            boxShadow: "none",
                                            padding: "0.375rem 1.75rem 0.375rem 0.75rem",
                                            cursor: "pointer"
                                        }}
                                    >
                                        {[...Array(99)].map((_, i) => (
                                            <option key={i} value={i + 1}>{i + 1}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer className="border-0">
                    <Button
                        variant="dark"
                        onClick={handleAddDishToCart}
                        disabled={!selectedSize}
                        style={{ width: '50%' }}
                    >
                        Add {quantity} to cart for ${selectedSize ? (selectedSize.price * quantity).toFixed(2) : '0.00'}
                    </Button>
                </Modal.Footer>
            </Modal>
            
            {/* Modal to confirm new order when switching restaurants */}
            <Modal show={showSwitchModal} onHide={() => setShowSwitchModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Do you want to create a new order?</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    Your order contains items from {oldRestaurantName || 'another restaurant'}. Create a new order to add items from {restaurant.name}?
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="primary" onClick={handleConfirmSwitch}>Yes</Button>
                </Modal.Footer>
            </Modal>
            
            {/* Cart Notification Bubble */}
            {showCartNotification && (
                <div 
                    className="position-fixed d-flex flex-column align-items-center justify-content-center"
                    style={{
                        top: '60px',
                        right: '85px',
                        background: '#28a745',
                        color: 'white',
                        padding: '8px 15px',
                        borderRadius: '20px',
                        zIndex: 1050,
                        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                        animation: 'fadeIn 0.3s ease-in-out'
                    }}
                >
                    <span className="fw-medium">{addedQuantity} {addedQuantity === 1 ? 'item' : 'items'} added</span>
                    <Link to="/cart" className="fw-bold text-white text-decoration-none d-flex align-items-center mt-1">
                        View Cart
                    </Link>
                </div>
            )}
            
            {/* Add this style block for the animation */}
            <style>
                {`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                `}
            </style>
        </>
    );
};

export default RestaurantDetail;