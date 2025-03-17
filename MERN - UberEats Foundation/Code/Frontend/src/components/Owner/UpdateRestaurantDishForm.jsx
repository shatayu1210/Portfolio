import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import NavbarDark from '../Common/NavbarDark';
import { useNavigate } from "react-router-dom";

const UpdateRestaurantDishForm = ({ restaurant, onSuccess, onCancel }) => {
    const ownerId = useSelector((state) => state.auth.restaurantOwner?.id);
    const navigate = useNavigate();
    const isOwnerAuthenticated = useSelector((state) => state.auth.isOwnerAuthenticated);

    const [loading, setLoading] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [newDishUploadLoading, setNewDishUploadLoading] = useState(false);
    const [deletingDishId, setDeletingDishId] = useState(null);
    const [error, setError] = useState(null);
    const [dishes, setDishes] = useState([]);
    const [updatedDishes, setUpdatedDishes] = useState({});
    const [showAddDishForm, setShowAddDishForm] = useState(false); // Toggle Add Dish form
    const [newDish, setNewDish] = useState({
        name: '',
        description: '',
        price: '',
        size: '',
        image_url: '',
    });
    const [deletedDishMessage, setDeletedDishMessage] = useState('');

    useEffect(() => {
        if (!isOwnerAuthenticated) {
            navigate("/owner/login");
        }
    }, [isOwnerAuthenticated, navigate]);

    useEffect(() => {
        if (restaurant && restaurant.id) {
            fetchDishes(restaurant.id);
        }
    }, [restaurant]);

    const fetchDishes = async (restaurantId) => {
        try {
            const response = await axios.get(`http://127.0.0.1:3000/api/dishes/restaurant/${restaurantId}`);
            // Ensure all dish properties have default values if they're null
            const dishesWithDefaults = response.data.map(dish => ({
                ...dish,
                name: dish.name || '',
                description: dish.description || '',
                price: dish.price || '',
                size: dish.size || '',
                image_url: dish.image_url || ''
            }));
            setDishes(dishesWithDefaults);
        } catch (err) {
            if (err.response && err.response.status === 404) {
                return;
            }
            console.error('Error fetching dishes:', err);
            setError('Failed to fetch dishes');
        }
    };

    const handleDishUpdate = async (dish) => {
        setLoading(true);
        setError(null);
        try {
            await axios.put(`http://127.0.0.1:3000/api/dishes/${dish.id}`, dish);
            setUpdatedDishes(prev => ({ ...prev, [dish.id]: `Successfully updated dish ${dish.name}` }));
        } catch (err) {
            console.error('Error updating dish:', err);
            setError('Failed to update dish');
        } finally {
            setLoading(false);
        }
    };

    // Add handleDeleteDish function
    const handleDeleteDish = async (dishId, dishName) => {
        if (!window.confirm(`Are you sure you want to delete "${dishName}"?`)) {
            return;
        }
        
        setDeletingDishId(dishId);
        setError(null);
        try {
            await axios.delete(`http://127.0.0.1:3000/api/dishes/${dishId}`);
            // Remove the deleted dish from the dishes array
            setDishes(dishes.filter(dish => dish.id !== dishId));
            // Show success message
            setDeletedDishMessage(`Dish "${dishName}" has been deleted successfully`);
            // Clear the message after 5 seconds
            setTimeout(() => {
                setDeletedDishMessage('');
            }, 5000);
        } catch (err) {
            console.error('Error deleting dish:', err);
            setError('Failed to delete dish');
        } finally {
            setDeletingDishId(null);
        }
    };

    const handleChange = (index, e) => {
        const { name, value } = e.target;
        const updatedDishes = [...dishes];
        // Ensure we never set a null value
        updatedDishes[index][name] = value || '';
        setDishes(updatedDishes);
    };

    const handleFileChange = async (index, e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadLoading(true);
        const formData = new FormData();
        formData.append("image_url", file);

        try {
            const response = await axios.post("http://127.0.0.1:3000/api/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" },
                withCredentials: true,
            });

            const updatedDishes = [...dishes];
            updatedDishes[index].image_url = response.data.filePath;
            setDishes(updatedDishes);
            
            // Show success message
            setUpdatedDishes(prev => ({ 
                ...prev, 
                [updatedDishes[index].id]: `Image for ${updatedDishes[index].name} updated successfully` 
            }));
        } catch (error) {
            console.error("File upload failed", error);
            alert("Failed to upload file. Please try again.");
        } finally {
            setUploadLoading(false);
        }
    };

    const handleAddDish = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Create a new object for submission
        const dishToSubmit = {
            ...newDish,
            restaurant_id: restaurant.id,
        };

        // If image_url is empty, don't include it in the submission
        if (!dishToSubmit.image_url) {
            delete dishToSubmit.image_url;
        }

        try {
            const response = await axios.post('http://127.0.0.1:3000/api/dishes', dishToSubmit);
            setDishes([...dishes, response.data]);
            setShowAddDishForm(false);
            // Reset form with empty strings, not null values
            setNewDish({
                name: '',
                description: '',
                price: '',
                size: '',
                image_url: '',
            });
        } catch (err) {
            console.error('Error adding dish:', err);
            setError('Failed to add dish');
        } finally {
            setLoading(false);
        }
    };

    const handleNewDishChange = (e) => {
        const { name, value } = e.target;
        setNewDish(prev => ({ ...prev, [name]: value }));
    };

    // Handle File Upload for new dish
    const handleNewDishFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setNewDishUploadLoading(true);
        const formData = new FormData();
        formData.append("image_url", file);

        try {
            const response = await axios.post("http://127.0.0.1:3000/api/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" },
                withCredentials: true
            });
            
            console.log("File upload response:", response.data);
            
            setNewDish(prev => ({
                ...prev,
                image_url: response.data.filePath, // Update image_url with the file path from the server
            }));
            
        } catch (error) {
            console.error("File upload failed", error);
            alert("Failed to upload file. Please try again.");
        } finally {
            setNewDishUploadLoading(false);
        }
    };

    return (
        <>
            <NavbarDark />
            <button
                className="btn text-dark border-0 d-flex align-items-center mt-3 ms-5 fw-bold"
                style={{ backgroundColor: "transparent" }}
                onClick={onCancel}
            >
                <span className="fs-5 me-1">←</span><u>Back to Home</u>
            </button>
            <div className="container-fluid py-4">
                <div className="container">
                    <div className="row justify-content-center">
                        <div className="col-12">
                            <div className="card border-0">
                                <div className="card-body p-4">
                                    <div className="d-flex justify-content-between align-items-center mb-4">
                                        <h3 className="fw-bold">Update Dishes for {restaurant.name}</h3>
                                        <button
                                            className="btn btn-light border-dark"
                                            onClick={() => setShowAddDishForm(!showAddDishForm)}
                                        >
                                            {showAddDishForm ? 'Cancel' : 'Add Dish'}
                                        </button>
                                    </div>

                                    {error && <div className="alert alert-danger">{error}</div>}
                                    {deletedDishMessage && <div className="alert alert-success">{deletedDishMessage}</div>}

                                    {showAddDishForm ? (
                                        <form onSubmit={handleAddDish}>
                                            <h5 className="fw-bold">Adding a New Dish</h5>
                                            <div className="mb-3">
                                                <label className="form-label">Name <span className="text-danger">*</span></label>
                                                <input
                                                    type="text"
                                                    name="name"
                                                    className="form-control"
                                                    value={newDish.name || ''}
                                                    onChange={handleNewDishChange}
                                                    required
                                                />
                                            </div>
                                            <div className="mb-3">
                                                <label className="form-label">Description <span className="text-danger">*</span></label>
                                                <textarea
                                                    name="description"
                                                    className="form-control"
                                                    value={newDish.description || ''}
                                                    onChange={handleNewDishChange}
                                                    required
                                                />
                                            </div>
                                            <div className="mb-3">
                                                <label className="form-label">Price <span className="text-danger">*</span></label>
                                                <input
                                                    type="number"
                                                    name="price"
                                                    className="form-control"
                                                    value={newDish.price || ''}
                                                    onChange={handleNewDishChange}
                                                    required
                                                />
                                            </div>
                                            <div className="mb-3">
                                                <label className="form-label">Size</label>
                                                <input
                                                    type="text"
                                                    name="size"
                                                    className="form-control"
                                                    value={newDish.size || ''}
                                                    onChange={handleNewDishChange}
                                                />
                                            </div>
                                            <div className="mb-3">
                                                <label className="form-label">Upload an Image (Optional)</label>
                                                <input
                                                    type="file"
                                                    className="form-control"
                                                    onChange={handleNewDishFileChange}
                                                    accept="image/*"
                                                    disabled={newDishUploadLoading}
                                                />
                                                {newDishUploadLoading && (
                                                    <div className="mt-2">
                                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                        Uploading...
                                                    </div>
                                                )}
                                                {newDish.image_url && (
                                                    <div className="mt-2">
                                                        <img
                                                            src={newDish.image_url.startsWith('/') ? `http://127.0.0.1:3000${newDish.image_url}` : newDish.image_url}
                                                            alt="Dish Preview"
                                                            className="img-thumbnail"
                                                            style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="d-grid gap-2 d-md-flex justify-content-md-center mt-4">
                                            <button
                                                type="submit"
                                                className="btn btn-dark"
                                                disabled={loading || newDishUploadLoading}
                                            >
                                                {loading ? 'Adding...' : 'Add Dish'}
                                            </button>
                                            </div>

                                        </form>
                                    ) : (
                                        <div className="row">
                                            {dishes.length === 0 ? (
                                                <div className="text-center py-5">
                                                    <h4 className="text-muted">No Dishes Found</h4>
                                                </div>
                                            ) : (
                                                dishes.map((dish, index) => (
                                                    <div key={`${dish.id}`} className="col-md-6 mb-4">
                                                        <div className="card h-100">
                                                            <div className="card-body">
                                                                {/* Dish Image Preview */}
                                                                <div className="text-left mb-3">
                                                                    <img 
                                                                        src={dish.image_url ? `http://127.0.0.1:3000${dish.image_url}` : 'http://127.0.0.1:3000/uploads/blank_post.png'}
                                                                        alt={dish.name} 
                                                                        className="img-fluid"
                                                                        style={{ width: "80px", height: "80px", objectFit: "cover" }} 
                                                                    />
                                                                </div>

                                                                <h5 className="fw-bold">{dish.name}</h5>
                                                                {updatedDishes[dish.id] && (
                                                                    <div className="alert alert-success">{updatedDishes[dish.id]}</div>
                                                                )}

                                                                <div className="mb-3">
                                                                    <label className="form-label">Name</label>
                                                                    <input
                                                                        key={`name-${dish.id}`}
                                                                        type="text"
                                                                        name="name"
                                                                        className="form-control"
                                                                        value={dish.name || ''}
                                                                        onChange={(e) => handleChange(index, e)}
                                                                    />
                                                                </div>
                                                                <div className="mb-3">
                                                                    <label className="form-label">Description</label>
                                                                    <textarea
                                                                        key={`desc-${dish.id}`}
                                                                        name="description"
                                                                        className="form-control"
                                                                        value={dish.description || ''}
                                                                        onChange={(e) => handleChange(index, e)}
                                                                    />
                                                                </div>
                                                                <div className="mb-3">
                                                                    <label className="form-label">Price</label>
                                                                    <input
                                                                        key={`price-${dish.id}`}
                                                                        type="number"
                                                                        name="price"
                                                                        className="form-control"
                                                                        value={dish.price || ''}
                                                                        onChange={(e) => handleChange(index, e)}
                                                                    />
                                                                </div>
                                                                <div className="mb-3">
                                                                    <label className="form-label">Size</label>
                                                                    <input
                                                                        key={`size-${dish.id}`}
                                                                        type="text"
                                                                        name="size"
                                                                        className="form-control"
                                                                        value={dish.size || ''}
                                                                        onChange={(e) => handleChange(index, e)}
                                                                    />
                                                                </div>
                                                                <div className="mb-3">
                                                                    <label className="form-label">Upload New Image</label>
                                                                    <input
                                                                        type="file"
                                                                        className="form-control"
                                                                        onChange={(e) => handleFileChange(index, e)}
                                                                        accept="image/*"
                                                                        disabled={uploadLoading}
                                                                    />
                                                                    {uploadLoading && (
                                                                        <div className="mt-2">
                                                                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                                            Uploading...
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="d-grid gap-2 d-md-flex justify-content-md-center mt-4">
                                                                <button
                                                                    key={`update-button-${dish.id}`}
                                                                    className="btn btn-dark me-2"
                                                                    onClick={() => handleDishUpdate(dish)}
                                                                    disabled={loading || deletingDishId === dish.id}
                                                                >
                                                                    {loading ? 'Updating...' : 'Update Dish'}
                                                                </button>
                                                                <button
                                                                    key={`delete-button-${dish.id}`}
                                                                    className="btn btn-outline-danger"
                                                                    onClick={() => handleDeleteDish(dish.id, dish.name)}
                                                                    disabled={loading || deletingDishId === dish.id}
                                                                    type="button"
                                                                >
                                                                    {deletingDishId === dish.id ? 
                                                                        <><span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Deleting...</> : 
                                                                        <>Delete</>
                                                                    }
                                                                </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default UpdateRestaurantDishForm;