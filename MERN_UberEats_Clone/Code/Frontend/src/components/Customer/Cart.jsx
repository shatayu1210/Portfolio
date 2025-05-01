import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { resetOrderStatus } from "../../redux/slices/customer/orderSlice";
import { 
    updateQuantity, 
    removeItem,
    clearCart, 
    selectCartTotal,
    setOrderPreference,
    selectOrderPreference,
    updateItemSize,
    updateCartItemCategory
} from '../../redux/slices/customer/cartSlice';
import { placeOrder } from '../../redux/slices/customer/orderSlice'
import { addAddress } from '../../redux/slices/customer/addressSlice';
import { createSelector } from '@reduxjs/toolkit';
import NavbarDark from '../Common/NavbarDark';
import "bootstrap-icons/font/bootstrap-icons.css";
import axios from "../../config/axios";
import { fetchCustomer } from "../../redux/slices/customer/customerSlice";

const DEFAULT_IMAGE_PLACEHOLDER = "https://res.cloudinary.com/dvylvq84d/image/upload/v1744151036/ImagePlaceholder_gg1xob.png";

// Tax rates by state using full state names (in percentage)
const STATE_TAX_RATES = {
    'Alabama': 4.0,
    'Alaska': 0.0,
    'Arizona': 5.6,
    'Arkansas': 6.5,
    'California': 7.25,
    'Colorado': 2.9,
    'Connecticut': 6.35,
    'Delaware': 0.0,
    'Florida': 6.0,
    'Georgia': 4.0,
    'Hawaii': 4.0,
    'Idaho': 6.0,
    'Illinois': 6.25,
    'Indiana': 7.0,
    'Iowa': 6.0,
    'Kansas': 6.5,
    'Kentucky': 6.0,
    'Louisiana': 4.45,
    'Maine': 5.5,
    'Maryland': 6.0,
    'Massachusetts': 6.25,
    'Michigan': 6.0,
    'Minnesota': 6.875,
    'Mississippi': 7.0,
    'Missouri': 4.225,
    'Montana': 0.0,
    'Nebraska': 5.5,
    'Nevada': 6.85,
    'New Hampshire': 0.0,
    'New Jersey': 6.625,
    'New Mexico': 5.125,
    'New York': 4.0,
    'North Carolina': 4.75,
    'North Dakota': 5.0,
    'Ohio': 5.75,
    'Oklahoma': 4.5,
    'Oregon': 0.0,
    'Pennsylvania': 6.0,
    'Rhode Island': 7.0,
    'South Carolina': 6.0,
    'South Dakota': 4.5,
    'Tennessee': 7.0,
    'Texas': 6.25,
    'Utah': 6.1,
    'Vermont': 6.0,
    'Virginia': 5.3,
    'Washington': 6.5,
    'West Virginia': 6.0,
    'Wisconsin': 5.0,
    'Wyoming': 4.0,
    'District of Columbia': 6.0
};

// Default tax rate if state is not found
const DEFAULT_TAX_RATE = 5.0;

// Memoized selectors
const selectCustomerProfile = createSelector(
    state => state.customer.customer,
    customer => customer ? {
        ...customer,
        formattedName: `${customer.firstName} ${customer.lastName}`,
        addresses: customer.addresses?.filter(addr => !addr.isDeleted)
    } : null
);

const selectCustomerAddresses = createSelector(
    state => state.customer.customer,
    customer => customer?.addresses || []
);

// Add the pill toggle styles (same as in NavbarDark.jsx)
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
  color: #fff;
}

.pill-toggle-slider {
  position: absolute;
  left: 3px;
  top: 3px;
  bottom: 3px;
  width: calc(50% - 3px);
  background-color: white;
  border-radius: 30px;
  transition: transform 0.3s, background-color 0.3s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.pill-toggle[data-active="delivery"] .pill-toggle-slider {
  transform: translateX(calc(100% + 0px));
  background-color: white;
}

.pill-toggle[data-active="pickup"] .pill-toggle-slider {
  background-color: white;
}

.pill-toggle.disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: #f0f0f0;
}

.pill-toggle.disabled .pill-toggle-slider {
  background-color: #e0e0e0;
}

/* Override any hover effects from global styles */
.card {
  transform: none !important;
  transition: none !important;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
}

.card:hover {
  transform: none !important;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
}

