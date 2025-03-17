// OwnerRestaurantList.jsx
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { fetchOwnerRestaurants } from '../../redux/slices/owner/ownerRestaurantSlice';
import AddRestaurantForm from './AddRestaurantForm';
import UpdateRestaurantForm from './UpdateRestaurantForm';
import UpdateRestaurantDishForm from './UpdateRestaurantDishForm'; // Import the new component
import NavbarDark from '../Common/NavbarDark';
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import { useNavigate } from "react-router-dom";

const OwnerRestaurantList = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const { restaurants, loading, error } = useSelector((state) => state.ownerRestaurants);
    const ownerId = useSelector((state) => state.auth.restaurantOwner?.id);
    const isOwnerAuthenticated = useSelector((state) => state.auth.isOwnerAuthenticated);

    const [showAddForm, setShowAddForm] = useState(false);
    const [showUpdateForm, setShowUpdateForm] = useState(false);
    const [showDishUpdateForm, setShowDishUpdateForm] = useState(false); // State for dish update form
    const [selectedRestaurant, setSelectedRestaurant] = useState(null);

    useEffect(() => {
        if (!isOwnerAuthenticated) {
            navigate("/owner/login");
        }
    }, [isOwnerAuthenticated, navigate]);

    useEffect(() => {
        if (ownerId) {
            dispatch(fetchOwnerRestaurants(ownerId));
        }
    }, [dispatch, ownerId]);

    const handleAddSuccess = (newRestaurant) => {
        setShowAddForm(false);
        if (ownerId) {
            dispatch(fetchOwnerRestaurants(ownerId));
        }
    };

    const handleUpdateSuccess = (updatedRestaurant) => {
        setShowUpdateForm(false);
        setSelectedRestaurant(null);
        if (ownerId) {
            dispatch(fetchOwnerRestaurants(ownerId));
        }
    };

    const handleUpdateDishSuccess = () => {
        setShowDishUpdateForm(false);
        setSelectedRestaurant(null);
    };

    const handleUpdateClick = (restaurant) => {
        setSelectedRestaurant(restaurant);
        setShowUpdateForm(true);
    };

    const handleUpdateDishClick = (restaurant) => {
        setSelectedRestaurant(restaurant);
        setShowDishUpdateForm(true);
    };

    if (loading) {
        return (
            <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    if (error && !error.includes('No Restaurants found')) {
        return (
            <div className="container-fluid py-4">
                <div className="alert alert-danger m-0" role="alert">
                    Error: {error}
                </div>
            </div>
        );
    }

    if (showAddForm) {
        return <AddRestaurantForm 
            onSuccess={handleAddSuccess} 
            onCancel={() => setShowAddForm(false)} 
        />;
    }

    if (showUpdateForm && selectedRestaurant) {
        return <UpdateRestaurantForm 
            restaurant={selectedRestaurant}
            onSuccess={handleUpdateSuccess} 
            onCancel={() => {
                setShowUpdateForm(false);
                setSelectedRestaurant(null);
            }} 
        />;
    }

    if (showDishUpdateForm && selectedRestaurant) {
        return <UpdateRestaurantDishForm 
            restaurant={selectedRestaurant}
            onSuccess={handleUpdateDishSuccess} 
            onCancel={() => {
                setShowDishUpdateForm(false);
                setSelectedRestaurant(null);
            }} 
        />;
    }

    return (
        <>
            <NavbarDark />
            <div className="container-fluid py-4">
                <div className="container">
                    <div className="row align-items-center mb-4">
                        <div className="col-8">
                            <h2 className="mb-0 fw-bold">My Restaurants</h2>
                        </div>
                        <div className="col-4 text-end">
                            <button 
                                className="btn btn-dark rounded-2 text-white"
                                onClick={() => setShowAddForm(true)}
                            >
                                Add Restaurant
                            </button>
                        </div>
                    </div>
                    
                    {restaurants.length === 0 ? (
                        <div className="row justify-content-center">
                            <div className="col-12 col-md-8 text-center py-5">
                                <div className="card border-0">
                                    <div className="card-body py-5">
                                        <h3 className="mb-4">No Restaurants Yet</h3>
                                        <p className="text-muted mb-4">Start your journey by adding your first restaurant</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="row g-4">
                            {restaurants.map((restaurant) => (
                                <div key={restaurant.id} className="col-12 col-sm-6 col-lg-4" style={{ maxWidth: '300px' }}>
                                    <div className="card h-100 border-0 shadow-sm">
                                        <div className="position-relative">
                                            <img 
                                                src={restaurant.image_url ? `http://127.0.0.1:3000${restaurant.image_url}` : 'http://127.0.0.1:3000/uploads/blank_post.png'}
                                                alt={restaurant.name}
                                                className="card-img-top"
                                                style={{ height: '150px', objectFit: 'cover' }}
                                            />
                                        </div>
                                        <div className="card-body">
                                            <h5 className="card-title mb-3"><strong>{restaurant.name}</strong></h5>
                                            <div className="mb-2">
                                                <p className="card-text mb-0">
                                                    <i className="bi bi-geo-alt me-2"></i>
                                                    {restaurant.address}
                                                </p>
                                                <p className="card-text">
                                                    <i className="bi bi-envelope me-2"></i>
                                                    {restaurant.email}
                                                </p>
                                            </div>
                                            <div className="d-flex gap-1 mb-1 ms-0">
                                                <span className="badge text-black ms-0">
                                                    Pickup 
                                                    {restaurant.offers_pickup ? (
                                                        <i className="bi bi-check-circle-fill text-success ms-1"></i>
                                                    ) : (
                                                        <i className="bi bi-x-circle-fill text-danger ms-1"></i>
                                                    )}
                                                </span>

                                                <span className="badge text-black">
                                                    Delivery 
                                                    {restaurant.offers_delivery ? (
                                                        <i className="bi bi-check-circle-fill text-success ms-1"></i>
                                                    ) : (
                                                        <i className="bi bi-x-circle-fill text-danger ms-1"></i>
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="card-footer bg-transparent border-0 pb-3">
                                            <div className="d-grid gap-2">
                                                <Link 
                                                    to={`/owner/restaurants/${restaurant.id}/orders`}
                                                    className="btn btn-dark rounded-2 text-white"
                                                >
                                                    View Orders
                                                </Link>
                                                <button 
                                                    className="btn btn-outline-dark rounded-2"
                                                    onClick={() => handleUpdateClick(restaurant)}
                                                >
                                                    Update Info
                                                </button>
                                                <button 
                                                    className="btn btn-outline-dark rounded-2"
                                                    onClick={() => handleUpdateDishClick(restaurant)}
                                                >
                                                    Manage Dishes
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default OwnerRestaurantList;