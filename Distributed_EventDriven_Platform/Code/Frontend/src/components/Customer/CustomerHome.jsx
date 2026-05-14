import React, { useEffect, useMemo, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import axios from "../../config/axios";
import { fetchRestaurants, clearRestaurant } from "../../redux/slices/restaurant/restaurantSlice";
import "bootstrap/dist/css/bootstrap.min.css";
import NavbarDark from "../Common/NavbarDark";
import { resetOrderStatus } from "../../redux/slices/customer/orderSlice";
import { fetchFavorites, addFavorite, removeFavorite } from "../../redux/slices/customer/favoriteSlice";
import { useNavigate, useLocation } from "react-router-dom";
import { selectOrderPreference, clearCart } from "../../redux/slices/customer/cartSlice";
import { Modal, Button } from "react-bootstrap";

const DEFAULT_IMAGE_PLACEHOLDER = "https://res.cloudinary.com/dvylvq84d/image/upload/v1744151036/ImagePlaceholder_gg1xob.png";

const CustomerHome = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    
    // Get restaurants from Redux store
    const { restaurantList, listStatus, listError } = useSelector((state) => state.restaurant);
    const { customer } = useSelector((state) => state.auth);
    const { favoriteRestaurants } = useSelector((state) => state.favorites);
    
    const orderStatus = useSelector((state) => state.order.orderStatus);
    // Get current order preference (delivery or pickup)
    const orderPreference = useSelector(selectOrderPreference);
    const cartItems = useSelector(state => state.cart.items);
    const cartRestaurantId = useSelector(state => state.cart.restaurantId);

    // State for sort and filter dropdowns
    const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
    const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
    const [sortOption, setSortOption] = useState(null);
    const [filterRating, setFilterRating] = useState(null);
    // Selected category filter state
    const [selectedCategory, setSelectedCategory] = useState(null);
    
    // Refs for dropdown elements
    const sortDropdownRef = useRef(null);
    const filterDropdownRef = useRef(null);

    const [showSwitchModal, setShowSwitchModal] = useState(false);
    const [pendingRestaurant, setPendingRestaurant] = useState({ id: null, name: "" });
    const [oldRestaurantName, setOldRestaurantName] = useState("");

    useEffect(() => {
        dispatch(clearRestaurant());
        if (orderStatus === "succeeded") {
            dispatch(resetOrderStatus());
        }
    }, [orderStatus, dispatch]);

    // Always fetch restaurants when component mounts or when navigating back
    useEffect(() => {
        // Fetch restaurants data regardless of current state
        dispatch(fetchRestaurants());
    }, [dispatch, location.key]); // location.key changes when navigating

    useEffect(() => {
        if (customer) {
            dispatch(fetchFavorites(customer.id));
        }
    }, [customer, dispatch]);

    useEffect(() => {
        if (cartRestaurantId) {
            const prev = restaurantList.find(r => (r.id === cartRestaurantId || r._id === cartRestaurantId));
            if (prev) setOldRestaurantName(prev.name);
        }
    }, [cartRestaurantId, restaurantList]);

    // Add handler for clicks outside dropdowns
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target)) {
                setSortDropdownOpen(false);
            }
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
                setFilterDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Filter and sort restaurants based on selected options
    const processedRestaurants = useMemo(() => {
        if (!restaurantList || restaurantList.length === 0) return [];
        
        // First filter by order preference
        let processed = restaurantList.filter(restaurant => {
            if (orderPreference === "delivery") {
                return restaurant.offersDelivery;
            } else if (orderPreference === "pickup") {
                return restaurant.offersPickup;
            }
            return true; // Show all if no preference
        });
        
        // Then filter by rating if applicable
        if (filterRating) {
            processed = processed.filter(restaurant => {
                const rating = parseFloat(restaurant.rating || 0);
                return rating >= filterRating;
            });
        }
        
        // Then filter by selected category if chosen
        if (selectedCategory) {
            processed = processed.filter(restaurant => Array.isArray(restaurant.cuisine) && restaurant.cuisine.includes(selectedCategory));
        }
        
        // Then sort if applicable
        if (sortOption) {
            processed.sort((a, b) => {
                const ratingA = parseFloat(a.rating || 0);
                const ratingB = parseFloat(b.rating || 0);
                
                if (sortOption === 'low-high') {
                    return ratingA - ratingB;
                } else {
                    return ratingB - ratingA;
                }
            });
        }
        
        return processed;
    }, [restaurantList, orderPreference, sortOption, filterRating, selectedCategory]);

    const handleRestaurantClick = (restaurantId) => {
        const target = restaurantList.find(r => (r.id === restaurantId || r._id === restaurantId));
        const name = target ? target.name : "";
        if (cartItems.length > 0 && cartRestaurantId && cartRestaurantId !== restaurantId) {
            setPendingRestaurant({ id: restaurantId, name });
            setShowSwitchModal(true);
        } else {
            navigate(`/restaurant/${restaurantId}`);
        }
    };

    const handleConfirmSwitch = () => {
        dispatch(clearCart());
        setShowSwitchModal(false);
        navigate(`/restaurant/${pendingRestaurant.id}`);
    };

    const toggleFavorite = (restaurantId) => {
        if (!customer) return;
        
        // Check if restaurantId is in favorites array
        const isCurrentlyFavorite = Array.isArray(favoriteRestaurants) && 
            favoriteRestaurants.some(id => id === restaurantId || 
                (typeof id === 'object' && id !== null && (id._id === restaurantId || id.id === restaurantId)));
        
        if (isCurrentlyFavorite) {
            console.log("Removing from favorites:", restaurantId);
            dispatch(removeFavorite({ customerId: customer.id, restaurantId }));
        } else {
            console.log("Adding to favorites:", restaurantId);
            dispatch(addFavorite({ customerId: customer.id, restaurantId }));
        }
    };

    // Helper function to check if a restaurant is in favorites
    const isRestaurantFavorite = (restaurantId) => {
        return Array.isArray(favoriteRestaurants) && 
            favoriteRestaurants.some(id => id === restaurantId || 
                (typeof id === 'object' && id !== null && (id._id === restaurantId || id.id === restaurantId)));
    };

    // Scroll selector state & handlers
    const scrollRef = useRef(null);
    const [showLeft, setShowLeft] = useState(false);
    const [showRight, setShowRight] = useState(false);
    useEffect(() => {
        const el = scrollRef.current;
        const checkScroll = () => {
            if (!el) return;
            setShowLeft(el.scrollLeft > 5);
            setShowRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 5);
        };
        checkScroll();
        if (el) {
            el.addEventListener('scroll', checkScroll);
            window.addEventListener('resize', checkScroll);
        }
        return () => {
            if (el) el.removeEventListener('scroll', checkScroll);
            window.removeEventListener('resize', checkScroll);
        };
    }, []);

    const scrollBy = (amount) => {
        if (scrollRef.current) scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    };

    const categories = [
        { id: 'bakery', label: 'Bakery', img: 'https://res.cloudinary.com/dvylvq84d/image/upload/v1745693189/Bakery_yolnhu.png' },
        { id: 'burger', label: 'Burger', img: 'https://res.cloudinary.com/dvylvq84d/image/upload/v1745693190/Burger_r5hrxs.png' },
        { id: 'chinese', label: 'Chinese', img: 'https://res.cloudinary.com/dvylvq84d/image/upload/v1745693191/Chinese_kk0iom.png' },
        { id: 'coffee', label: 'Coffee', img: 'https://res.cloudinary.com/dvylvq84d/image/upload/v1745693192/Coffee_hmjj6u.png' },
        { id: 'dessert', label: 'Dessert', img: 'https://res.cloudinary.com/dvylvq84d/image/upload/v1745693193/Dessert_kww1ku.png' },
        { id: 'drinks', label: 'Drinks', img: 'https://res.cloudinary.com/dvylvq84d/image/upload/v1745693195/Drinks_rgdqjp.png' },
        { id: 'fries', label: 'Fries', img: 'https://res.cloudinary.com/dvylvq84d/image/upload/v1745693196/Fries_rqagce.png' },
        { id: 'hawaiian', label: 'Hawaiian', img: 'https://res.cloudinary.com/dvylvq84d/image/upload/v1745693197/Hawaiian_pivxap.png' },
        { id: 'ice_cream', label: 'Ice Cream', img: 'https://res.cloudinary.com/dvylvq84d/image/upload/v1745693198/Icecream_c9wdo3.png' },
        { id: 'indian', label: 'Indian', img: 'https://res.cloudinary.com/dvylvq84d/image/upload/v1745693199/Indian_c5scgd.png' },
        { id: 'mexican', label: 'Mexican', img: 'https://res.cloudinary.com/dvylvq84d/image/upload/v1745693200/Mexican_turbux.png' },
        { id: 'noodles', label: 'Noodles', img: 'https://res.cloudinary.com/dvylvq84d/image/upload/v1745693202/Noodles_ugoggv.png' },
        { id: 'pizza', label: 'Pizza', img: 'https://res.cloudinary.com/dvylvq84d/image/upload/v1745693203/Pizza_sxdmbv.png' },
        { id: 'sandwich', label: 'Sandwich', img: 'https://res.cloudinary.com/dvylvq84d/image/upload/v1745693204/Sandwich_rt38qv.png' },
        { id: 'thai', label: 'Thai', img: 'https://res.cloudinary.com/dvylvq84d/image/upload/v1745693205/Thai_bbkecx.png' },
        { id: 'wings', label: 'Wings', img: 'https://res.cloudinary.com/dvylvq84d/image/upload/v1745693207/Wings_i6kicj.png' },
    ];

    const filteredCategories = categories.filter(cat =>
        restaurantList.some(r => Array.isArray(r.cuisine) && r.cuisine.includes(cat.id))
    );

    return (
        <>
            <NavbarDark />
            <div className="position-relative container mb-3">
                <div className="d-flex align-items-center justify-content-center">
                    {/* Left nav button, only visible if scrollable left */}
                    <button
                        className={`btn btn-light shadow-sm rounded-circle me-2 d-none d-md-flex${showLeft ? '' : ' invisible'}`}
                        style={{ zIndex: 2 }}
                        aria-label="Scroll left"
                        onClick={() => scrollBy(-200)}
                        tabIndex={showLeft ? 0 : -1}
                    >
                        <i className="bi bi-chevron-left fs-4"></i>
                    </button>
                    <div
                        ref={scrollRef}
                        className="flex-grow-1 flex-nowrap overflow-auto d-flex align-items-center hide-scrollbar category-scroll-container px-3 px-md-4"
                        style={{ gap: '1rem', scrollBehavior: 'smooth' }}
                    >
                        {filteredCategories.map((cat) => (
                            <div
                                key={cat.label}
                                onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                                className="d-flex flex-column align-items-center justify-content-center"
                                style={{ minWidth: 80, cursor: 'pointer' }}
                            >
                                <div
                                    className={`bg-white d-flex align-items-center justify-content-center rounded-circle icon-rotatable ${selectedCategory === cat.id ? 'icon-rotate border border-3 border-light shadow-sm' : 'border-0'}`}
                                    style={{ width: 72, height: 72, overflow: 'hidden' }}
                                >
                                    <img
                                        src={cat.img}
                                        alt={cat.label}
                                        style={{ width: 56, height: 56, objectFit: 'contain' }}
                                    />
                                </div>
                                <span
                                    className={`small mt-1 text-center text-nowrap ${selectedCategory === cat.id ? 'fw-bold' : ''}`}
                                    style={{ fontSize: 13 }}
                                >
                                    {cat.label}
                                </span>
                            </div>
                        ))}
                    </div>
                    {/* Right nav button, only visible if scrollable right */}
                    <button
                        className={`btn btn-light shadow-sm rounded-circle ms-2 d-none d-md-flex${showRight ? '' : ' invisible'}`}
                        style={{ zIndex: 2 }}
                        aria-label="Scroll right"
                        onClick={() => scrollBy(200)}
                        tabIndex={showRight ? 0 : -1}
                    >
                        <i className="bi bi-chevron-right fs-4"></i>
                    </button>
                </div>
                <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
            </div>
            <div className="container d-flex flex-wrap align-items-center gap-2 justify-content-center justify-content-md-start mb-3">
                <h2 className="fw-bold me-3">Restaurants</h2>
                
                <div className="d-flex flex-wrap align-items-center gap-2">
                    {/* Sort Dropdown */}
                    <div className="position-relative" ref={sortDropdownRef}>
                        <button 
                            className="btn text-dark rounded-pill py-1 px-3"
                            onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                            style={{
                                fontSize: '0.9rem',
                                width: "auto",
                                border: "1px solid #dee2e6",
                                boxShadow: "none",
                                padding: "0.25rem 2rem 0.25rem 0.75rem",
                                cursor: "pointer",
                                display: "inline-block"
                            }}
                        >
                            <span>Sort: {sortOption ? (sortOption === 'high-low' ? 'High → Low' : 'Low → High') : 'By Rating'}</span>
                            <i className={`bi bi-caret-${sortDropdownOpen ? 'up' : 'down'}-fill ms-2`} style={{ fontSize: '0.7rem' }}></i>
                        </button>
                        
                        {sortDropdownOpen && (
                            <div className="position-absolute mt-1 bg-white shadow rounded p-2" style={{ right: 0, zIndex: 1000, minWidth: '150px' }}>
                                <div 
                                    className={`py-1 px-2 rounded ${sortOption === 'high-low' ? 'bg-light fw-bold' : 'hover-bg-light'}`}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => {
                                        setSortOption('high-low');
                                        setSortDropdownOpen(false);
                                    }}
                                >
                                    High → Low
                                </div>
                                <div 
                                    className={`py-1 px-2 rounded ${sortOption === 'low-high' ? 'bg-light fw-bold' : 'hover-bg-light'}`}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => {
                                        setSortOption('low-high');
                                        setSortDropdownOpen(false);
                                    }}
                                >
                                    Low → High
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Filter Dropdown */}
                    <div className="position-relative" ref={filterDropdownRef}>
                        <button 
                            className="btn text-dark rounded-pill py-1 px-3"
                            onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
                            style={{ 
                                fontSize: '0.9rem',
                                width: "auto",
                                border: "1px solid #dee2e6",
                                boxShadow: "none",
                                padding: "0.25rem 2rem 0.25rem 0.75rem",
                                cursor: "pointer",
                                display: "inline-block"
                             }}
                        >
                            <span>Filter: {filterRating ? `${filterRating}★ & up` : 'By Rating'}</span>
                            <i className={`bi bi-caret-${filterDropdownOpen ? 'up' : 'down'}-fill ms-2`} style={{ fontSize: '0.7rem' }}></i>
                        </button>
                        
                        {filterDropdownOpen && (
                            <div className="position-absolute mt-1 bg-white shadow rounded p-2" style={{ right: 0, zIndex: 1000, minWidth: '150px' }}>
                                {[1, 2, 3, 4].map(rating => (
                                    <div 
                                        key={rating}
                                        className={`py-1 px-2 rounded ${filterRating === rating ? 'bg-light fw-bold' : 'hover-bg-light'}`}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => {
                                            setFilterRating(rating);
                                            setFilterDropdownOpen(false);
                                        }}
                                    >
                                        {[...Array(rating)].map((_, i) => (
                                            <i key={i} className="bi bi-star-fill" style={{ color: '#000', fontSize: '0.85rem' }}></i>
                                        ))}
                                        {rating < 4 ? ' and up' : ' +'}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {/* Clear All option */}
                    {(sortOption || filterRating) && (
                        <div className="d-flex align-items-center">
                            <span 
                                className="text-decoration-underline" 
                                style={{ cursor: 'pointer', fontSize: '0.9rem' }}
                                onClick={() => {
                                    setSortOption(null);
                                    setFilterRating(null);
                                }}
                            >
                                Clear all
                            </span>
                        </div>
                    )}
                </div>
            </div>
            <div className="container mt-4">
                {listStatus === "loading" && <p>Loading restaurants...</p>}
                {listStatus === "failed" && <p className="text-danger">{listError}</p>}
                {listStatus === "succeeded" && processedRestaurants.length === 0 && (
                    <div className="alert alert-light w-75">
                        No restaurants for display. 
                        Try switching to {orderPreference === "delivery" ? "pickup" : "delivery"} mode instead, or modify your sort/filter selection.
                    </div>
                )}

                <div key="restaurant-row" className="row g-4">
                    {processedRestaurants.map((restaurant) => (
                        <div 
                            key={restaurant.id} 
                            className="col-12 col-sm-6 col-md-4 col-lg-3 mb-4" 
                            style={{ cursor: "pointer", position: "relative" }}
                        >
                            <div 
                                className="card border-0 no-hover" 
                                style={{ overflow: "hidden" }}
                                onClick={() => handleRestaurantClick(restaurant.id)}
                            >
                                <img
                                    key={`img-${restaurant.id}`}
                                    src={restaurant.imageUrl || DEFAULT_IMAGE_PLACEHOLDER}
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
                                    {customer && (
                                        <i
                                            key={`heart-${restaurant.id}`}
                                            className={`bi ${isRestaurantFavorite(restaurant.id) ? "bi-heart-fill text-danger" : "bi-heart text-secondary"}`}
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
                                                toggleFavorite(restaurant.id);
                                            }}
                                        ></i>
                                    )}
                                    
                                    <p key={`name-${restaurant.id}`} className="card-title fw-bold">{restaurant.name}</p>
                                    
                                    {/* Rating display with price range for quick cost reference */}
                                    <div className="d-flex align-items-center" style={{ marginTop: "-8px" }}>
                                        <span className="me-1" style={{ 
                                            color: restaurant.rating 
                                                ? (parseFloat(restaurant.rating) >= 4.0 
                                                    ? "#28a745" 
                                                    : parseFloat(restaurant.rating) >= 3.0 
                                                        ? "#ffc107" 
                                                        : "#dc3545") 
                                                : "#000", 
                                            fontWeight: "600" 
                                        }}>
                                            {restaurant.rating ? parseFloat(restaurant.rating).toFixed(1) : "New"}
                                        </span>
                                        <i className="bi bi-star-fill me-1" style={{ 
                                            color: restaurant.rating 
                                                ? (parseFloat(restaurant.rating) >= 4.0 
                                                    ? "#28a745" 
                                                    : parseFloat(restaurant.rating) >= 3.0 
                                                        ? "#ffc107" 
                                                        : "#dc3545") 
                                                : "#000", 
                                            fontSize: "0.85rem" 
                                        }}></i>
                                        {restaurant.ratingCount > 0 && (
                                            <span className="text-muted" style={{ fontSize: "0.85rem" }}>
                                                ({restaurant.ratingCount})
                                            </span>
                                        )}
                                        {/* Show price range next to rating, in muted grey */}
                                        {restaurant.priceRange && (
                                            <span className="ms-2 text-muted" style={{ fontSize: "0.97em" }}>
                                                {restaurant.priceRange}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <Modal contentClassName="rounded-4 border-0 px-3 py-1" show={showSwitchModal} onHide={() => setShowSwitchModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title className="fw-semibold">Do you want to create a new order?</Modal.Title>
                </Modal.Header>
                <Modal.Body className="mb-2">
                    Your order contains items from {oldRestaurantName}. Create a new order to add items from {pendingRestaurant.name}?
                </Modal.Body>
                <Button variant="dark w-100 mb-3" onClick={handleConfirmSwitch}>Yes, Create Order</Button>
            </Modal>
        </>
    );
};

export default CustomerHome;