/* Style address cards without hover effects */
.address-card {
  cursor: pointer;
}
`;

const Cart = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const cartItems = useSelector(state => state.cart.items);
    const cartTotal = useSelector(selectCartTotal);
    const restaurantId = useSelector(state => state.cart.restaurantId);
    const { isCustomerAuthenticated, customer: authCustomer, loading } = useSelector(state => state.auth);
    const customerProfile = useSelector(selectCustomerProfile);
    const customerLoading = useSelector(state => state.customer.loading);
    const { orderStatus, orderError } = useSelector(state => state.order);
    const [error, setError] = useState(null);
    
    // Connect to Redux store for orderPreference
    const orderPreference = useSelector(selectOrderPreference);
    const orderType = orderPreference; // Use the redux state
    
    const [selectedAddressId, setSelectedAddressId] = useState(null);
    const [quoteData, setQuoteData] = useState({
        subtotal: parseFloat(cartTotal || 0),
        taxRate: DEFAULT_TAX_RATE,
        taxAmount: parseFloat((parseFloat(cartTotal || 0) * DEFAULT_TAX_RATE / 100).toFixed(2)),
        deliveryFee: null,
        totalAmount: parseFloat((parseFloat(cartTotal || 0) * (1 + DEFAULT_TAX_RATE / 100)).toFixed(2))
    });
    const [showAddressForm, setShowAddressForm] = useState(false);
    const [addressFormData, setAddressFormData] = useState({
        label: "",
        street: "",
        city: "",
        state: "",
        country: "",
        zipCode: "",
        isPrimary: false
    });
    const [addressFormError, setAddressFormError] = useState("");
    const addresses = useSelector(selectCustomerAddresses);
    const addressLoading = useSelector(state => state.address.loading);
    const [countryInput, setCountryInput] = useState("");
    const [stateInput, setStateInput] = useState("");
    const [cityInput, setCityInput] = useState("");
    
    const [countries, setCountries] = useState([]);
    const [states, setStates] = useState([]);
    const [cities, setCities] = useState([]);
    
    const [countrySuggestions, setCountrySuggestions] = useState([]);
    const [stateSuggestions, setStateSuggestions] = useState([]);
    const [citySuggestions, setCitySuggestions] = useState([]);
    
    const [showCountrySuggestions, setShowCountrySuggestions] = useState(false);
    const [showStateSuggestions, setShowStateSuggestions] = useState(false);
    const [showCitySuggestions, setShowCitySuggestions] = useState(false);
    
    const [loadingStates, setLoadingStates] = useState(false);
    const [loadingCities, setLoadingCities] = useState(false);

    const [restaurant, setRestaurant] = useState({ 
        name: '', 
        address: {}, 
        offersDelivery: true, 
        offersPickup: true 
    });

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

    const [customerNote, setCustomerNote] = useState("");

    const addressScrollContainerRef = useRef(null);
    const [isScrollable, setIsScrollable] = useState(false);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const [dishSizes, setDishSizes] = useState({});

    useEffect(() => {
        if (!loading && !isCustomerAuthenticated) {
            navigate("/customer/login", { state: { signedOut: true } });
        }
    }, [isCustomerAuthenticated, navigate, loading]);

    useEffect(() => {
        dispatch(resetOrderStatus()); // Reset order status when entering cart
    }, [dispatch]);

    // Initialize selected address when customer profile is loaded
    useEffect(() => {
        if (customerProfile?.addresses && customerProfile.addresses.length > 0) {
            // Find primary address or use first address as fallback
            const primaryAddress = customerProfile.addresses.find(addr => addr.isPrimary) || customerProfile.addresses[0];
            setSelectedAddressId(primaryAddress._id);
        }
    }, [customerProfile]);

    // Calculate quote when selected address changes or cart items change
    useEffect(() => {
        if (cartItems.length > 0) {
            updateQuote();
        } else {
            // Reset quote data when cart is empty
            setQuoteData({
                subtotal: 0,
                taxRate: DEFAULT_TAX_RATE,
                taxAmount: 0,
                deliveryFee: null,
                totalAmount: 0
            });
        }
    }, [selectedAddressId, orderType, cartItems, cartTotal, restaurant]);

    // Check order status and redirect after successful order
    useEffect(() => {
        if (orderStatus === 'succeeded') {
            setTimeout(() => {
                dispatch(clearCart()); // Clear the cart
                dispatch(resetOrderStatus());
                navigate('/customer/orders');
            }, 4000);
        }
    }, [orderStatus, navigate, dispatch]);

    // Add an effect to fetch complete customer details including addresses
    useEffect(() => {
        if (isCustomerAuthenticated && authCustomer?.id) {
            // Fetch complete customer data including addresses
            dispatch(fetchCustomer(authCustomer.id));
        }
    }, [dispatch, isCustomerAuthenticated, authCustomer?.id]);

    // Fetch restaurant details
    useEffect(() => {
        if (restaurantId) {
            const fetchRestaurantDetails = async () => {
                try {
                    const response = await axios.get(`/api/restaurants/${restaurantId}`);
                    if (response.data) {
                        setRestaurant(response.data);
                        
                        // If restaurant doesn't offer delivery but offers pickup, default to pickup
                        if (!response.data.offersDelivery && response.data.offersPickup) {
                            dispatch(setOrderPreference('pickup'));
                        }
                        
                        // If restaurant doesn't offer pickup but offers delivery, default to delivery
                        if (!response.data.offersPickup && response.data.offersDelivery) {
                            dispatch(setOrderPreference('delivery'));
                        }
                    }
                } catch (error) {
                    console.error("Error fetching restaurant details:", error);
                }
            };
            
            fetchRestaurantDetails();
        }
    }, [restaurantId, dispatch]);

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

    // Get tax rate for a given state
    const getTaxRate = (state) => {
        if (!state) return DEFAULT_TAX_RATE;
        
        // Check if state is in the dictionary 
        return STATE_TAX_RATES[state] || DEFAULT_TAX_RATE;
    };

    // Calculate quote based on current cart and selected address
    const updateQuote = () => {
        let taxRate = DEFAULT_TAX_RATE;
        
        if (orderType === "delivery" && selectedAddressId) {
            // For delivery, use the customer's delivery address state
            const selectedAddress = customerProfile?.addresses?.find(addr => addr._id === selectedAddressId);
            
            if (selectedAddress?.state) {
                taxRate = getTaxRate(selectedAddress.state);
            }
        } else if (orderType === "pickup" && restaurant?.address?.state) {
            // For pickup, use the restaurant's state
            taxRate = getTaxRate(restaurant.address.state);
        }
        
        const subtotal = parseFloat(cartTotal || 0);
        const taxAmount = parseFloat(((subtotal * taxRate) / 100).toFixed(2));
        
        // Calculate delivery fee if applicable
        let deliveryFee = null;
        if (orderType === "delivery") {
            // Apply $4.49 delivery fee if subtotal is less than $20
            deliveryFee = subtotal >= 20 ? 0 : 4.49;
        }
        
        // Calculate total amount including delivery fee if present
        const totalBeforeFee = parseFloat((subtotal + taxAmount).toFixed(2));
        const totalAmount = deliveryFee !== null ? 
            parseFloat((totalBeforeFee + deliveryFee).toFixed(2)) : 
            totalBeforeFee;
        
        setQuoteData({
            subtotal,
            taxRate,
            taxAmount,
            deliveryFee,
            totalAmount
        });
    };

    const handleQuantityChange = (itemId, newQuantity, selectedSize) => {
        if (newQuantity < 1) {
            dispatch(removeItem({ id: itemId, selectedSize }));
        } else {
            dispatch(updateQuantity({ id: itemId, quantity: newQuantity, selectedSize }));
        }
    };

    const handleRemoveItem = (itemId, selectedSize) => {
        dispatch(removeItem({ id: itemId, selectedSize }));
    };

    const handleOrderTypeChange = (type) => {
        // Only allow changing if both options are available
        if (restaurant.offersDelivery && restaurant.offersPickup) {
            dispatch(setOrderPreference(type));
        }
    };

    const handleAddressSelect = (addressId) => {
        // Find the complete address object
        const selectedAddress = customerProfile?.addresses?.find(addr => addr._id === addressId);
        
        setSelectedAddressId(addressId);
        
        // The quote will be updated automatically via the useEffect hook
    };

    const handlePlaceOrder = () => {
        if (!isCustomerAuthenticated) {
            navigate('/customer/login');
            return;
        }

        if (!authCustomer?.id) {
            setError('Customer information not available');
            return;
        }

        if (!restaurantId) {
            setError('Restaurant information not available');
            return;
        }

        if (!isOpenNow) {
            setError('Restaurant is currently closed');
            return;
        }

        if (orderType === "delivery" && !selectedAddressId) {
            setError('Please select a delivery address');
            return;
        }

        // Format order items for API
        const orderItems = cartItems.map(item => ({
            dishId: item.id,
            sizeId: item.selectedSize?._id || item.sizes?.[0]?._id,
            quantity: item.quantity
        }));

        // Create order payload based on the required format
        const orderData = {
            items: orderItems,
            isDelivery: orderType === "delivery",
            addressId: selectedAddressId,
            customerNote: customerNote.trim(),
            deliveryFee: quoteData.deliveryFee
        };

        console.log('Placing order with data:', orderData);
        dispatch(placeOrder({ restaurantId, orderData }));
    };

    // Helper to format address for display
    const formatAddressForDisplay = (address) => {
        if (!address) return '';
        
        return `${address.street}, ${address.city}, ${address.state} ${address.zipCode}`;
    };

    // Address form handlers
    const handleAddressChange = (e) => {
        const { name, value, type, checked } = e.target;
        // For checkbox inputs, use the checked value
        const newValue = type === 'checkbox' ? checked : value;
        
        setAddressFormData({
            ...addressFormData,
            [name]: newValue
        });
    };
    
    const handleAddAddress = () => {
        setShowAddressForm(true);
        setAddressFormError("");
        
        // Reset form data
        setAddressFormData({
            label: "",
            street: "",
            city: "",
            state: "",
            country: "",
            zipCode: "",
            isPrimary: false
        });
        
        // Reset inputs and suggestions
        setCountryInput("");
        setStateInput("");
        setCityInput("");
        setCountrySuggestions([]);
        setStateSuggestions([]);
        setCitySuggestions([]);
    };
    
    const handleAddressSubmit = (e) => {
        e.preventDefault();
        
        // Clear previous errors
        setAddressFormError("");
        
        // Validate address data
        if (!addressFormData.label || !addressFormData.street || 
            !addressFormData.state || !addressFormData.city || !addressFormData.zipCode) {
            setAddressFormError("Please fill in all address fields");
            return;
        }
        
        // Add new address
        dispatch(addAddress(addressFormData))
            .unwrap()
            .then(() => {
                setShowAddressForm(false);
                setAddressFormError("");
                
                // Refresh customer data to get updated addresses
                if (authCustomer?.id) {
                    dispatch(fetchCustomer(authCustomer.id));
                }
            })
            .catch(error => {
                setAddressFormError(`Failed to add address: ${error}`);
            });
    };
    
    const cancelAddressForm = () => {
        setShowAddressForm(false);
        setAddressFormError("");
    };

    // Location data fetch functions
    const fetchCountries = async () => {
        try {
            const response = await axios.get('/api/location/countries');
            if (response.data) {
                setCountries(response.data);
            }
        } catch (error) {
            console.error("Error fetching countries:", error);
        }
    };
    
    const fetchStates = async (country) => {
        if (!country) return;
        
        try {
            setLoadingStates(true);
            const response = await axios.post('/api/location/states', { country });
            setStates(response.data);
            setStateSuggestions(response.data);
        } catch (error) {
            console.error("Error fetching states:", error);
            setStates([]);
            setStateSuggestions([]);
        } finally {
            setLoadingStates(false);
        }
    };
    
    const fetchCities = async (country, state) => {
        if (!country || !state) return;
        
        try {
            setLoadingCities(true);
            const response = await axios.post('/api/location/cities', { country, state });
            setCities(response.data);
            setCitySuggestions(response.data);
        } catch (error) {
            console.error("Error fetching cities:", error);
            setCities([]);
            setCitySuggestions([]);
        } finally {
            setLoadingCities(false);
        }
    };
    
    // Fetch countries on component mount
    useEffect(() => {
        fetchCountries();
    }, []);
    
    // Country autocomplete handlers
    const handleCountryInputChange = (e) => {
        const value = e.target.value;
        setCountryInput(value);
        
        // Filter countries based on input
        if (value.trim()) {
            const filtered = countries.filter(country => 
                country.toLowerCase().includes(value.toLowerCase())
            );
            setCountrySuggestions(filtered);
            setShowCountrySuggestions(filtered.length > 0);
        } else {
            setCountrySuggestions([]);
            setShowCountrySuggestions(false);
        }
    };
    
    const handleSelectCountry = (country) => {
        setCountryInput(country);
        setAddressFormData({
            ...addressFormData,
            country: country
        });
        setShowCountrySuggestions(false);
        
        // Reset state and city when country changes
        setStateInput("");
        setCityInput("");
        setAddressFormData(prev => ({
            ...prev,
            state: "",
            city: ""
        }));
        
        // Fetch states for selected country
        fetchStates(country);
    };
    
    // State autocomplete handlers
    const handleStateInputChange = (e) => {
        const value = e.target.value;
        setStateInput(value);
        
        // Filter states based on input
        if (value.trim()) {
            const filtered = states.filter(state => 
                state.toLowerCase().includes(value.toLowerCase())
            );
            setStateSuggestions(filtered);
            setShowStateSuggestions(filtered.length > 0);
        } else {
            setStateSuggestions([]);
            setShowStateSuggestions(false);
        }
    };
    
    const handleSelectState = (state) => {
        setStateInput(state);
        setAddressFormData({
            ...addressFormData,
            state: state
        });
        setShowStateSuggestions(false);
        
        // Reset city when state changes
        setCityInput("");
        setAddressFormData(prev => ({
            ...prev,
            city: ""
        }));
        
        // Fetch cities for selected state
        if (addressFormData.country) {
            fetchCities(addressFormData.country, state);
        }
    };
    
    // City autocomplete handlers
    const handleCityInputChange = (e) => {
        const value = e.target.value;
        setCityInput(value);
        
        // Filter cities based on input
        if (value.trim()) {
            const filtered = cities.filter(city => 
                city.toLowerCase().includes(value.toLowerCase())
            );
            setCitySuggestions(filtered);
            setShowCitySuggestions(filtered.length > 0);
        } else {
            setCitySuggestions([]);
            setShowCitySuggestions(false);
        }
    };
    
    const handleSelectCity = (city) => {
        setCityInput(city);
        setAddressFormData({
            ...addressFormData,
            city: city
        });
        setShowCitySuggestions(false);
    };

    // Helper to format restaurant address for display
    const formatRestaurantAddress = () => {
        if (!restaurant || !restaurant.address) return 'Restaurant address unavailable';
        
        const { street, city, state, zipCode } = restaurant.address;
        return `${street}, ${city}, ${state} ${zipCode}`;
    };

    // Check if the address container is scrollable
    const checkScrollability = useCallback(() => {
        if (addressScrollContainerRef.current) {
            const { scrollWidth, clientWidth, scrollLeft } = addressScrollContainerRef.current;
            // Check if content is wider than container
            setIsScrollable(scrollWidth > clientWidth);
            // Check if we can scroll left or right
            setCanScrollLeft(scrollLeft > 0);
            setCanScrollRight(scrollLeft < scrollWidth - clientWidth);
        }
    }, []);
    
    // Handle horizontal scrolling of addresses
    const handleScroll = (direction) => {
        if (addressScrollContainerRef.current) {
            const scrollAmount = 250; // Width of an address card + gap
            const currentScroll = addressScrollContainerRef.current.scrollLeft;
            
            addressScrollContainerRef.current.scrollTo({
                left: direction === 'left' ? currentScroll - scrollAmount : currentScroll + scrollAmount,
                behavior: 'smooth'
            });
        }
    };
    
    // Update scroll status on address changes and window resize
    useEffect(() => {
        checkScrollability();
        
        const handleResize = () => {
            checkScrollability();
        };
        
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [addresses, checkScrollability]);
    
    // Add scroll event listener to track scroll position
    useEffect(() => {
        const scrollContainer = addressScrollContainerRef.current;
        if (scrollContainer) {
            const handleScrollEvent = () => {
                const { scrollWidth, clientWidth, scrollLeft } = scrollContainer;
                setCanScrollLeft(scrollLeft > 1); // Small buffer for precision
                setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1); // Small buffer for precision
            };
            
            scrollContainer.addEventListener('scroll', handleScrollEvent);
            return () => {
                scrollContainer.removeEventListener('scroll', handleScrollEvent);
            };
        }
    }, []);

    // Add useEffect to fetch complete dish data with all available sizes
    useEffect(() => {
        const fetchFullDishData = async () => {
            if (!restaurantId || cartItems.length === 0) return;
            
            try {
                const response = await axios.get(`/api/restaurants/${restaurantId}`);
                if (!response.data || !response.data.dishes) return;
                
                const allDishes = response.data.dishes;
                const dishSizesMap = {};
                
                // Create a map of dish ID to its available sizes
                cartItems.forEach(item => {
                    const fullDish = allDishes.find(dish => dish.id === item.id || dish._id === item.id);
                    if (fullDish && fullDish.sizes && fullDish.sizes.length > 1) {
                        dishSizesMap[item.id] = fullDish.sizes;
                    }
                    
                    // Ensure item.category is an array, not a string
                    if (item.category && typeof item.category === 'string') {
                        // If the category is a string that looks like an array in string form
                        if (item.category.includes('[') && item.category.includes(']')) {
                            try {
                                // Convert string representation of array to actual array
                                const categoryArray = JSON.parse(item.category.replace(/'/g, '"'));
                                // Modify the item in the Redux store to ensure category is an array
                                dispatch(updateCartItemCategory({ 
                                    id: item.id, 
                                    category: Array.isArray(categoryArray) ? categoryArray : [categoryArray]
                                }));
                            } catch (e) {
                                // If parsing fails, use the string as a single element in an array
                                dispatch(updateCartItemCategory({ 
                                    id: item.id, 
                                    category: [item.category]
                                }));
                            }
                        } else {
                            // If it's just a plain string, convert to array with single element
                            dispatch(updateCartItemCategory({ 
                                id: item.id, 
                                category: [item.category]
                            }));
                        }
                    }
                });
                
                setDishSizes(dishSizesMap);
            } catch (error) {
                console.error("Error fetching complete dish data:", error);
            }
        };
        
        fetchFullDishData();
    }, [restaurantId, cartItems, dispatch]);
    
    // Add a handler for size change
    const handleSizeChange = (itemId, newSizeId) => {
        if (!dishSizes[itemId]) return;
        
        const newSize = dishSizes[itemId].find(size => size._id === newSizeId || size.id === newSizeId);
        if (!newSize) return;
        
        dispatch(updateItemSize({ 
            id: itemId, 
            selectedSize: newSize 
        }));
    };

    if (orderStatus === 'succeeded') {
        return (
            <>
                <NavbarDark />
                <div className="container mt-5 text-center">
                    <div className="alert alert-success rounded-4">
                        <h4>Order placed successfully!</h4>
                        <p>You will be redirected to your orders shortly...</p>
                    </div>
                </div>
            </>
        );
    }

    if (cartItems.length === 0) {
        return (
            <>
                <NavbarDark />
                <div className="container mt-5 text-center">
                    <h2 className="mb-4"><i className="bi bi-exclamation-circle"></i> Your Cart is Empty</h2>
                    <div className="d-flex justify-content-center">
                        <Link to="/restaurants" className="text-dark fw-medium" style={{ textDecoration: 'underline' }}>
                        Browse Restaurants
                    </Link>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <style>{toggleStyles}</style>
            <NavbarDark />
            <Link to="/restaurants" className="btn text-dark border-0 d-flex align-items-center mt-3 ms-5 fw-bold">
                ←<u>Continue Shopping</u>
            </Link>
            <div className="container mt-4">
                <div className="d-flex align-items-center justify-content-between mb-4">
                    <h2 className="mb-0 fw-bold">Your Cart</h2>
                </div>
                
                {(error || orderError) && 
                    <div className="alert alert-danger rounded-4 mb-4">
                        {error || orderError}
                    </div>
                }
                
                <div className="row g-4">
                    <div className="col-md-8">
                        <div className="card rounded-4 shadow-sm border-2 border-light mb-4" style={{ transform: 'none !important', transition: 'none !important' }}>
                    <div className="card-body">
                                <h5 className="fw-bold mb-3">Contents</h5>
                                {cartItems.map((item, index) => (
                                    <div key={`${item.id}-${item.selectedSize ? (item.selectedSize._id || item.selectedSize.id || item.selectedSize.size) : 'default'}`} className={`mx-3 mt-3`}>
                                        <div className="row align-items-center">
                                            <div className="col-md-2">
                                <img 
                                    src={item.imageUrl ? item.imageUrl : DEFAULT_IMAGE_PLACEHOLDER}
                                    alt={item.name}
                                                    style={{ width: '80px', height: '80px', objectFit: 'cover' }}
                                                    className="rounded-3"
                                                />
                                            </div>
                                            <div className="col-md-5">
                                                <h5 className="mb-1">{item.name}</h5>
                                                {dishSizes[item.id] && dishSizes[item.id].length > 1 ? (
                                                    <div className="mb-2">
                                                        <select 
                                                            className="form-select form-select-sm rounded-pill bg-light"
                                                            value={item.selectedSize?._id || item.selectedSize?.id || item.sizes?.[0]?._id || item.sizes?.[0]?.id}
                                                            onChange={(e) => handleSizeChange(item.id, e.target.value)}
                                                            style={{ 
                                                                width: "auto",
                                                                border: "1px solid #dee2e6",
                                                                boxShadow: "none",
                                                                padding: "0.25rem 1.5rem 0.25rem 0.5rem",
                                                                cursor: "pointer",
                                                                display: "inline-block"
                                                            }}
                                                        >
                                                            {dishSizes[item.id].map(size => (
                                                                <option key={size._id || size.id} value={size._id || size.id}>
                                                                    {size.size} (${parseFloat(size.price).toFixed(2)})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                ) : (
                                                    <p className="mb-1 text-muted small">
                                                        {item.selectedSize ? item.selectedSize.size : item.sizes?.[0]?.size}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="col-md-3">
                                                <div className="d-flex align-items-center">
                                                    <select 
                                                        className="form-select rounded-pill bg-light"
                                                        value={item.quantity}
                                                        onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value), item.selectedSize)}
                                                        style={{ 
                                                            width: "80px",
                                                            border: "1px solid #dee2e6",
                                                            boxShadow: "none",
                                                            padding: "0.375rem 1.75rem 0.375rem 0.75rem",
                                                            cursor: "pointer"
                                                        }}
                                                        aria-label="Change quantity"
                                                    >
                                                        {[...Array(99)].map((_, i) => (
                                                            <option key={i} value={i + 1}>{i + 1}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="col-md-2 d-flex align-items-center justify-content-end">
                                                <div className="d-flex flex-column align-items-center">
                                                    <span className="fw-bold mb-2">${(parseFloat(item.selectedSize?.price || item.price) * item.quantity).toFixed(2)}</span>
                                        <button 
                                                        className="btn btn-outline-danger rounded-circle d-flex align-items-center justify-content-center p-0"
                                                        style={{ width: "32px", height: "32px" }}
                                            onClick={() => handleRemoveItem(item.id, item.selectedSize)}
                                                        aria-label="Remove item"
                                        >
                                                        <i className="bi bi-trash"></i>
                                        </button>
                                    </div>
                                </div>
                                </div>
                                    </div>
                                ))}

                                {/* Delivery Address Section - Only show for delivery orders */}
                                {orderType === "delivery" && (
                                    <>
                                        <div className="mt-5 address-section pt-2">
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <h5 className="fw-bold mb-0">Saved Addresses</h5>
                                        <button 
                                                    className="btn btn-outline-dark btn-sm rounded-5"
                                                    onClick={handleAddAddress}
                                                    title="Add new address"
                                        >
                                                    <i className="bi bi-plus-lg"></i> Add New Address
                                        </button>
                                </div>
                                            
                                            {addresses && addresses.length > 0 ? (
                                                <div className="position-relative">
                                                    {/* Left arrow navigation button - only visible when scrollable and can scroll left */}
                                                    {isScrollable && canScrollLeft && (
                                        <button 
                                                            className="btn btn-light border position-absolute top-50 start-0 translate-middle-y rounded-circle p-1 z-2 shadow-sm"
                                                            style={{ width: "32px", height: "32px" }}
                                                            onClick={() => handleScroll('left')}
                                        >
                                                            <i className="bi bi-chevron-left"></i>
                                        </button>
                                                    )}
                                                    
                                                    {/* Right arrow navigation button - only visible when scrollable and can scroll right */}
                                                    {isScrollable && canScrollRight && (
                                        <button 
                                                            className="btn btn-light border position-absolute top-50 end-0 translate-middle-y rounded-circle p-1 z-2 shadow-sm"
                                                            style={{ width: "32px", height: "32px" }}
                                                            onClick={() => handleScroll('right')}
                                        >
                                                            <i className="bi bi-chevron-right"></i>
                                        </button>
                                                    )}
                                                    
                                                    {isScrollable && canScrollLeft && (
                                                        <div 
                                                            className="position-absolute h-100 d-flex align-items-center" 
                                                            style={{
                                                            left: 0,
                                                            top: 0,
                                                            width: '40px',
                                                            background: 'linear-gradient(to right, white, transparent)',
                                                            zIndex: 1,
                                                            pointerEvents: 'none'
                                                        }}
                                                    ></div>
                                                    )}
                                                    
                                                    <div 
                                                        ref={addressScrollContainerRef}
                                                        className="d-flex mx-3 flex-nowrap overflow-auto pb-2" 
                                                        style={{ gap: "1rem" }}
                                                        onScroll={checkScrollability}
                                                    >
                                                        {/* Sort addresses to ensure primary address is first */}
                                                        {[...addresses]
                                                            .sort((a, b) => (a.isPrimary ? -1 : 0) - (b.isPrimary ? -1 : 0))
                                                            .map(address => (
                                                            <div
                                                                key={address._id}
                                                                className={`address-card px-3 py-2 rounded-3`}
                                                                style={{ 
                                                                    minWidth: "200px",
                                                                    maxWidth: "220px",
                                                                    cursor: "pointer",
                                                                    border: selectedAddressId === address._id ? "2px solid black" : "1px solid #dee2e6",
                                                                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                                                                }}
                                                                onClick={() => handleAddressSelect(address._id)}
                                                            >
                                                                <div className="d-flex justify-content-between align-items-center mb-2">
                                                                    <span className="fw-bold">{address.label}</span>
                                                                    {address.isPrimary && (
                                                                        <span className="badge bg-dark rounded-pill">Primary</span>
                                                                    )}
                                    </div>
                                                                <p className="mb-0 small">{formatAddressForDisplay(address)}</p>
                                </div>
                                                        ))}
                                </div>
                                                    
                                                    {isScrollable && canScrollRight && (
                                                        <div 
                                                            className="position-absolute h-100 d-flex align-items-center" 
                                                        style={{
                                                            right: 0,
                                                            top: 0,
                                                            width: '40px',
                                                            background: 'linear-gradient(to left, white, transparent)',
                                                            zIndex: 1,
                                                            pointerEvents: 'none'
                                                        }}
                                                        ></div>
                                                    )}
                            </div>
                                            ) : (
                                                <div className="alert alert-warning">
                                                    {customerLoading ? (
                                                        <span>Loading addresses...</span>
                                                    ) : (
                                                        <span>No delivery addresses found. Please add an address using the plus icon above.</span>
                                                    )}
                    </div>
                                            )}
                                </div>
                                    </>
                                )}
                                
                                {/* Additional Notes Section */}
                                <div className="mt-5">
                                    <h5 className="fw-bold mb-3">Additional Notes</h5>
                                    <textarea
                                        className="mx-3 w-75 form-control"
                                        rows="3"
                                        placeholder="Special instructions for your order (optional)"
                                        value={customerNote}
                                        onChange={(e) => setCustomerNote(e.target.value)}
                                        maxLength="180"
                                    ></textarea>
                                    <div className="text-end text-muted small mt-1">
                                        {customerNote.length}/200
                                </div>
                            </div>
                            </div>
                        </div>
                    </div>
                    
                            <div className="col-md-4">
                        <div className="card rounded-4 shadow-sm border-2 py-2 border-light" style={{ transform: 'none !important', transition: 'none !important' }}>
                            <div className="card-body p-4">
                                <h5 className="fw-bold mb-3">Order Summary</h5>
                                <div className="mb-4">
                                    {/* Replace the checkbox toggle with pill toggle */}
                                    <div className="d-flex mb-3">
                                        <div 
                                            className={`pill-toggle ${(!restaurant.offersDelivery || !restaurant.offersPickup) ? 'disabled' : ''}`} 
                                            data-active={orderType}
                                            onClick={() => {
                                                if (restaurant.offersDelivery && restaurant.offersPickup) {
                                                    handleOrderTypeChange(orderType === "delivery" ? "pickup" : "delivery");
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
                                            <div className={`pill-toggle-option ${orderType === "pickup" ? "active" : ""}`}>
                                                Pickup
                                            </div>
                                            <div className={`pill-toggle-option ${orderType === "delivery" ? "active" : ""}`}>
                                                Delivery
                                            </div>
                                            <div className="pill-toggle-slider"></div>
                                        </div>
                                    </div>
                                    
                                    {/* Display the delivery address or pickup location */}
                                    <div className="text-muted fst-italic mt-2 small">
                                        {orderType === "delivery" && selectedAddressId ? (
                                            <div>
                                                <i className="bi bi-geo-alt me-1"></i>
                                                Delivering to: {formatAddressForDisplay(customerProfile?.addresses?.find(addr => addr._id === selectedAddressId))}
                                            </div>
                                        ) : orderType === "pickup" ? (
                                            <div>
                                                <i className="bi bi-building me-1"></i>
                                                Pickup from: {formatRestaurantAddress()}
                                            </div>
                                        ) : (
                                            <div className="text-danger">
                                                <i className="bi bi-exclamation-circle me-1"></i>
                                                Please select a delivery address
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <hr />
                                
                                <div className="d-flex justify-content-between mb-2">
                                    <span>Subtotal</span>
                                    <span>${(parseFloat(quoteData.subtotal) || 0).toFixed(2)}</span>
                                </div>
                                <div className="d-flex justify-content-between mb-2">
                                    <span>Tax ({parseFloat(quoteData.taxRate) || DEFAULT_TAX_RATE}%)</span>
                                    <span>${(parseFloat(quoteData.taxAmount) || 0).toFixed(2)}</span>
                                </div>
                                {quoteData.deliveryFee !== null && (
                                    <div className="d-flex justify-content-between mb-2">
                                        <span>
                                            Delivery Fee
                                            {quoteData.deliveryFee === 0 && (
                                                <span className="badge bg-success ms-2 small">FREE</span>
                                            )}
                                        </span>
                                        <span>${quoteData.deliveryFee.toFixed(2)}</span>
                                    </div>
                                )}
                                
                                <hr />
                                
                                <div className="d-flex justify-content-between mb-4">
                                    <h5 className="fw-bold">Total</h5>
                                    <h5 className="fw-bold">${(parseFloat(quoteData.totalAmount) || 0).toFixed(2)}</h5>
                                </div>
                                {!isOpenNow ? (
                                    <div className="text-danger fst-italic mb-1">
                                        Restaurant is closed
                                    </div> 
                                ) : (<></>)}
                                    <button 
                                        className="btn btn-dark w-100 py-2 rounded-pill"
                                        onClick={handlePlaceOrder}
                                    disabled={orderStatus === 'loading' || !isOpenNow}
                                >
                                    {orderStatus === 'loading' ? 
                                        <span>
                                            <span className="spinner-border spinner-border-sm text-light me-2" role="status" aria-hidden="true"></span>
                                            Processing...
                                        </span> : 
                                        'Place Order'
                                    }
                                </button>
    
                                {!isCustomerAuthenticated && (
                                    <div className="alert alert-danger mt-3 mb-0 py-2 text-center">
                                        You need to log in to place an order
                                    </div>
                                )}
                            </div>
                            </div>
                        </div>
                    </div>
                </div>
                
            {/* Address Modal */}
            {showAddressForm && (
                <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content rounded-4 px-3 py-1">
                            <div className="modal-header">
                                <h5 className="modal-title fw-semibold">Add New Address</h5>
                                <button type="button" className="btn-close" onClick={cancelAddressForm}></button>
                            </div>
                            <div className="modal-body my-1">
                                {/* Display form error if any */}
                                {addressFormError && (
                                    <div className="alert alert-danger">{addressFormError}</div>
                                )}
                                
                                <form onSubmit={handleAddressSubmit}>
                                    <div className="row">
                                        <div className="col-md-6">
                                            <div className="mb-3">
                                                <label htmlFor="label">Address Label <span className="text-danger">*</span></label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    id="label"
                                                    name="label"
                                                    value={addressFormData.label}
                                                    onChange={handleAddressChange}
                                                    placeholder="Home, Work, etc."
                                                    required
                                                />
                                            </div>
                                            <div className="mb-3">
                                                <label htmlFor="street">Street Address <span className="text-danger">*</span></label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    id="street"
                                                    name="street"
                                                    value={addressFormData.street}
                                                    onChange={handleAddressChange}
                                                    required
                                                />
                                            </div>
                                            
                                            {/* Country Autocomplete */}
                                            <div className="mb-3">
                                                <label htmlFor="country">Country <span className="text-danger">*</span></label>
                                                <div className="position-relative">
                                                    <input 
                                                        type="text" 
                                                        className="form-control"
                                                        name="country" 
                                                        value={countryInput}
                                                        onChange={handleCountryInputChange}
                                                        onFocus={() => {
                                                            if (countries.length > 0 && countryInput) {
                                                                setShowCountrySuggestions(true);
                                                            }
                                                        }}
                                                        onBlur={() => {
                                                            // Delay hiding suggestions to allow clicking on them
                                                            setTimeout(() => {
                                                                setShowCountrySuggestions(false);
                                                            }, 200);
                                                        }}
                                                        placeholder="Start typing a country name..."
                                                        required 
                                                    />
                                                    
                                                    {/* Country Suggestions Dropdown */}
                                                    {showCountrySuggestions && countrySuggestions.length > 0 && (
                                                        <div className="position-absolute w-100 mt-1 shadow-sm bg-white border rounded-2" 
                                                            style={{ maxHeight: '200px', overflowY: 'auto', zIndex: 1000 }}
                                                        >
                                                            {countrySuggestions.map((country, index) => (
                                                                <div 
                                                                    key={index} 
                                                                    className="px-3 py-2" 
                                                                    style={{ cursor: 'pointer' }}
                                                                    onMouseDown={() => handleSelectCountry(country)}
                                                                    onMouseOver={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                                                                    onMouseOut={(e) => e.target.style.backgroundColor = ''}
                                                                >
                                                                    {country}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            {/* State Autocomplete */}
                                            <div className="mb-3">
                                                <label htmlFor="state">State <span className="text-danger">*</span></label>
                                                <div className="position-relative">
                                                    <input 
                                                        type="text" 
                                                        className="form-control"
                                                        name="state" 
                                                        value={stateInput}
                                                        onChange={handleStateInputChange}
                                                        onFocus={() => {
                                                            if (states.length > 0 && stateInput) {
                                                                setShowStateSuggestions(true);
                                                            }
                                                        }}
                                                        onBlur={() => {
                                                            setTimeout(() => {
                                                                setShowStateSuggestions(false);
                                                            }, 200);
                                                        }}
                                                        placeholder={addressFormData.country ? "Start typing a state name..." : "Select a country first"}
                                                        required 
                                                        disabled={!addressFormData.country || loadingStates}
                                                    />
                                                    {loadingStates && (
                                                        <div className="position-absolute" style={{ right: '10px', top: '10px' }}>
                                                            <span className="spinner-border spinner-border-sm text-success" role="status"></span>
                                                        </div>
                                                    )}
                                                    
                                                    {/* State Suggestions Dropdown */}
                                                    {showStateSuggestions && stateSuggestions.length > 0 && (
                                                        <div className="position-absolute w-100 mt-1 shadow-sm bg-white border rounded-2" 
                                                            style={{ maxHeight: '200px', overflowY: 'auto', zIndex: 1000 }}
                                                        >
                                                            {stateSuggestions.map((state, index) => (
                                                                <div 
                                                                    key={index} 
                                                                    className="px-3 py-2" 
                                                                    style={{ cursor: 'pointer' }}
                                                                    onMouseDown={() => handleSelectState(state)}
                                                                    onMouseOver={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                                                                    onMouseOut={(e) => e.target.style.backgroundColor = ''}
                                                                >
                                                                    {state}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* City Autocomplete */}
                                            <div className="mb-3">
                                                <label htmlFor="city">City <span className="text-danger">*</span></label>
                                                <div className="position-relative">
                                                    <input 
                                                        type="text" 
                                                        className="form-control"
                                                        name="city" 
                                                        value={cityInput}
                                                        onChange={handleCityInputChange}
                                                        onFocus={() => {
                                                            if (cities.length > 0 && cityInput) {
                                                                setShowCitySuggestions(true);
                                                            }
                                                        }}
                                                        onBlur={() => {
                                                            setTimeout(() => {
                                                                setShowCitySuggestions(false);
                                                            }, 200);
                                                        }}
                                                        placeholder={addressFormData.state ? "Start typing a city name..." : "Select a state first"}
                                                        required 
                                                        disabled={!addressFormData.state || loadingCities}
                                                    />
                                                    {loadingCities && (
                                                        <div className="position-absolute" style={{ right: '10px', top: '10px' }}>
                                                            <span className="spinner-border spinner-border-sm text-success" role="status"></span>
                                                        </div>
                                                    )}
                                                    
                                                    {/* City Suggestions Dropdown */}
                                                    {showCitySuggestions && citySuggestions.length > 0 && (
                                                        <div className="position-absolute w-100 mt-1 shadow-sm bg-white border rounded-2" 
                                                            style={{ maxHeight: '200px', overflowY: 'auto', zIndex: 1000 }}
                                                        >
                                                            {citySuggestions.map((city, index) => (
                                                                <div 
                                                                    key={index} 
                                                                    className="px-3 py-2" 
                                                                    style={{ cursor: 'pointer' }}
                                                                    onMouseDown={() => handleSelectCity(city)}
                                                                    onMouseOver={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                                                                    onMouseOut={(e) => e.target.style.backgroundColor = ''}
                                                                >
                                                                    {city}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className="mb-3">
                                                <label htmlFor="zipCode">ZIP Code <span className="text-danger">*</span></label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    id="zipCode"
                                                    name="zipCode"
                                                    value={addressFormData.zipCode}
                                                    onChange={handleAddressChange}
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mb-3">
                                        <div className="form-check">
                                            <input
                                                type="checkbox"
                                                className="form-check-input"
                                                id="isPrimary"
                                                name="isPrimary"
                                                checked={addressFormData.isPrimary}
                                                onChange={handleAddressChange}
                                            />
                                            <label className="form-check-label" htmlFor="isPrimary">
                                                Set as Primary Address
                                            </label>
                                        </div>
                                    </div>
                                    <div className="d-flex justify-content-end gap-2 mt-4">
                                        <button 
                                            type="button" 
                                            className="btn btn-outline-secondary rounded-pill" 
                                            onClick={cancelAddressForm}
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            type="submit" 
                                            className="btn btn-dark rounded-pill"
                                            disabled={addressLoading}
                                        >
                                            {addressLoading ? (
                                                <>
                                                    <span className="spinner-border spinner-border-sm me-2 text-success" role="status" aria-hidden="true"></span>
                                                    Saving...
                                                </>
                                            ) : "Save Address"}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Cart;
