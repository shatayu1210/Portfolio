import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import axios from "../../config/axios";
import { useDispatch, useSelector, shallowEqual } from "react-redux";
import { createCustomer, clearCustomerError } from "../../redux/slices/customer/customerSlice";
import NavbarDark from "../Common/NavbarDark";
import Card from 'react-bootstrap/Card';
import { validateEmail, validatePhone, validateName } from "../../utils/validation";

const CustomerSignup = () => {
    const [customer, setCustomer] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        phone: "",
        dateOfBirth: "",
        imageUrl: null,
        addresses: [{
            label: "Home",
            street: "",
            city: "",
            state: "",
            country: "",
            zipCode: "",
            isPrimary: true
        }]
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
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        password: '',
        street: '',
        city: '',
        state: '',
        country: '',
        zip: '',
        dob: '',
        addressLabel: ''
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
    
    const { loading, error, success } = useSelector(
        (state) => state.customer,
        shallowEqual
    );

    const fileInputRef = useRef(null);
    const [previewImage, setPreviewImage] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);

    const validatePassword = (password) => {
        // Match backend validation exactly
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

    const calculateAge = (birthDate) => {
        const today = new Date();
        const dob = new Date(birthDate);
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        
        // Adjust age if birthday hasn't occurred this year
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
            age--;
        }
        return age;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        
        if (name === 'dateOfBirth') {
            const age = calculateAge(value);
            setValidationErrors(prev => ({
                ...prev,
                dateOfBirth: age < 13 ? "You must be at least 13 years old to register" : ""
            }));
            setCustomer(prev => ({ ...prev, [name]: value }));
            return;
        }
        
        setCustomer({ ...customer, [name]: value });
        
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
                setCustomer(prev => ({ ...prev, phone: sanitizedValue }));
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
        } else if (name === 'firstName' || name === 'lastName') {
            setValidationErrors(prev => ({
                ...prev,
                [name]: validateName(value) ? "" : "Must contain only letters, spaces, hyphens, or apostrophes"
            }));
        } else if (name === 'street') {
            setValidationErrors(prev => ({
                ...prev,
                street: value.trim() ? "" : "Street address is required"
            }));
        } else if (name === 'city') {
            setValidationErrors(prev => ({
                ...prev,
                city: value.trim() ? "" : "City is required"
            }));
        } else if (name === 'state') {
            setValidationErrors(prev => ({
                ...prev,
                state: value.trim() ? "" : "State is required"
            }));
        } else if (name === 'zipCode') {
            setValidationErrors(prev => ({
                ...prev,
                zipCode: value.trim() ? "" : "ZIP code is required"
            }));
        }
    };

    // Handle File Upload - simplified to just store file and show preview
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
        e.stopPropagation(); // Prevent triggering the parent click handler
        setSelectedFile(null);
        if (previewImage) {
            URL.revokeObjectURL(previewImage);
            setPreviewImage(null);
        }
        // Reset the file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Fetch countries on component mount and reset success state
    useEffect(() => {
        // Clear success message and errors when component mounts
        dispatch(clearCustomerError());
        setValidationErrors({});
        
        // Fetch countries
        fetchCountries();
        
        return () => {
            // Clean up any resources if needed
            if (previewImage) {
                URL.revokeObjectURL(previewImage);
            }
        };
    }, [dispatch]);

    // Fetch countries from API
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

    // Fetch cities for selected country and state
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

    // Handle country selection
    const handleSelectCountry = (country) => {
        setCountryInput(country);
        
        // Update customer state
        const newAddresses = [...customer.addresses];
        newAddresses[0].country = country;
        setCustomer({ ...customer, addresses: newAddresses });
        
        // Reset state and city when country changes
        setStateInput("");
        setCityInput("");
        newAddresses[0].state = "";
        newAddresses[0].city = "";
        
        // Hide suggestions
        setShowCountrySuggestions(false);
        
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

    // Handle state selection
    const handleSelectState = (state) => {
        setStateInput(state);
        
        // Update customer state
        const newAddresses = [...customer.addresses];
        newAddresses[0].state = state;
        setCustomer({ ...customer, addresses: newAddresses });
        
        // Reset city when state changes
        setCityInput("");
        newAddresses[0].city = "";
        
        // Hide suggestions
        setShowStateSuggestions(false);
        
        // Fetch cities for the selected country and state
        fetchCities(customer.addresses[0].country, state);
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

    // Handle city selection
    const handleSelectCity = (city) => {
        setCityInput(city);
        
        // Update customer state
        const newAddresses = [...customer.addresses];
        newAddresses[0].city = city;
        setCustomer({ ...customer, addresses: newAddresses });
        
        // Hide suggestions
        setShowCitySuggestions(false);
    };

    // Handle Form Submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Reset validation errors
        setValidationErrors({});
        
        // Validate form fields
        const newValidationErrors = {};
        
        // Name validation
        if (!validateName(customer.firstName)) {
            newValidationErrors.firstName = "First name must contain only letters, spaces, hyphens, or apostrophes";
        }
        if (!validateName(customer.lastName)) {
            newValidationErrors.lastName = "Last name must contain only letters, spaces, hyphens, or apostrophes";
        }
        
        // Email validation using utility
        if (!validateEmail(customer.email)) {
            newValidationErrors.email = "Please enter a valid email address";
        }
        
        // Phone validation using utility
        if (!validatePhone(customer.phone)) {
            newValidationErrors.phone = "Please enter a valid phone number (10-15 digits, optional + prefix)";
        }
        
        // Password validation
        if (!validatePassword(customer.password)) {
            newValidationErrors.password = "Password must have 6+ chars, uppercase, lowercase, number, and special char";
        }
        
        // Date of birth validation
        const age = calculateAge(customer.dateOfBirth);
        if (age < 13) {
            newValidationErrors.dateOfBirth = "You must be at least 13 years old to register";
        }
        
        // Address validation
        if (!customer.addresses[0]?.label?.trim()) {
            newValidationErrors.addressLabel = "Address label is required";
        }
        
        if (!customer.addresses[0]?.street?.trim()) {
            newValidationErrors.street = "Street address is required";
        }
        
        // Country validation
        if (!customer.addresses[0]?.country?.trim()) {
            newValidationErrors.country = "Country is required";
        }
        
        // State validation
        if (!customer.addresses[0]?.state?.trim()) {
            newValidationErrors.state = "State is required";
        }
        
        // City validation
        if (!customer.addresses[0]?.city?.trim()) {
            newValidationErrors.city = "City is required";
        }
        
        if (!customer.addresses[0]?.zipCode?.trim() || !/^[0-9]{5,6}$/.test(customer.addresses[0]?.zipCode?.trim())) {
            newValidationErrors.zipCode = "Zip code must be 5-6 digits (e.g., 12345)";
        }
        
        const isValid = Object.keys(newValidationErrors).length === 0;
        
        if (!isValid) {
            setValidationErrors(newValidationErrors);
            return;
        }

        try {
            const formData = new FormData();
            
            // Ensure all string fields are properly trimmed
            formData.append('firstName', customer.firstName.trim());
            formData.append('lastName', customer.lastName.trim());
            formData.append('email', customer.email.trim().toLowerCase());
            formData.append('password', customer.password);
            formData.append('phone', customer.phone.trim());
            formData.append('dateOfBirth', customer.dateOfBirth);
            
            // Format the address properly
            const formattedAddresses = customer.addresses.map(addr => ({
                label: addr.label || "Home",
                street: addr.street.trim(),
                city: addr.city.trim(),
                state: addr.state.trim(),
                country: addr.country.trim(),
                zipCode: addr.zipCode.trim(),
                isPrimary: true
            }));
            
            // Add addresses as JSON string
            formData.append('addresses', JSON.stringify(formattedAddresses));

            // Add image file if selected
            if (selectedFile) {
                formData.append("image", selectedFile);
            }

            const result = await dispatch(createCustomer(formData));
            
            if (result.meta.requestStatus === "fulfilled") {
                // Clean up the preview URL to prevent memory leaks
                if (previewImage) {
                    URL.revokeObjectURL(previewImage);
                }
                // Wait a moment before redirecting
                setTimeout(() => {
                    navigate("/customer/login", { state: { accountCreated: true } });
                }, 1500);
            } else if (result.meta.requestStatus === "rejected") {
                if (result.payload?.errors && Array.isArray(result.payload.errors)) {
                    // Handle backend validation errors
                    const backendErrors = { 
                        submit: result.payload.message || 'Please correct the errors below:'
                    };
                    
                    // Map backend errors to form fields
                    result.payload.errors.forEach(error => {
                        if (error.includes('email')) backendErrors.email = error;
                        else if (error.includes('Password must be at least')) backendErrors.password = error;
                        else if (error.includes('Password must contain')) backendErrors.password = error; 
                        else if (error.includes('phone')) backendErrors.phone = error;
                        else if (error.includes('address')) backendErrors.address = error;
                        else if (error.includes('Zip code')) backendErrors.zipCode = error;
                        else if (error.includes('First name')) backendErrors.firstName = error;
                        else if (error.includes('Last name')) backendErrors.lastName = error;
                        else if (error.includes('City must be')) backendErrors.city = error;
                        else if (error.includes('State must be')) backendErrors.state = error;
                    });
                    
                    setValidationErrors(backendErrors);
                } else {
                    setValidationErrors({ 
                        submit: result.payload.message || 'Registration failed. Please try again.' 
                    });
                }
            }
        } catch (error) {
            setValidationErrors({ submit: error.message });
        }
    };

    return (
        <div className="container-fluid px-4">
            <NavbarDark />
            <button
                className="btn text-dark border-0 d-flex align-items-center mt-3 ms-3 fw-bold"
                style={{ backgroundColor: "transparent" }}
                onClick={() => navigate("/")}
            >
                <span className="fs-5 me-1">←</span><u>Back</u>
            </button>
            <Card className="mx-auto mt-4 mb-4 shadow-sm rounded-4 border-2 border-light p-4" style={{ maxWidth: '900px', width: '100%' }}>
              <Card.Body>
                <h3 className="text-center mt-2 mb-4 fw-bold">Create an Account</h3>
                {validationErrors.submit && (
                  <div className="alert alert-danger mb-3" style={{ width: '100%' }}>
                    {validationErrors.submit}
                  </div>
                )}
                {success && (
                  <div className="alert alert-success mb-3" style={{ width: '100%' }}>
                    Account created successfully! Redirecting to login...
                  </div>
                )}
                <form onSubmit={handleSubmit}>
                    <div className="text-center mb-4">
                        <div 
                            className="position-relative d-inline-block"
                            style={{ cursor: 'pointer' }}
                            onClick={handleImageClick}
                        >
                            <div 
                                className="rounded-circle overflow-hidden"
                                style={{
                                    width: '90px',
                                    height: '90px',
                                    border: '2px solid #dee2e6',
                                    backgroundColor: '#f8f9fa'
                                }}
                            >
                                {previewImage ? (
                                    <img
                                        src={previewImage}
                                        alt="Profile preview"
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover'
                                        }}
                                    />
                                ) : (
                                    <div className="d-flex align-items-center justify-content-center h-100">
                                        <i className="bi bi-person-circle" style={{ fontSize: '3rem', color: '#dee2e6' }}></i>
                                    </div>
                                )}
                            </div>
                            <div 
                                className="position-absolute bottom-0 end-0 bg-white rounded-circle shadow-sm d-flex align-items-center justify-content-center"
                                style={{
                                    width: '30px',
                                    height: '30px',
                                    border: '2px solid #dee2e6'
                                }}
                            >
                                <i className="bi bi-pencil-fill text-dark" style={{ fontSize: '0.8rem' }}></i>
                            </div>
                            {previewImage && (
                                <div 
                                    className="position-absolute top-0 end-0"
                                    style={{ marginTop: '-10px', marginRight: '-10px' }}
                                    onClick={handleRemoveImage}
                                >
                                    <button 
                                        type="button" 
                                        className="btn btn-sm btn-danger rounded-circle"
                                        style={{ width: '24px', height: '24px', padding: '0', fontSize: '12px', lineHeight: '1' }}
                                        title="Remove image"
                                    >
                                        &times;
                                    </button>
                                </div>
                            )}
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/*"
                            className="d-none"
                        />
                        <p className="text-muted mt-2 mb-0">Click to upload profile picture (optional)</p>
                    </div>

                    <div className="row">
                        <div className="col-md-6">
                            <div className="mb-3">
                                <label htmlFor="firstName">First Name <span className="text-danger">*</span></label>
                                <input 
                                    type="text" 
                                    className={`form-control ${validationErrors.firstName ? 'is-invalid' : ''}`}
                                    name="firstName" 
                                    value={customer.firstName} 
                                    onChange={handleChange} 
                                    required 
                                />
                                {validationErrors.firstName && (
                                    <div className="invalid-feedback">{validationErrors.firstName}</div>
                                )}
                            </div>
                            <div className="mb-3">
                                <label htmlFor="lastName">Last Name <span className="text-danger">*</span></label>
                                <input 
                                    type="text" 
                                    className={`form-control ${validationErrors.lastName ? 'is-invalid' : ''}`}
                                    name="lastName" 
                                    value={customer.lastName} 
                                    onChange={handleChange} 
                                    required 
                                />
                                {validationErrors.lastName && (
                                    <div className="invalid-feedback">{validationErrors.lastName}</div>
                                )}
                            </div>
                            <div className="mb-3">
                                <label htmlFor="email">Email <span className="text-danger">*</span></label>
                                <input 
                                    type="email" 
                                    className={`form-control ${validationErrors.email ? 'is-invalid' : ''}`}
                                    name="email" 
                                    value={customer.email} 
                                    onChange={handleChange} 
                                    autoComplete="username" 
                                    required 
                                />
                                {validationErrors.email && (
                                    <div className="invalid-feedback">{validationErrors.email}</div>
                                )}
                            </div>
                            <div className="mb-3">
                                <label htmlFor="phone">Phone <span className="text-danger">*</span></label>
                                <input 
                                    type="tel" 
                                    className={`form-control ${validationErrors.phone ? 'is-invalid' : ''}`}
                                    name="phone" 
                                    value={customer.phone} 
                                    onChange={handleChange} 
                                    pattern="^\+?\d{10,15}$"
                                    placeholder="+1234567890"
                                    inputMode="tel"
                                    required 
                                />
                                {validationErrors.phone && (
                                    <div className="invalid-feedback">{validationErrors.phone}</div>
                                )}
                            </div>
                            <div className="mb-3">
                                <label htmlFor="password">Password <span className="text-danger">*</span></label>
                                <input 
                                    type="password" 
                                    className={`form-control ${validationErrors.password ? 'is-invalid' : passwordCriteria.length ? 'is-valid' : ''}`}
                                    name="password" 
                                    value={customer.password} 
                                    onChange={handleChange} 
                                    autoComplete="current-password" 
                                    required 
                                />
                                <div className="password-criteria mt-2">
                                    <small className={`d-block ${passwordCriteria.length ? 'text-success' : 'text-muted'}`}>
                                        <i className={`bi ${passwordCriteria.length ? 'bi-check-circle-fill' : 'bi-circle'}`}></i> At least 6 characters
                                    </small>
                                    <small className={`d-block ${passwordCriteria.uppercase ? 'text-success' : 'text-muted'}`}>
                                        <i className={`bi ${passwordCriteria.uppercase ? 'bi-check-circle-fill' : 'bi-circle'}`}></i> One uppercase letter
                                    </small>
                                    <small className={`d-block ${passwordCriteria.lowercase ? 'text-success' : 'text-muted'}`}>
                                        <i className={`bi ${passwordCriteria.lowercase ? 'bi-check-circle-fill' : 'bi-circle'}`}></i> One lowercase letter
                                    </small>
                                    <small className={`d-block ${passwordCriteria.number ? 'text-success' : 'text-muted'}`}>
                                        <i className={`bi ${passwordCriteria.number ? 'bi-check-circle-fill' : 'bi-circle'}`}></i> One number
                                    </small>
                                    <small className={`d-block ${passwordCriteria.special ? 'text-success' : 'text-muted'}`}>
                                        <i className={`bi ${passwordCriteria.special ? 'bi-check-circle-fill' : 'bi-circle'}`}></i> One special character
                                    </small>
                                </div>
                                {validationErrors.password && (
                                    <div className="invalid-feedback">{validationErrors.password}</div>
                                )}
                            </div>
                            <div className="mb-3">
                                <label htmlFor="dateOfBirth">Date of Birth <span className="text-danger">*</span></label>
                                <input 
                                    type="date" 
                                    className={`form-control ${validationErrors.dateOfBirth ? 'is-invalid' : ''}`}
                                    name="dateOfBirth" 
                                    value={customer.dateOfBirth} 
                                    onChange={handleChange} 
                                    max={new Date().toISOString().split('T')[0]}  // Prevents future dates
                                    required 
                                    style={{ colorScheme: 'light' }}
                                />
                                {validationErrors.dateOfBirth && (
                                    <div className="invalid-feedback d-block">
                                        {validationErrors.dateOfBirth}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="col-md-6">
                            <div className="mb-3">
                                <div className="mb-3">
                                    <label htmlFor="addressLabel">Address Label <span className="text-danger">*</span></label>
                                    <input 
                                        type="text" 
                                        className={`form-control ${validationErrors.addressLabel ? 'is-invalid' : ''}`}
                                        name="addressLabel" 
                                        placeholder="Home"
                                        value={customer.addresses[0].label} 
                                        onChange={(e) => {
                                            const newAddresses = [...customer.addresses];
                                            // Always use "Home" if input is empty
                                            newAddresses[0].label = e.target.value || "Home";
                                            setCustomer({ ...customer, addresses: newAddresses });
                                            
                                            // Clear validation error
                                            if (e.target.value) {
                                                setValidationErrors(prev => ({
                                                    ...prev,
                                                    addressLabel: ""
                                                }));
                                            }
                                        }}
                                        required
                                    />
                                    {validationErrors.addressLabel && (
                                        <div className="invalid-feedback">{validationErrors.addressLabel}</div>
                                    )}
                                    <div className="form-text small">
                                        This will default to "Home" if left empty
                                    </div>
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="street">Street <span className="text-danger">*</span></label>
                                    <input 
                                        type="text" 
                                        className={`form-control ${validationErrors.street ? 'is-invalid' : ''}`}
                                        name="street" 
                                        value={customer.addresses[0].street} 
                                        onChange={(e) => {
                                            const newAddresses = [...customer.addresses];
                                            newAddresses[0].street = e.target.value;
                                            setCustomer({ ...customer, addresses: newAddresses });
                                        }} 
                                        required 
                                    />
                                    {validationErrors.street && (
                                        <div className="invalid-feedback">{validationErrors.street}</div>
                                    )}
                                </div>
                                
                                {/* Country Autocomplete */}
                                <div className="mb-3">
                                    <label htmlFor="country">Country <span className="text-danger">*</span></label>
                                    <div className="position-relative">
                                        <input 
                                            type="text" 
                                            className={`form-control ${validationErrors.country ? 'is-invalid' : ''}`}
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
                                        {validationErrors.country && (
                                            <div className="invalid-feedback">{validationErrors.country}</div>
                                        )}
                                        
                                        {/* Country Suggestions Dropdown */}
                                        {showCountrySuggestions && countrySuggestions.length > 0 && (
                                            <div className="position-absolute w-100 mt-1 shadow-sm bg-white border rounded-2 z-index-dropdown" 
                                                style={{ maxHeight: '200px', overflowY: 'auto', zIndex: 1000 }}>
                                                {countrySuggestions.map((country, index) => (
                                                    <div 
                                                        key={index} 
                                                        className="px-3 py-2 suggestion-item" 
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
                                
                                {/* State Autocomplete */}
                                <div className="mb-3">
                                    <label htmlFor="state">State/Province <span className="text-danger">*</span></label>
                                    <div className="position-relative">
                                        <input 
                                            type="text" 
                                            className={`form-control ${validationErrors.state ? 'is-invalid' : ''}`}
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
                                            placeholder={customer.addresses[0].country ? "Start typing a state name..." : "Select a country first"}
                                            required 
                                            disabled={!customer.addresses[0].country || loadingStates}
                                        />
                                        {loadingStates && (
                                            <div className="position-absolute" style={{ right: '10px', top: '10px' }}>
                                                <span className="spinner-border spinner-border-sm text-success" role="status"></span>
                                            </div>
                                        )}
                                        {validationErrors.state && (
                                            <div className="invalid-feedback">{validationErrors.state}</div>
                                        )}
                                        
                                        {/* State Suggestions Dropdown */}
                                        {showStateSuggestions && stateSuggestions.length > 0 && (
                                            <div className="position-absolute w-100 mt-1 shadow-sm bg-white border rounded-2 z-index-dropdown" 
                                                style={{ maxHeight: '200px', overflowY: 'auto', zIndex: 1000 }}>
                                                {stateSuggestions.map((state, index) => (
                                                    <div 
                                                        key={index} 
                                                        className="px-3 py-2 suggestion-item" 
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
                                            className={`form-control ${validationErrors.city ? 'is-invalid' : ''}`}
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
                                            placeholder={customer.addresses[0].state ? "Start typing a city name..." : "Select a state first"}
                                            required 
                                            disabled={!customer.addresses[0].state || loadingCities}
                                        />
                                        {loadingCities && (
                                            <div className="position-absolute" style={{ right: '10px', top: '10px' }}>
                                                <span className="spinner-border spinner-border-sm text-success" role="status"></span>
                                            </div>
                                        )}
                                        {validationErrors.city && (
                                            <div className="invalid-feedback">{validationErrors.city}</div>
                                        )}
                                        
                                        {/* City Suggestions Dropdown */}
                                        {showCitySuggestions && citySuggestions.length > 0 && (
                                            <div className="position-absolute w-100 mt-1 shadow-sm bg-white border rounded-2 z-index-dropdown" 
                                                style={{ maxHeight: '200px', overflowY: 'auto', zIndex: 1000 }}>
                                                {citySuggestions.map((city, index) => (
                                                    <div 
                                                        key={index} 
                                                        className="px-3 py-2 suggestion-item" 
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
                                    <label htmlFor="zipCode">Zip Code <span className="text-danger">*</span></label>
                                    <input 
                                        type="text" 
                                        className={`form-control ${validationErrors.zipCode ? 'is-invalid' : ''}`}
                                        name="zipCode" 
                                        value={customer.addresses[0].zipCode} 
                                        onChange={(e) => {
                                            const newAddresses = [...customer.addresses];
                                            newAddresses[0].zipCode = e.target.value;
                                            setCustomer({ ...customer, addresses: newAddresses });
                                        }} 
                                        required 
                                    />
                                    {validationErrors.zipCode && (
                                        <div className="invalid-feedback">{validationErrors.zipCode}</div>
                                    )}
                                </div>
                                <div className="mb-3">
                                    <div className="form-check">
                                        <input 
                                            type="checkbox" 
                                            className="form-check-input" 
                                            id="isPrimary" 
                                            checked={true}
                                            disabled
                                            title="First address is automatically set as primary"
                                        />
                                        <label className="form-check-label text-muted" htmlFor="isPrimary">
                                            Primary Address
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="text-center mt-4">
                        <button 
                            type="submit" 
                            className="btn btn-dark px-4 py-2" 
                            disabled={loading}
                        >
                            {loading ? "Creating Account..." : "Create Account"}
                        </button>
                    </div>
                </form>
              </Card.Body>
            </Card>
        </div>
    );
};

export default CustomerSignup;