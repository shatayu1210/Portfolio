import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import "bootstrap/dist/css/bootstrap.min.css";
import axios from "../../config/axios";
import { useDispatch, useSelector } from "react-redux";
import { createRestaurant } from "../../redux/slices/restaurant/restaurantSlice";
import NavbarDark from "../Common/NavbarDark";
import Card from 'react-bootstrap/Card'; // Bootstrap Card for consistent form styling
import { validateEmail, validatePhone, validateName } from "../../utils/validation";

const RestaurantSignup = () => {
    const [restaurant, setRestaurant] = useState({
        name: "",
        email: "",
        password: "",
        description: "",
        phone: "",
        address: {
            street: "",
            city: "",
            state: "",
            country: "",
            zipCode: ""
        },
        imageUrl: null,
        operatingHours: {
            monday: { open: "09:00", close: "21:00", isClosed: false },
            tuesday: { open: "09:00", close: "21:00", isClosed: false },
            wednesday: { open: "09:00", close: "21:00", isClosed: false },
            thursday: { open: "09:00", close: "21:00", isClosed: false },
            friday: { open: "09:00", close: "21:00", isClosed: false },
            saturday: { open: "09:00", close: "21:00", isClosed: false },
            sunday: { open: "09:00", close: "21:00", isClosed: false }
        },
        offersDelivery: true,
        offersPickup: true,
        cuisine: [],
        priceRange: "$"
    });

    // Location data states
    const [countries, setCountries] = useState([]);
    const [states, setStates] = useState([]);
    const [cities, setCities] = useState([]);
    
    // Autocomplete states
    const [countryInput, setCountryInput] = useState("");
    const [stateInput, setStateInput] = useState("");
    const [cityInput, setCityInput] = useState("");
    
    // Filtered suggestions states
    const [countrySuggestions, setCountrySuggestions] = useState([]);
    const [stateSuggestions, setStateSuggestions] = useState([]);
    const [citySuggestions, setCitySuggestions] = useState([]);
    
    // Show suggestions states
    const [showCountrySuggestions, setShowCountrySuggestions] = useState(false);
    const [showStateSuggestions, setShowStateSuggestions] = useState(false);
    const [showCitySuggestions, setShowCitySuggestions] = useState(false);
    
    // Loading states
    const [loadingStates, setLoadingStates] = useState(false);
    const [loadingCities, setLoadingCities] = useState(false);

    const [validationErrors, setValidationErrors] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        description: '',
        street: '',
        city: '',
        state: '',
        country: '',
        zipCode: ''
    });

    const [passwordCriteria, setPasswordCriteria] = useState({
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        special: false
    });

    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { loading: restaurantLoading, error } = useSelector((state) => state.restaurant);

    const fileInputRef = useRef(null);
    const [previewImage, setPreviewImage] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);

    // Add new state for image upload error
    const [imageUploadError, setImageUploadError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch countries on component mount
    useEffect(() => {
        fetchCountries();
        // Set a small delay to make sure countries are loaded before fetching states
        setTimeout(() => {
            if (restaurant.address.country) {
                fetchStates(restaurant.address.country);
            }
        }, 500);
    }, []);

    // Fetch countries
    const fetchCountries = async () => {
        try {
            const response = await axios.get('/api/location/countries');
            setCountries(response.data);
        } catch (error) {
            console.error('Error fetching countries:', error);
        }
    };

    // Fetch states for selected country
    const fetchStates = async (country) => {
        if (!country) return;
        
        try {
            setLoadingStates(true);
            const response = await axios.post('/api/location/states', { country });
            setStates(response.data);
            setStateSuggestions(response.data);
        } catch (error) {
            console.error('Error fetching states:', error);
            setStates([]);
            setStateSuggestions([]);
        } finally {
            setLoadingStates(false);
        }
    };

    // Fetch cities for selected state and country
    const fetchCities = async (country, state) => {
        if (!country || !state) return;
        
        try {
            setLoadingCities(true);
            const response = await axios.post('/api/location/cities', { country, state });
            setCities(response.data);
            setCitySuggestions(response.data);
        } catch (error) {
            console.error('Error fetching cities:', error);
            setCities([]);
            setCitySuggestions([]);
        } finally {
            setLoadingCities(false);
        }
    };

    // Handle country input change
    const handleCountryInputChange = (e) => {
        const value = e.target.value;
        setCountryInput(value);
        
        // Filter countries based on input
        if (value.trim()) {
            const filtered = countries.filter(country => 
                country.toLowerCase().includes(value.toLowerCase())
            );
            setCountrySuggestions(filtered);
            setShowCountrySuggestions(true);
        } else {
            setCountrySuggestions([]);
            setShowCountrySuggestions(false);
        }
        
        // Update validation
        setValidationErrors(prev => ({
            ...prev,
            country: value.trim() ? "" : "Country is required"
        }));
    };

    // Handle country selection from suggestions
    const handleSelectCountry = (country) => {
        setCountryInput(country);
        setShowCountrySuggestions(false);
        
        // Update the restaurant address with selected country
        setRestaurant({
            ...restaurant,
            address: {
                ...restaurant.address,
                country: country
            }
        });
        
        // Reset state and city when country changes
        setStateInput('');
        setCityInput('');
        setStates([]);
        setCities([]);
        
        // Fetch states for the selected country
        fetchStates(country);
    };

    // Handle state input change
    const handleStateInputChange = (e) => {
        const value = e.target.value;
        setStateInput(value);
        
        // Filter states based on input
        if (value.trim()) {
            const filtered = states.filter(state => 
                state.toLowerCase().includes(value.toLowerCase())
            );
            setStateSuggestions(filtered);
            setShowStateSuggestions(true);
        } else {
            setStateSuggestions([]);
            setShowStateSuggestions(false);
        }
        
        // Update validation
        setValidationErrors(prev => ({
            ...prev,
            state: value.trim() ? "" : "State is required"
        }));
    };

    // Handle state selection from suggestions
    const handleSelectState = (state) => {
        setStateInput(state);
        setShowStateSuggestions(false);
        
        // Update the restaurant address with selected state
        setRestaurant({
            ...restaurant,
            address: {
                ...restaurant.address,
                state: state
            }
        });
        
        // Reset city when state changes
        setCityInput('');
        setCities([]);
        
        // Fetch cities for the selected country and state
        fetchCities(restaurant.address.country, state);
    };

    // Handle city input change
    const handleCityInputChange = (e) => {
        const value = e.target.value;
        setCityInput(value);
        
        // Filter cities based on input
        if (value.trim()) {
            const filtered = cities.filter(city => 
                city.toLowerCase().includes(value.toLowerCase())
            );
            setCitySuggestions(filtered);
            setShowCitySuggestions(true);
        } else {
            setCitySuggestions([]);
            setShowCitySuggestions(false);
        }
        
        // Update validation
        setValidationErrors(prev => ({
            ...prev,
            city: value.trim() ? "" : "City is required"
        }));
    };

    // Handle city selection from suggestions
    const handleSelectCity = (city) => {
        setCityInput(city);
        setShowCitySuggestions(false);
        
        // Update the restaurant address with selected city
        setRestaurant({
            ...restaurant,
            address: {
                ...restaurant.address,
                city: city
            }
        });
    };

    const validatePassword = (password) => {
        // Match backend validation
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        const isLongEnough = password && password.length >= 6;
        
        setPasswordCriteria({
            length: isLongEnough,
            uppercase: hasUpperCase,
            lowercase: hasLowerCase,
            number: hasNumber,
            special: hasSpecialChar
        });
        
        // All criteria must be met
        return isLongEnough && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        
        // Handle nested properties
        if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setRestaurant({
                ...restaurant,
                [parent]: {
                    ...restaurant[parent],
                    [child]: value
                }
            });
            
            // Validate address fields
            if (parent === 'address') {
                setValidationErrors(prev => ({
                    ...prev,
                    [child]: value.trim() ? "" : `${child.charAt(0).toUpperCase() + child.slice(1)} is required`
                }));
            }
        } else {
            setRestaurant({ ...restaurant, [name]: value });
            
            // Live validation
            if (name === 'email') {
                setValidationErrors(prev => ({
                    ...prev,
                    email: validateEmail(value) ? "" : "Please enter a valid email address"
                }));
            } else if (name === 'phone') {
                // Only allow digits and + at the start
                const sanitizedValue = value.replace(/[^\d+]/g, '');
                if (sanitizedValue !== value) {
                    // If the value was sanitized, update the input
                    setRestaurant(prev => ({ ...prev, phone: sanitizedValue }));
                }
                setValidationErrors(prev => ({
                    ...prev,
                    phone: validatePhone(sanitizedValue) ? "" : "Please enter a valid phone number (10-15 digits, optional + prefix)"
                }));
            } else if (name === 'password') {
                validatePassword(value);
                setValidationErrors(prev => ({
                    ...prev,
                    password: validatePassword(value) ? "" : "Password does not meet requirements"
                }));
            } else if (name === 'name') {
                setValidationErrors(prev => ({
                    ...prev,
                    name: value.trim() ? "" : "Restaurant name is required"
                }));
            } else if (name === 'description') {
                setValidationErrors(prev => ({
                    ...prev,
                    description: value.trim() ? "" : "Description is required"
                }));
            }
        }
    };

    // Handle File Upload
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
    
        // Create preview URL
        const previewUrl = URL.createObjectURL(file);
        setPreviewImage(previewUrl);
        setSelectedFile(file);  // Store the file for later upload
    };

    const handleImageClick = () => {
        fileInputRef.current?.click();
    };

    const handleRemoveImage = (e) => {
        e.stopPropagation();
        setPreviewImage(null);
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Operating hours handling
    const handleHoursChange = (day, field, value) => {
        setRestaurant({
            ...restaurant,
            operatingHours: {
                ...restaurant.operatingHours,
                [day]: {
                    ...restaurant.operatingHours[day],
                    [field]: value
                }
            }
        });
    };

    // Toggle checkbox for offers
    const handleCheckboxChange = (e) => {
        const { name, checked } = e.target;
        setRestaurant({ ...restaurant, [name]: checked });
    };

    // Toggle isClosed for a day
    const handleClosedDayChange = (day, checked) => {
        setRestaurant({
            ...restaurant,
            operatingHours: {
                ...restaurant.operatingHours,
                [day]: checked
                    ? { open: '', close: '', isClosed: true }
                    : { ...restaurant.operatingHours[day], isClosed: false }
            }
        });
    };

    // Handle price range change
    const handlePriceRangeChange = (value) => {
        setRestaurant({
            ...restaurant,
            priceRange: value
        });
    };

    // Updated handleSubmit function with image being optional
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        setImageUploadError(""); // Clear previous errors
        setIsSubmitting(true);
        
        // Validate all fields before submission
        let isValid = true;
        const newValidationErrors = { ...validationErrors };
        
        // Basic validation
        if (!validateEmail(restaurant.email)) {
            newValidationErrors.email = "Please enter a valid email address";
            isValid = false;
        }
        
        if (!validatePhone(restaurant.phone)) {
            newValidationErrors.phone = "Please enter a valid phone number";
            isValid = false;
        }
        
        if (!restaurant.name.trim()) {
            newValidationErrors.name = "Restaurant name is required";
            isValid = false;
        }
        
        if (!restaurant.description.trim()) {
            newValidationErrors.description = "Description is required";
            isValid = false;
        }
        
        if (!validatePassword(restaurant.password)) {
            newValidationErrors.password = "Password does not meet requirements";
            isValid = false;
        }
        
        // Address validation
        if (!restaurant.address.street.trim()) {
            newValidationErrors.street = "Street address is required";
            isValid = false;
        }
        
        if (!restaurant.address.city.trim()) {
            newValidationErrors.city = "City is required";
            isValid = false;
        }
        
        if (!restaurant.address.state.trim()) {
            newValidationErrors.state = "State is required";
            isValid = false;
        }
        
        if (!restaurant.address.zipCode.trim()) {
            newValidationErrors.zipCode = "ZIP code is required";
            isValid = false;
        }
        
        if (!isValid) {
            setValidationErrors(newValidationErrors);
            setIsSubmitting(false);
            return;
        }
        
        try {
            // Upload image if selected (now optional)
            let imageUrl = null;
            
            if (selectedFile) {
                const formData = new FormData();
                formData.append("image", selectedFile);
                
                try {
                    const response = await axios.post("/api/restaurants/upload-image", formData, {
                        headers: { "Content-Type": "multipart/form-data" },
                    });
                    imageUrl = response.data.imageUrl;
                } catch (error) {
                    console.error("File upload failed", error);
                    setImageUploadError("Image upload failed. Please try again or proceed without an image.");
                    setIsSubmitting(false);
                    return; // Prevent account creation if image upload fails
                }
            }
            
            // Ensure cuisine is an empty array and add the image URL if available
            const restaurantData = {
                ...restaurant,
                cuisine: [],
                imageUrl: imageUrl
            };
            
            await dispatch(createRestaurant(restaurantData));
        navigate("/restaurant/login", { state: { accountCreated: true } });
        } catch (error) {
            console.error("Account creation failed", error);
            setIsSubmitting(false);
        }
    };

    // Update country, state, and city inputs when restaurant address changes
    useEffect(() => {
        if (restaurant.address.country) {
            setCountryInput(restaurant.address.country);
        }
        if (restaurant.address.state) {
            setStateInput(restaurant.address.state);
        }
        if (restaurant.address.city) {
            setCityInput(restaurant.address.city);
        }
    }, [restaurant.address]);

    return (
        <div className="container-fluid px-4">
            <NavbarDark />
            {/* Back Button */}
            <button className="btn text-dark border-0 d-flex align-items-center mt-3 ms-3 fw-bold" 
                style={{ backgroundColor: 'transparent' }} 
                onClick={() => navigate('/')}>
                <span className="fs-5 me-1">←</span><u>Back</u>
            </button>
            {/* Card wraps the signup form for consistent, responsive styling */}
            <Card className="mx-auto mt-4 mb-4 shadow-sm rounded-5 border-2 border-light p-4" style={{ maxWidth: '900px', width: '100%' }}>
              <Card.Body>
                <h3 className="text-center mt-4 mb-5 fw-bold">Create a Restaurant Account</h3>
                {/* Show loading and error messages inside the card for a unified look */}
                {restaurantLoading && <p className="text-center text-primary">Loading...</p>}
                {error && <p className="text-center text-danger">{error.message || "An error occurred"}</p>}
                <form onSubmit={handleSubmit}>
                <div className="row">
                    {/* Left Column */}
                    <div className="col-md-6 pe-md-4">
                        <h5 className="mb-3 fw-bold">Restaurant Details</h5>
                        
                        {/* Profile Image */}
                        <div className="mb-4">
                            <div 
                                onClick={handleImageClick}
                                className="position-relative d-inline-block cursor-pointer"
                                style={{ cursor: 'pointer' }}
                            >
                                {previewImage ? (
                                    <div className="position-relative">
                                        <img 
                                            src={previewImage} 
                                            alt="Profile Preview" 
                                            className="rounded-circle"
                                            style={{ width: '120px', height: '120px', objectFit: 'cover' }}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-sm shadow-sm btn-danger position-absolute rounded-circle"
                                            style={{ 
                                                top: '0px', 
                                                left: '100px', 
                                                padding: '0.2rem 0.5rem',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
                                            }}
                                            onClick={handleRemoveImage}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ) : (
                                    <div 
                                        className={`rounded-circle bg-light d-flex justify-content-center align-items-center ${imageUploadError ? 'border border-danger' : 'border border-dashed'}`}
                                        style={{ width: '120px', height: '120px', borderStyle: imageUploadError ? 'solid' : 'dashed', borderColor: imageUploadError ? '#dc3545' : '#ccc' }}
                                    >
                                        <i className={`bi bi-camera fs-3 ${imageUploadError ? 'text-danger' : 'text-muted'}`}></i>
                                    </div>
                                )}
                                <div className={`mt-2 small ${imageUploadError ? 'text-danger' : 'text-muted'}`}>
                                    {imageUploadError || "Click to upload restaurant image (optional)"}
                                    {imageUploadError && <span className="ms-1">*</span>}
                                </div>
                            </div>
                            <input 
                                type="file" 
                                ref={fileInputRef}
                                className="d-none" 
                                onChange={handleFileChange} 
                                accept="image/*"
                            />
                        </div>

                        <div className="mb-3">
                            <label htmlFor="name" className="form-label my-0 fw-medium">
                                Restaurant Name <span className="text-danger">*</span>
                            </label>
                            <input 
                                type="text" 
                                className={`form-control ${validationErrors.name ? 'is-invalid' : ''}`} 
                                name="name" 
                                value={restaurant.name} 
                                onChange={handleChange} 
                                required 
                            />
                            {validationErrors.name && <div className="invalid-feedback">{validationErrors.name}</div>}
                        </div>

                        <div className="mb-3">
                            <label htmlFor="description" className="form-label my-0 fw-medium">
                                Description <span className="text-danger">*</span>
                            </label>
                            <textarea 
                                className={`form-control ${validationErrors.description ? 'is-invalid' : ''}`}
                                name="description" 
                                value={restaurant.description} 
                                onChange={handleChange} 
                                rows="3"
                                required 
                            ></textarea>
                            {validationErrors.description && <div className="invalid-feedback">{validationErrors.description}</div>}
                        </div>

                        <div className="mb-3">
                            <label htmlFor="email" className="form-label my-0 fw-medium">
                                Email <span className="text-danger">*</span>
                            </label>
                            <input 
                                type="email" 
                                className={`form-control ${validationErrors.email ? 'is-invalid' : ''}`}
                                name="email" 
                                value={restaurant.email} 
                                onChange={handleChange} 
                                required 
                            />
                            {validationErrors.email && <div className="invalid-feedback">{validationErrors.email}</div>}
                        </div>

                        <div className="mb-3">
                            <label htmlFor="phone" className="form-label my-0 fw-medium">
                                Phone <span className="text-danger">*</span>
                            </label>
                            <input 
                                type="tel" 
                                className={`form-control ${validationErrors.phone ? 'is-invalid' : ''}`}
                                name="phone" 
                                value={restaurant.phone} 
                                onChange={handleChange} 
                                required 
                            />
                            {validationErrors.phone && <div className="invalid-feedback">{validationErrors.phone}</div>}
                        </div>

                        <div className="mb-3">
                            <label htmlFor="password" className="form-label my-0 fw-medium">
                                Password <span className="text-danger">*</span>
                            </label>
                            <input 
                                type="password" 
                                className={`form-control ${validationErrors.password ? 'is-invalid' : ''}`}
                                name="password" 
                                value={restaurant.password} 
                                onChange={handleChange} 
                                required 
                            />
                            {validationErrors.password && <div className="invalid-feedback">{validationErrors.password}</div>}
                            
                            {/* Password criteria list */}
                            <div className="mt-2 small">
                                <div className={passwordCriteria.length ? 'text-success' : 'text-muted'}>
                                    <i className={`bi ${passwordCriteria.length ? 'bi-check-circle-fill' : 'bi-circle'} me-1`}></i>
                                    At least 6 characters
                                </div>
                                <div className={passwordCriteria.uppercase ? 'text-success' : 'text-muted'}>
                                    <i className={`bi ${passwordCriteria.uppercase ? 'bi-check-circle-fill' : 'bi-circle'} me-1`}></i>
                                    At least one uppercase letter
                                </div>
                                <div className={passwordCriteria.lowercase ? 'text-success' : 'text-muted'}>
                                    <i className={`bi ${passwordCriteria.lowercase ? 'bi-check-circle-fill' : 'bi-circle'} me-1`}></i>
                                    At least one lowercase letter
                                </div>
                                <div className={passwordCriteria.number ? 'text-success' : 'text-muted'}>
                                    <i className={`bi ${passwordCriteria.number ? 'bi-check-circle-fill' : 'bi-circle'} me-1`}></i>
                                    At least one number
                                </div>
                                <div className={passwordCriteria.special ? 'text-success' : 'text-muted'}>
                                    <i className={`bi ${passwordCriteria.special ? 'bi-check-circle-fill' : 'bi-circle'} me-1`}></i>
                                    At least one special character
                                </div>
                            </div>
                        </div>
                        
                        <div className="mb-3">
                            <label className="form-label my-0 fw-medium">Price Range</label>
                            <div className="d-flex">
                                {['$', '$$', '$$$', '$$$$'].map((range) => (
                                    <button
                                        key={range}
                                        type="button"
                                        className={`btn ${restaurant.priceRange === range ? 'btn-dark' : 'btn-outline-dark'} me-2`}
                                        onClick={() => handlePriceRangeChange(range)}
                                    >
                                        {range}
                                    </button>
                                ))}
                        </div>
                    </div>

                        <div className="mb-3">
                            <label className="form-label my-0 fw-medium">Service Options</label>
                            <div className="form-check">
                                <input 
                                    type="checkbox" 
                                    className="form-check-input" 
                                    id="offersDelivery"
                                    name="offersDelivery"
                                    checked={restaurant.offersDelivery}
                                    onChange={handleCheckboxChange}
                                    style={{ backgroundColor: restaurant.offersDelivery ? "#212529" : "", borderColor: "#212529" }}
                                />
                                <label className="form-check-label" htmlFor="offersDelivery">
                                    Offer Delivery
                                </label>
                            </div>
                            <div className="form-check">
                                <input 
                                    type="checkbox" 
                                    className="form-check-input" 
                                    id="offersPickup"
                                    name="offersPickup"
                                    checked={restaurant.offersPickup}
                                    onChange={handleCheckboxChange}
                                    style={{ backgroundColor: restaurant.offersPickup ? "#212529" : "", borderColor: "#212529" }}
                                />
                                <label className="form-check-label" htmlFor="offersPickup">
                                    Offer Pickup
                            </label>
                            </div>
                        </div>
                    </div>
                    
                    {/* Right Column */}
                    <div className="col-md-6 ps-md-4">
                        <h5 className="mb-3 fw-bold">Location & Hours</h5>
                        
                        {/* Address Section */}
                        <div className="mb-3">
                            <label htmlFor="address.street" className="form-label my-0 fw-medium">
                                Street <span className="text-danger">*</span>
                            </label>
                            <input 
                                type="text" 
                                className={`form-control ${validationErrors.street ? 'is-invalid' : ''}`}
                                name="address.street" 
                                value={restaurant.address.street} 
                                onChange={handleChange} 
                                required 
                            />
                            {validationErrors.street && <div className="invalid-feedback">{validationErrors.street}</div>}
                        </div>

                        <div className="mb-3 position-relative">
                            <label htmlFor="country" className="form-label my-0 fw-medium">
                                Country <span className="text-danger">*</span>
                            </label>
                            <input 
                                type="text" 
                                className="form-control"
                                id="country"
                                value={countryInput} 
                                onChange={handleCountryInputChange}
                                onFocus={() => setShowCountrySuggestions(true)}
                                onBlur={() => setTimeout(() => setShowCountrySuggestions(false), 200)}
                                required
                                placeholder='Start by entering a country...'
                                autoComplete="off"
                            />
                            {showCountrySuggestions && countrySuggestions.length > 0 && (
                                <div className="position-absolute bg-white shadow p-2 rounded w-100" style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
                                    {countrySuggestions.map((country, index) => (
                                        <div 
                                            key={index} 
                                            className="p-2 hover-bg-light" 
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => handleSelectCountry(country)}
                                            onMouseDown={(e) => e.preventDefault()}
                                        >
                                            {country}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="mb-3 position-relative">
                            <label htmlFor="state" className="form-label my-0 fw-medium">
                                State <span className="text-danger">*</span>
                            </label>
                            <input 
                                type="text" 
                                className={`form-control ${validationErrors.state ? 'is-invalid' : ''}`}
                                id="state"
                                value={stateInput} 
                                onChange={handleStateInputChange}
                                onFocus={() => setShowStateSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowStateSuggestions(false), 200)}
                                placeholder={loadingStates ? "Loading states..." : "Select state"}
                                required
                                disabled={loadingStates || !restaurant.address.country}
                                autoComplete="off"
                            />
                            {validationErrors.state && <div className="invalid-feedback">{validationErrors.state}</div>}
                            {showStateSuggestions && stateSuggestions.length > 0 && (
                                <div className="position-absolute bg-white shadow p-2 rounded w-100" style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
                                    {stateSuggestions.map((state, index) => (
                                        <div 
                                            key={index} 
                                            className="p-2 hover-bg-light" 
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => handleSelectState(state)}
                                            onMouseDown={(e) => e.preventDefault()}
                                        >
                                            {state}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="mb-3 position-relative">
                            <label htmlFor="city" className="form-label my-0 fw-medium">
                                City <span className="text-danger">*</span>
                            </label>
                            <input 
                                type="text" 
                                className={`form-control ${validationErrors.city ? 'is-invalid' : ''}`}
                                id="city"
                                value={cityInput} 
                                onChange={handleCityInputChange}
                                onFocus={() => setShowCitySuggestions(true)}
                                onBlur={() => setTimeout(() => setShowCitySuggestions(false), 200)}
                                placeholder={loadingCities ? "Loading cities..." : "Select city"}
                                required
                                disabled={loadingCities || !restaurant.address.state}
                                autoComplete="off"
                            />
                            {validationErrors.city && <div className="invalid-feedback">{validationErrors.city}</div>}
                            {showCitySuggestions && citySuggestions.length > 0 && (
                                <div className="position-absolute bg-white shadow p-2 rounded w-100" style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
                                    {citySuggestions.map((city, index) => (
                                        <div 
                                            key={index} 
                                            className="p-2 hover-bg-light" 
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => handleSelectCity(city)}
                                            onMouseDown={(e) => e.preventDefault()}
                                        >
                                            {city}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="mb-3">
                            <label htmlFor="address.zipCode" className="form-label my-0 fw-medium">
                                Zip Code <span className="text-danger">*</span>
                            </label>
                            <input 
                                type="text" 
                                className={`form-control ${validationErrors.zipCode ? 'is-invalid' : ''}`}
                                name="address.zipCode" 
                                value={restaurant.address.zipCode} 
                                onChange={handleChange} 
                                required 
                            />
                            {validationErrors.zipCode && <div className="invalid-feedback">{validationErrors.zipCode}</div>}
                        </div>
                        
                        {/* Operating Hours Section */}
                        <h6 className="mt-4 mb-3 fw-medium">Operating Hours</h6>
                        
                        <div className="operating-hours-container">
                            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                                <div key={day} className="operating-hour-row mb-2 p-2 rounded" style={{ background: '#f9f9f9' }}>
                                    <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center w-100">
                                        {/* Day name - always visible */}
                                        <div className="day-column mb-2 mb-sm-0" style={{ minWidth: '90px' }}>
                                            <span className="fw-medium text-capitalize">{day}</span>
                                        </div>
                                        
                                        {/* Closed toggle */}
                                        <div className="closed-column mb-2 mb-sm-0 me-sm-3">
                                            <div className="form-check mb-0">
                                                <input 
                                                    type="checkbox" 
                                                    className="form-check-input" 
                                                    id={`${day}-closed`}
                                                    checked={restaurant.operatingHours[day].isClosed}
                                                    onChange={(e) => handleClosedDayChange(day, e.target.checked)}
                                                    style={{ backgroundColor: restaurant.operatingHours[day].isClosed ? "#212529" : "", borderColor: "#212529" }}
                                                />
                                                <label className="form-check-label" htmlFor={`${day}-closed`}>
                                                    Closed
                            </label>
                                            </div>
                                        </div>
                                        
                                        {/* Time inputs - conditionally rendered */}
                                        {!restaurant.operatingHours[day].isClosed && (
                                            <div className="hours-column d-flex flex-wrap flex-grow-1 align-items-center gap-2">
                                                <div className="time-input-container" style={{ minWidth: '100px', maxWidth: '140px' }}>
                                                    <input 
                                                        type="time" 
                                                        className="form-control form-control-sm"
                                                        value={restaurant.operatingHours[day].open || ''}
                                                        onChange={(e) => handleHoursChange(day, 'open', e.target.value)}
                                                        style={{ colorScheme: 'light', cursor: 'text', width: '100%' }}
                                                    />
                                                </div>
                                                <span className="mx-1">to</span>
                                                <div className="time-input-container" style={{ minWidth: '100px', maxWidth: '140px' }}>
                                                    <input 
                                                        type="time" 
                                                        className="form-control form-control-sm"
                                                        value={restaurant.operatingHours[day].close || ''}
                                                        onChange={(e) => handleHoursChange(day, 'close', e.target.value)}
                                                        style={{ colorScheme: 'light', cursor: 'text', width: '100%' }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <style jsx="true">{`
                            .operating-hours-container {
                                display: flex;
                                flex-direction: column;
                                width: 100%;
                            }
                            
                            .operating-hour-row {
                                transition: background-color 0.2s;
                            }
                            
                            .operating-hour-row:hover {
                                background-color: #f0f0f0 !important;
                            }
                            
                            input[type="time"]::-webkit-calendar-picker-indicator {
                                cursor: pointer;
                            }
                            
                            @media (max-width: 576px) {
                                .day-column {
                                    margin-bottom: 0.5rem;
                                    font-weight: 600;
                                }
                                
                                .closed-column {
                                    margin-bottom: 0.5rem;
                                }
                            }
                        `}</style>
                    </div>
                </div>

                <div className="d-flex justify-content-center mt-4">
                    <button 
                        type="submit" 
                        className="btn btn-dark ms-2 rounded-3 px-2 mb-0 mt-2" 
                        style={{ width: '100px' }}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Signing Up..." : "Sign Up"}
                    </button>
                </div>
                </form>
              </Card.Body>
            </Card>
        </div>
    );
};

export default RestaurantSignup;
