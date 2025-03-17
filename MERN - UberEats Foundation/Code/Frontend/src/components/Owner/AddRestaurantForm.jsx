import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import NavbarDark from '../Common/NavbarDark';
import { useNavigate } from "react-router-dom";
import { validateEmail, validatePhone } from "../../utils/validation";

const AddRestaurantForm = ({ onSuccess, onCancel }) => {
    const ownerId = useSelector((state) => {
        return state.auth?.restaurantOwner?.id;
    });
    const [loading, setLoading] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false); // State for file upload loading
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        email: '',
        phone: '',
        address: '',
        offers_pickup: false,
        offers_delivery: false,
        ratings: 0,
        image_url: null,
        owner_id: null  // Initialize as null
    });

    const [validationErrors, setValidationErrors] = useState({
        email: "",
        phone: ""
    });

    const navigate = useNavigate();

    const isOwnerAuthenticated = useSelector((state) => state.auth.isOwnerAuthenticated);

    useEffect(() => {
        if (!isOwnerAuthenticated) {
            navigate("/owner/login"); // Redirect to owner login page if not logged in
        }
    }, [isOwnerAuthenticated, navigate]);

    // Update formData when ownerId changes
    useEffect(() => {
        console.log('useEffect triggered with ownerId:', ownerId);
        if (ownerId) {
            setFormData(prev => {
                const newData = {
                    ...prev,
                    owner_id: ownerId
                };
                return newData;
            });
        }
    }, [ownerId]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        
        // Clear validation errors when user types
        if (name === 'email' || name === 'phone') {
            setValidationErrors({
                ...validationErrors,
                [name]: ""
            });
        }
        
        // Clear error when user changes the email field
        if (name === 'email' && error && error.includes('Email')) {
            setError(null);
        }
    };

    // Handle File Upload
    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadLoading(true);
        const formData = new FormData();
        formData.append("image_url", file);

        try {
            const response = await axios.post("/api/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" },
                withCredentials: true
            });
            
            console.log("File upload response:", response.data);
            
            setFormData((prevState) => ({
                ...prevState,
                image_url: response.data.filePath, // Update image_url with the file path from the server
            }));
            
        } catch (error) {
            console.error("File upload failed", error);
            alert("Failed to upload file. Please try again.");
        } finally {
            setUploadLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Validate email and phone before submission
        let isValid = true;
        const newValidationErrors = { email: "", phone: "" };
        
        if (!validateEmail(formData.email)) {
            newValidationErrors.email = "Please enter a valid email address";
            isValid = false;
        }
        
        if (!validatePhone(formData.phone)) {
            newValidationErrors.phone = "Please enter a valid 10-digit phone number";
            isValid = false;
        }
        
        if (!isValid) {
            setValidationErrors(newValidationErrors);
            setLoading(false);
            return;
        }

        console.log('Form submission - Current formData:', formData);
        console.log('Form submission - Current ownerId:', ownerId);

        if (!formData.offers_pickup && !formData.offers_delivery) {
            setError('Please select at least one service option (Pickup or Delivery)');
            setLoading(false);
            return;
        }

        // Create a new object with the current ownerId to ensure it's included
        const dataToSubmit = {
            ...formData,
            owner_id: ownerId // Explicitly set the owner_id from Redux
        };

        console.log('Data being submitted:', dataToSubmit);

        if (!dataToSubmit.owner_id) {
            setError('Owner ID is required. Please try refreshing the page.');
            setLoading(false);
            return;
        }

        try {
            const response = await axios.post('http://127.0.0.1:3000/api/restaurants', dataToSubmit, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.data) {
                onSuccess(response.data);
            }
        } catch (err) {
            console.error('Error submitting form:', err);
            setError(err.response?.data?.error || err.response?.data?.message || 'Failed to add restaurant');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <NavbarDark />
            <div className="container-fluid px-0">
                <button
                    className="btn text-dark border-0 d-flex align-items-center mt-3 ms-3 fw-bold"
                    style={{ backgroundColor: 'transparent' }}
                    onClick={onCancel}
                >
                    <span className="fs-5 me-1">←</span><u>Back to Restaurants</u>
                </button>
                <h3 className="text-center mt-4 mb-4 fw-bold">Add New Restaurant</h3>

                {error && (
                    <div className="alert alert-danger mt-3 w-75 mx-auto" role="alert" style={{ color: 'red', fontWeight: 'bold' }}>
                        {error}
                    </div>
                )}

                <form className="w-75 mx-auto mb-5" onSubmit={handleSubmit}>
                    <div className="row">
                        {/* Left Column */}
                        <div className="col-md-6">
                            <div className="mb-3">
                                <label htmlFor="name" className="form-label my-0">
                                    Restaurant Name <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="form-control"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="mb-3">
                                <label htmlFor="email" className="form-label my-0">
                                    Email <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="email"
                                    className="form-control"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                />
                                {validationErrors.email && <div className="text-danger">{validationErrors.email}</div>}
                            </div>

                            <div className="mb-3">
                                <label htmlFor="phone" className="form-label my-0">
                                    Phone <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="tel"
                                    className="form-control"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    pattern="[0-9]*"
                                    inputMode="numeric"
                                    required
                                />
                                {validationErrors.phone && <div className="text-danger">{validationErrors.phone}</div>}
                            </div>

                            <div className="mb-3">
                                <label htmlFor="address" className="form-label my-0">
                                    Address <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="form-control"
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="col-md-6">
                            <div className="mb-3">
                                <label htmlFor="description" className="form-label my-0">
                                    Description <span className="text-danger">*</span>
                                </label>
                                <textarea
                                    className="form-control"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="mb-3">
                                <label htmlFor="ratings" className="form-label my-0">
                                    Rating <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="number"
                                    className="form-control"
                                    name="ratings"
                                    value={formData.ratings}
                                    onChange={handleChange}
                                    min="0"
                                    max="5"
                                    step="0.1"
                                    required
                                />
                                <div className="form-text">Rating must be between 0 and 5</div>
                            </div>

                            <div className="mb-3">
                                <div className="form-check mb-2">
                                    <input
                                        type="checkbox"
                                        name="offers_pickup"
                                        className="form-check-input"
                                        checked={formData.offers_pickup}
                                        onChange={handleChange}
                                    />
                                    <label className="form-check-label">
                                        <i className="bi bi-bicycle me-1"></i>Offers Pickup
                                    </label>
                                </div>
                                <div className="form-check">
                                    <input
                                        type="checkbox"
                                        name="offers_delivery"
                                        className="form-check-input"
                                        checked={formData.offers_delivery}
                                        onChange={handleChange}
                                    />
                                    <label className="form-check-label">
                                        <i className="bi bi-truck me-1"></i>Offers Delivery
                                    </label>
                                </div>
                            </div>

                            <div className="mb-3">
                                <label htmlFor="image_url" className="form-label my-0">
                                    Restaurant Image <span className="text-muted">(optional)</span>
                                </label>
                                <input
                                    type="file"
                                    className="form-control"
                                    name="image_url"
                                    onChange={handleFileChange}
                                    accept="image/*" // Allow only image files
                                    disabled={uploadLoading}
                                />
                                {uploadLoading && (
                                    <div className="mt-2">
                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                        Uploading...
                                    </div>
                                )}
                                {formData.image_url && (
                                    <div className="mt-2">
                                        <img
                                            src={formData.image_url.startsWith('/') ? `http://127.0.0.1:3000${formData.image_url}` : formData.image_url}
                                            alt="Restaurant Preview"
                                            className="img-thumbnail"
                                            style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="d-flex justify-content-center mt-4">
                        <button 
                            type="submit" 
                            className="btn btn-dark rounded-2 text-white px-5" 
                            disabled={loading || uploadLoading}
                            style={{ minWidth: '200px' }}
                        >
                            {loading ? (
                                <div className="d-flex align-items-center justify-content-center">
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    Adding Restaurant...
                                </div>
                            ) : (
                                <div className="d-flex align-items-center justify-content-center">
                                    Add Restaurant
                                </div>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
};

export default AddRestaurantForm;