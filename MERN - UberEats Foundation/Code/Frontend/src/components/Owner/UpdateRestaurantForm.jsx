import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import NavbarDark from '../Common/NavbarDark';
import { useNavigate } from "react-router-dom";
import { validateEmail, validatePhone } from "../../utils/validation";


const UpdateRestaurantForm = ({ restaurant, onSuccess, onCancel }) => {
    const ownerId = useSelector((state) => state.auth.restaurantOwner?.id);
    console.log('UpdateRestaurantForm - ownerId:', ownerId);
    console.log('UpdateRestaurantForm - restaurant:', restaurant);
    
    const navigate = useNavigate();

    const isOwnerAuthenticated = useSelector((state) => state.auth.isOwnerAuthenticated);    

    useEffect(() => {
        if (!isOwnerAuthenticated) {
            navigate("/owner/login"); // Redirect to owner login page if not logged in
        }
    }, [isOwnerAuthenticated, navigate]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [uploadStatus, setUploadStatus] = useState('');
    const [formData, setFormData] = useState({
        name: restaurant.name || '',
        description: restaurant.description || '',
        email: restaurant.email || '',
        phone: restaurant.phone || '',
        address: restaurant.address || '',
        offers_pickup: restaurant.offers_pickup || false,
        offers_delivery: restaurant.offers_delivery || false,
        image_url: restaurant.image_url || null,
        ratings: restaurant.ratings || 0.0  // Default ratings set as decimal value
    });

    const [validationErrors, setValidationErrors] = useState({
        email: "",
        phone: ""
    });

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
    };

    // Handle image upload separately
    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadStatus('Uploading image...');
        
        const imageFormData = new FormData();
        imageFormData.append('image_url', file);

        try {
            const response = await axios.post('http://127.0.0.1:3000/api/upload', imageFormData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            setFormData(prev => ({
                ...prev,
                image_url: response.data.filePath
            }));
            
            setUploadStatus('Image uploaded successfully!');
            console.log('Image uploaded:', response.data.filePath);
        } catch (err) {
            console.error('Image upload failed:', err);
            setUploadStatus('Image upload failed. Please try again.');
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

        try {
            // Create a JSON object for all fields
            const jsonData = {
                name: formData.name,
                description: formData.description,
                email: formData.email,
                phone: formData.phone,
                address: formData.address,
                offers_pickup: formData.offers_pickup,
                offers_delivery: formData.offers_delivery,
                owner_id: ownerId,
                image_url: formData.image_url, // Include the image_url from the separate upload
                ratings: parseFloat(formData.ratings).toFixed(1)  // Ensuring decimal format with 1 digit after decimal
            };
            
            console.log('Updating restaurant with ID:', restaurant.id);
            console.log('Owner ID being sent:', ownerId);
            console.log('Data being sent:', jsonData);
            
            const response = await axios.put(`http://127.0.0.1:3000/api/restaurants/${restaurant.id}`, jsonData, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.data) {
                onSuccess(response.data);
            }
        } catch (err) {
            console.error('Error updating restaurant:', err);
            setError(err.response?.data?.message || err.response?.data?.error || 'Failed to update restaurant');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <NavbarDark />
            <div className="container-fluid py-4">
                <div className="container">
                    <div className="row justify-content-center">
                        <div className="col-12 col-lg-8">
                            <div className="card border-0">
                                <div className="card-body p-4">
                                    <div className="d-flex align-items-center mb-4">
                                        <h3 className="card-title mb-0 fw-bold">Update Restaurant</h3>
                                    </div>
                                    
                                    {error && (
                                        <div className="alert alert-danger" role="alert">
                                            <i className="bi bi-exclamation-triangle me-2"></i>
                                            {error}
                                        </div>
                                    )}

                                    <form onSubmit={handleSubmit}>
                                        <div className="row g-3">
                                            <div className="col-12">
                                                <label className="form-label">
                                                    Restaurant Name <span className="text-danger">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    name="name"
                                                    className="form-control"
                                                    value={formData.name}
                                                    onChange={handleChange}
                                                    required
                                                />
                                            </div>

                                            <div className="col-12">
                                                <label className="form-label">
                                                    Description <span className="text-danger">*</span>
                                                </label>
                                                <textarea
                                                    name="description"
                                                    className="form-control"
                                                    rows="3"
                                                    value={formData.description}
                                                    onChange={handleChange}
                                                    required
                                                />
                                            </div>

                                            <div className="col-12 col-md-6">
                                                <label className="form-label">
                                                    Email <span className="text-danger">*</span>
                                                </label>
                                                <input
                                                    type="email"
                                                    name="email"
                                                    className="form-control"
                                                    value={formData.email}
                                                    onChange={handleChange}
                                                    required
                                                />
                                                {validationErrors.email && <div className="text-danger">{validationErrors.email}</div>}
                                            </div>

                                            <div className="col-12 col-md-6">
                                                <label className="form-label">
                                                    Phone <span className="text-danger">*</span>
                                                </label>
                                                <input
                                                    type="tel"
                                                    name="phone"
                                                    className="form-control"
                                                    value={formData.phone}
                                                    onChange={handleChange}
                                                    pattern="[0-9]*"
                                                    inputMode="numeric"
                                                    required
                                                />
                                                {validationErrors.phone && <div className="text-danger">{validationErrors.phone}</div>}
                                            </div>

                                            <div className="col-12">
                                                <label className="form-label">
                                                    Address <span className="text-danger">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    name="address"
                                                    className="form-control"
                                                    value={formData.address}
                                                    onChange={handleChange}
                                                    required
                                                />
                                            </div>

                                            <div className="col-12 col-md-6">
                                                <div className="form-check form-switch">
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
                                            </div>

                                            <div className="col-12 col-md-6">
                                                <div className="form-check form-switch">
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

                                            {/* Added ratings field */}
                                            <div className="col-12 col-md-6">
                                                <label className="form-label">
                                                    Ratings (1 to 5) <span className="text-danger">*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    name="ratings"
                                                    className="form-control"
                                                    value={formData.ratings}
                                                    onChange={handleChange}
                                                    min="1"
                                                    max="5"
                                                    step="0.1"  // Ensures decimal input
                                                    required
                                                />
                                            </div>

                                            <div className="col-12 mb-3">
                                                <label className="form-label">Restaurant Image</label>
                                                <input
                                                    type="file"
                                                    className="form-control mb-2"
                                                    onChange={handleImageChange}
                                                    accept="image/*"
                                                />
                                                {uploadStatus && (
                                                    <div className={`alert ${uploadStatus.includes('failed') ? 'alert-danger' : 'alert-info'} py-2 mb-2`}>
                                                        {uploadStatus}
                                                    </div>
                                                )}
                                                <small className="text-muted d-block mb-2">
                                                    Upload a new image (optional). The image will be uploaded immediately.
                                                </small>
                                                {formData.image_url && (
                                                    <div className="mt-2">
                                                        <p className="mb-1">Current Image:</p>
                                                        <img 
                                                            src={`http://127.0.0.1:3000${formData.image_url}`} 
                                                            alt={formData.name}
                                                            style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                                                            className="rounded"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="col-12">
                                                <div className="d-grid gap-2 d-md-flex justify-content-md-end">
                                                    <button 
                                                        type="button" 
                                                        className="btn btn-outline-secondary"
                                                        onClick={onCancel}
                                                        disabled={loading}
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button 
                                                        type="submit" 
                                                        className="btn btn-dark"
                                                        disabled={loading}
                                                    >
                                                        {loading ? (
                                                            <>
                                                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                                Updating...
                                                            </>
                                                        ) : (
                                                            <>
                                                                Update Restaurant
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default UpdateRestaurantForm;