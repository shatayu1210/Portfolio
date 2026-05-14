import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { updateRestaurantProfile, fetchRestaurant } from '../../redux/slices/restaurant/restaurantSlice';
import axios from '../../config/axios';
import { validateEmail, validatePhone, validateName } from '../../utils/validation';

// Modal for editing restaurant profile
const EditProfileModal = ({ show, handleClose, onUpdateSuccess }) => {
    const dispatch = useDispatch();
    const { restaurant, loading } = useSelector(state => state.restaurant);
    const restaurantId = useSelector(state => state.auth.restaurant?.id);
    const fileInputRef = useRef(null);
    
    // Form state
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        description: '',
        address: {
            street: '', city: '', state: '', country: '', zipCode: ''
        },
        imageUrl: '',
        priceRange: '$' // Default to lowest tier
    });
    // Location autocomplete and suggestions
    const [countries, setCountries] = useState([]);
    const [countryInput, setCountryInput] = useState('');
    const [countrySuggestions, setCountrySuggestions] = useState([]);
    const [showCountrySuggestions, setShowCountrySuggestions] = useState(false);
    const [states, setStates] = useState([]);
    const [stateInput, setStateInput] = useState('');
    const [stateSuggestions, setStateSuggestions] = useState([]);
    const [showStateSuggestions, setShowStateSuggestions] = useState(false);
    const [cities, setCities] = useState([]);
    const [cityInput, setCityInput] = useState('');
    const [citySuggestions, setCitySuggestions] = useState([]);
    const [showCitySuggestions, setShowCitySuggestions] = useState(false);
    const [loadingStates, setLoadingStates] = useState(false);
    const [loadingCities, setLoadingCities] = useState(false);
    // Validation errors
    const [validationErrors, setValidationErrors] = useState({});
    // Other state
    const [previewImage, setPreviewImage] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [imageUploadError, setImageUploadError] = useState('');
    const DEFAULT_IMAGE_PLACEHOLDER = "https://res.cloudinary.com/dvylvq84d/image/upload/v1744151036/ImagePlaceholder_gg1xob.png";

    // Fetch countries on mount
    useEffect(() => {
        fetchCountries();
    }, []);

    // When restaurant loads (or modal opens), populate form and location fields
    useEffect(() => {
        if (restaurant) {
            setFormData({
                name: restaurant.name || '',
                email: restaurant.email || '',
                phone: restaurant.phone || '',
                description: restaurant.description || '',
                address: restaurant.address || { street: '', city: '', state: '', country: '', zipCode: '' },
                imageUrl: restaurant.imageUrl || '',
                priceRange: restaurant.priceRange || '$'
            });
            setPreviewImage(restaurant.imageUrl || DEFAULT_IMAGE_PLACEHOLDER);
            setImageFile(null);
            setImageUploadError('');
            // Set location inputs for autocomplete
            setCountryInput(restaurant.address?.country || '');
            setStateInput(restaurant.address?.state || '');
            setCityInput(restaurant.address?.city || '');
            // Fetch states and cities for current country/state
            if (restaurant.address?.country) fetchStates(restaurant.address.country);
            if (restaurant.address?.country && restaurant.address?.state) fetchCities(restaurant.address.country, restaurant.address.state);
        }
    }, [restaurant, show]);

    // Handle generic form field changes (except country/state/city)
    const handleChange = (e) => {
        const { name, value } = e.target;
        if (["street", "zipCode"].includes(name)) {
            setFormData(prev => ({
                ...prev,
                address: { ...prev.address, [name]: value }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
        // Live validation for email, phone, name
        if (name === 'email') {
            setValidationErrors(prev => ({ ...prev, email: validateEmail(value) ? '' : 'Please enter a valid email address' }));
        } else if (name === 'phone') {
            setValidationErrors(prev => ({ ...prev, phone: validatePhone(value) ? '' : 'Please enter a valid phone number (10-15 digits, optional + prefix)' }));
        } else if (name === 'name') {
            setValidationErrors(prev => ({ ...prev, name: value.trim() ? '' : 'Restaurant name is required' }));
        } else if (name === 'description') {
            setValidationErrors(prev => ({ ...prev, description: value.trim() ? '' : 'Description is required' }));
        }
    };

    // Handle price range button click
    const handlePriceRangeChange = (range) => {
        setFormData(prev => ({ ...prev, priceRange: range }));
    }

    // --- LOCATION AUTOCOMPLETE & API LOGIC ---
    // Fetch country list from API
    const fetchCountries = async () => {
        try {
            const res = await axios.get('/api/location/countries');
            setCountries(res.data);
        } catch (err) {
            setCountries([]);
        }
    };
    // Fetch state list for a country
    const fetchStates = async (country) => {
        if (!country) return;
        setLoadingStates(true);
        try {
            const res = await axios.post('/api/location/states', { country });
            setStates(res.data);
            setStateSuggestions(res.data);
        } catch (err) {
            setStates([]);
            setStateSuggestions([]);
        } finally {
            setLoadingStates(false);
        }
    };
    // Fetch city list for a country and state
    const fetchCities = async (country, state) => {
        if (!country || !state) return;
        setLoadingCities(true);
        try {
            const res = await axios.post('/api/location/cities', { country, state });
            setCities(res.data);
            setCitySuggestions(res.data);
        } catch (err) {
            setCities([]);
            setCitySuggestions([]);
        } finally {
            setLoadingCities(false);
        }
    };
    // Handle country input change (with suggestions & validation)
    const handleCountryInputChange = (e) => {
        const value = e.target.value;
        setCountryInput(value);
        setFormData(prev => ({ ...prev, address: { ...prev.address, country: value, state: '', city: '' } }));
        setStateInput(''); setCityInput(''); setStates([]); setCities([]);
        if (value.trim()) {
            setCountrySuggestions(countries.filter(c => c.toLowerCase().includes(value.toLowerCase())));
            setShowCountrySuggestions(true);
        } else {
            setCountrySuggestions([]); setShowCountrySuggestions(false);
        }
        setValidationErrors(prev => ({ ...prev, country: value.trim() ? '' : 'Country is required' }));
    };
    // When user selects a country from suggestions
    const handleSelectCountry = (country) => {
        setCountryInput(country);
        setShowCountrySuggestions(false);
        setFormData(prev => ({ ...prev, address: { ...prev.address, country, state: '', city: '' } }));
        setStateInput(''); setCityInput(''); setStates([]); setCities([]);
        fetchStates(country);
    };
    // Handle state input change
    const handleStateInputChange = (e) => {
        const value = e.target.value;
        setStateInput(value);
        setFormData(prev => ({ ...prev, address: { ...prev.address, state: value, city: '' } }));
        setCityInput(''); setCities([]);
        if (value.trim()) {
            setStateSuggestions(states.filter(s => s.toLowerCase().includes(value.toLowerCase())));
            setShowStateSuggestions(true);
        } else {
            setStateSuggestions([]); setShowStateSuggestions(false);
        }
        setValidationErrors(prev => ({ ...prev, state: value.trim() ? '' : 'State is required' }));
    };
    // When user selects a state from suggestions
    const handleSelectState = (state) => {
        setStateInput(state);
        setShowStateSuggestions(false);
        setFormData(prev => ({ ...prev, address: { ...prev.address, state, city: '' } }));
        setCityInput(''); setCities([]);
        fetchCities(formData.address.country, state);
    };
    // Handle city input change
    const handleCityInputChange = (e) => {
        const value = e.target.value;
        setCityInput(value);
        setFormData(prev => ({ ...prev, address: { ...prev.address, city: value } }));
        if (value.trim()) {
            setCitySuggestions(cities.filter(c => c.toLowerCase().includes(value.toLowerCase())));
            setShowCitySuggestions(true);
        } else {
            setCitySuggestions([]); setShowCitySuggestions(false);
        }
        setValidationErrors(prev => ({ ...prev, city: value.trim() ? '' : 'City is required' }));
    };
    // When user selects a city from suggestions
    const handleSelectCity = (city) => {
        setCityInput(city);
        setShowCitySuggestions(false);
        setFormData(prev => ({ ...prev, address: { ...prev.address, city } }));
    };

    const handleImageClick = () => {
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setImageUploadError('Please upload a valid image file.');
            return;
        }
        setImageUploadError('');
        setImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewImage(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveImage = (e) => {
        e.stopPropagation();
        setImageFile(null);
        setPreviewImage('');
        setFormData(prev => ({ ...prev, imageUrl: '' }));
    };

    // Form submission: Validate all fields as in RestaurantSignup
    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');
        // Validate fields
        let isValid = true;
        const newValidationErrors = {};
        if (!formData.name.trim()) {
            newValidationErrors.name = 'Restaurant name is required';
            isValid = false;
        }
        if (!validateEmail(formData.email)) {
            newValidationErrors.email = 'Please enter a valid email address';
            isValid = false;
        }
        if (!validatePhone(formData.phone)) {
            newValidationErrors.phone = 'Please enter a valid phone number (10-15 digits, optional + prefix)';
            isValid = false;
        }
        if (!formData.address.country.trim()) {
            newValidationErrors.country = 'Country is required';
            isValid = false;
        }
        if (!formData.address.state.trim()) {
            newValidationErrors.state = 'State is required';
            isValid = false;
        }
        if (!formData.address.city.trim()) {
            newValidationErrors.city = 'City is required';
            isValid = false;
        }
        if (!formData.address.street.trim()) {
            newValidationErrors.street = 'Street address is required';
            isValid = false;
        }
        if (!formData.address.zipCode.trim()) {
            newValidationErrors.zipCode = 'ZIP code is required';
            isValid = false;
        }
        if (!formData.description.trim()) {
            newValidationErrors.description = 'Description is required';
            isValid = false;
        }
        setValidationErrors(newValidationErrors);
        if (!isValid) {
            setSaving(false);
            return;
        }
        try {
            let updatedData = { ...formData };
            // If a new image is selected, upload it
            if (imageFile) {
                const imgForm = new FormData();
                imgForm.append('image', imageFile);
                const res = await axios.post('/api/restaurants/upload-image', imgForm, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
                if (!res.data) throw new Error('Image upload failed');
                const data = res.data;
                updatedData.imageUrl = data.imageUrl;
            }
            // If the image is removed (no preview and no file), explicitly set imageUrl to null
            // This matches CustomerProfile logic and is accepted by the backend as 'remove image'
            if (!previewImage && !imageFile) {
                updatedData.imageUrl = null;
            }
            await dispatch(updateRestaurantProfile({ restaurantId, restaurantData: updatedData })).unwrap();
            setSuccess('Profile updated!');
            dispatch(fetchRestaurant(restaurantId));
            // Notify parent dashboard to show success alert
            if (typeof onUpdateSuccess === 'function') onUpdateSuccess();
            setTimeout(() => {
                setSuccess('');
                handleClose();
            }, 200);
        } catch (err) {
            setError(err.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };


    return (
        <Modal show={show} onHide={handleClose} centered size="lg" contentClassName="rounded-5 py-3 px-4">
            <Modal.Header closeButton>
                <Modal.Title className="fw-bold">Edit Restaurant Profile</Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleSubmit}>
                <Modal.Body>
                    {error && (
                      <div className="alert alert-danger">
                        {typeof error === 'string' ? (
                          error
                        ) : error && typeof error === 'object' ? (
                          <>
                            {error.message && <div>{error.message}</div>}
                            {/* If error.errors is an array, show each error */}
                            {Array.isArray(error.errors) && error.errors.length > 0 && (
                              <ul className="mb-0">
                                {error.errors.map((err, idx) => (
                                  <li key={idx}>{typeof err === 'string' ? err : JSON.stringify(err)}</li>
                                ))}
                              </ul>
                            )}
                            {/* If error.errors is an object, show each value */}
                            {error.errors && typeof error.errors === 'object' && !Array.isArray(error.errors) && (
                              <ul className="mb-0">
                                {Object.values(error.errors).map((err, idx) => (
                                  <li key={idx}>{typeof err === 'string' ? err : JSON.stringify(err)}</li>
                                ))}
                              </ul>
                            )}
                            {/* Fallback for unknown error shape */}
                            {!error.message && !error.errors && <span>{JSON.stringify(error)}</span>}
                          </>
                        ) : (
                          JSON.stringify(error)
                        )}
                      </div>
                    )}
                    {success && <div className="alert alert-success">{success}</div>}

                    {/*
                      Redesigned two-column layout:
                    */}
                    <div className="row mb-4 justify-content-center">
                        <div className="col-12 d-flex flex-column align-items-center">
                            <div className="position-relative" style={{ width: '100px', height: '100px' }}>
                                <img
                                    src={ `${previewImage? previewImage : DEFAULT_IMAGE_PLACEHOLDER}`}
                                    alt="Restaurant Preview"
                                    className="rounded-circle border"
                                    style={{ width: '100px', height: '100px', objectFit: 'cover', cursor: 'pointer' }}
                                    onClick={handleImageClick}
                                />
                                <button
                                    type="button"
                                    className={`btn btn-sm btn-danger position-absolute top-0 end-0 rounded-circle ${previewImage ? 'd-block' : 'd-none'}`}
                                    style={{ width: '28px', height: '28px', padding: 0 }}
                                    onClick={handleRemoveImage}
                                    >
                                        ×
                                </button>
                            </div>

                            <input type="file" ref={fileInputRef} className="d-none" onChange={handleFileChange} accept="image/*" />
                            <div className="mt-2 small text-muted text-center" style={{ maxWidth: 180 }}>
                                {imageUploadError || `Click to ${previewImage ? 'change the' : 'upload a'} restaurant image`}
                            </div>
                        </div>
                    </div>
                    {/* Two-column field layout below image */}
                    <div className="row g-4">
                        {/* Left column: Main info & location */}
                        <div className="col-12 col-md-6">
                            <Form.Group className="mb-3">
                                <Form.Label>Name <span className="text-danger">*</span></Form.Label>
                                <Form.Control name="name" value={formData.name} onChange={handleChange} required isInvalid={!!validationErrors.name} />
                                <Form.Control.Feedback type="invalid">{validationErrors.name}</Form.Control.Feedback>
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Email <span className="text-danger">*</span></Form.Label>
                                <Form.Control name="email" type="email" value={formData.email} onChange={handleChange} required isInvalid={!!validationErrors.email} />
                                <Form.Control.Feedback type="invalid">{validationErrors.email}</Form.Control.Feedback>
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Phone <span className="text-danger">*</span></Form.Label>
                                <Form.Control name="phone" value={formData.phone} onChange={handleChange} required isInvalid={!!validationErrors.phone} />
                                <Form.Control.Feedback type="invalid">{validationErrors.phone}</Form.Control.Feedback>
                            </Form.Group>
                            <Form.Group className="mb-3 position-relative">
                                <Form.Label>Country <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    name="country"
                                    value={countryInput}
                                    onChange={handleCountryInputChange}
                                    autoComplete="off"
                                    required 
                                    isInvalid={!!validationErrors.country}
                                    onFocus={() => setShowCountrySuggestions(countrySuggestions.length > 0)}
                                    onBlur={() => setTimeout(() => setShowCountrySuggestions(false), 200)}
                                />
                                {/* Autocomplete dropdown */}
                                {showCountrySuggestions && countrySuggestions.length > 0 && (
                                    <div className="autocomplete-dropdown position-absolute w-100 bg-white border rounded shadow-sm z-2" style={{ maxHeight: 200, overflowY: 'auto', top: '100%', left: 0 }}>
                                        {countrySuggestions.map((c, idx) => (
                                            <div key={idx} className="p-2 hover-bg" style={{ cursor: 'pointer' }} onMouseDown={() => handleSelectCountry(c)}>
                                                {c}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <Form.Control.Feedback type="invalid">{validationErrors.country}</Form.Control.Feedback>
                            </Form.Group>
                            <Form.Group className="mb-3 position-relative">
                                <Form.Label>State <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    name="state"
                                    value={stateInput}
                                    onChange={handleStateInputChange}
                                    autoComplete="off"
                                    required
                                    isInvalid={!!validationErrors.state}
                                    disabled={!formData.address.country}
                                    onFocus={() => setShowStateSuggestions(stateSuggestions.length > 0)}
                                    onBlur={() => setTimeout(() => setShowStateSuggestions(false), 200)}
                                />
                                {/* Autocomplete dropdown */}
                                {showStateSuggestions && stateSuggestions.length > 0 && (
                                    <div className="autocomplete-dropdown position-absolute w-100 bg-white border rounded shadow-sm z-2" style={{ maxHeight: 200, overflowY: 'auto', top: '100%', left: 0 }}>
                                        {stateSuggestions.map((s, idx) => (
                                            <div key={idx} className="p-2 hover-bg" style={{ cursor: 'pointer' }} onMouseDown={() => handleSelectState(s)}>
                                                {s}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <Form.Control.Feedback type="invalid">{validationErrors.state}</Form.Control.Feedback>
                            </Form.Group>
                            <Form.Group className="mb-3 position-relative">
                                <Form.Label>City <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    name="city"
                                    value={cityInput}
                                    onChange={handleCityInputChange}
                                    autoComplete="off"
                                    required
                                    isInvalid={!!validationErrors.city}
                                    disabled={!formData.address.state}
                                    onFocus={() => setShowCitySuggestions(citySuggestions.length > 0)}
                                    onBlur={() => setTimeout(() => setShowCitySuggestions(false), 200)}
                                />
                                {/* Autocomplete dropdown */}
                                {showCitySuggestions && citySuggestions.length > 0 && (
                                    <div className="autocomplete-dropdown position-absolute w-100 bg-white border rounded shadow-sm z-2" style={{ maxHeight: 200, overflowY: 'auto', top: '100%', left: 0 }}>
                                        {citySuggestions.map((c, idx) => (
                                            <div key={idx} className="p-2 hover-bg" style={{ cursor: 'pointer' }} onMouseDown={() => handleSelectCity(c)}>
                                                {c}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <Form.Control.Feedback type="invalid">{validationErrors.city}</Form.Control.Feedback>
                            </Form.Group>
                        </div>
                        {/* Right column: Address & description */}
                        <div className="col-12 col-md-6">
                            <Form.Group className="mb-3">
                                <Form.Label>Street Address <span className="text-danger">*</span></Form.Label>
                                <Form.Control name="street" value={formData.address.street} onChange={handleChange} required isInvalid={!!validationErrors.street} />
                                <Form.Control.Feedback type="invalid">{validationErrors.street}</Form.Control.Feedback>
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>ZIP Code <span className="text-danger">*</span></Form.Label>
                                <Form.Control name="zipCode" value={formData.address.zipCode} onChange={handleChange} required isInvalid={!!validationErrors.zipCode} />
                                <Form.Control.Feedback type="invalid">{validationErrors.zipCode}</Form.Control.Feedback>
                            </Form.Group>
                            <div className="mb-3">
                                <label htmlFor="description" className="form-label my-0 fw-medium">
                                    Description <span className="text-danger">*</span>
                                </label>
                                <textarea 
                                    className={`form-control ${validationErrors.description ? 'is-invalid' : ''}`}
                                    name="description" 
                                    value={formData.description} 
                                    onChange={handleChange} 
                                    rows="3"
                                    required 
                                ></textarea>
                                {validationErrors.description && <div className="invalid-feedback">{validationErrors.description}</div>}
                            </div>

                            {/* Price Range Selection - matches RestaurantSignup */}
                            <div className="mb-3">
                                <label className="form-label my-0 fw-medium">Price Range</label>
                                <div className="d-flex">
                                    {['$', '$$', '$$$', '$$$$'].map((range) => (
                                        <button
                                            key={range}
                                            type="button"
                                            className={`btn ${formData.priceRange === range ? 'btn-dark' : 'btn-outline-dark'} me-2`}
                                            onClick={() => handlePriceRangeChange(range)}
                                        >
                                            {range}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="outline-dark" onClick={handleClose} disabled={saving}>Cancel</Button>
                    <Button variant="dark" type="submit" disabled={saving}>
                        {saving ? <Spinner size="sm" animation="border" /> : 'Save Changes'}
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
}

export default EditProfileModal;
