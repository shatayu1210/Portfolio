import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { FaUtensils, FaClock, FaMapMarkerAlt } from "react-icons/fa";
import EditProfileModal from './EditProfileModal';
import { 
    fetchRestaurant, 
    fetchRestaurantOrders,
    toggleDelivery, 
    togglePickup,
    updateOrder,
    updateRestaurantProfile
} from '../../redux/slices/restaurant/restaurantSlice';
import NavbarDark from '../Common/NavbarDark';
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import { useNavigate } from "react-router-dom";
import { Modal, Button, Dropdown, OverlayTrigger, Popover, Table, Spinner, Form } from 'react-bootstrap';
import axios from '../../config/axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


const DEFAULT_IMAGE_PLACEHOLDER = "https://res.cloudinary.com/dvylvq84d/image/upload/v1744151036/ImagePlaceholder_gg1xob.png";

// CSS for status pill toggle
const statusToggleStyles = `
.status-pill-toggle {
  position: relative;
  display: inline-flex;
  background-color: #f8f8f8;
  border-radius: 30px;
  padding: 3px;
  width: 180px;
  height: 38px;
  cursor: pointer;
  margin-left: 15px;
  border: 1px solid #e0e0e0;
}

.status-pill-toggle-option {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1;
  font-size: 0.9rem;
  font-weight: 500;
  color: #555;
  transition: color 0.3s;
}

.status-pill-toggle-option.active {
  color: #fff;
}

.status-pill-toggle-slider {
  position: absolute;
  left: 3px;
  top: 3px;
  bottom: 3px;
  width: calc(50% - 3px);
  border-radius: 30px;
  transition: transform 0.3s, background-color 0.3s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  background-color: #dc3545; /* Dark red for inactive */
}

.status-pill-toggle[data-active="active"] .status-pill-toggle-slider {
  transform: translateX(calc(100% + 0px));
  background-color: #28a745; /* Green for active */
}

.status-pill-toggle.loading {
  opacity: 0.7;
  pointer-events: none;
}

.tooltip {
  position: relative;
  display: inline-block;
}

.tooltip .tooltiptext {
  visibility: hidden;
  width: 200px;
  background-color: rgba(0,0,0,0.8);
  color: #fff;
  text-align: center;
  border-radius: 6px;
  padding: 5px;
  position: absolute;
  z-index: 1;
  bottom: 125%;
  left: 50%;
  transform: translateX(-50%);
  opacity: 0;
  transition: opacity 0.3s;
  font-size: 0.8rem;
}

.tooltip:hover .tooltiptext {
  visibility: visible;
  opacity: 1;
}
`;

const getStatusBadgeClass = (status) => {
    switch (status) {
        case 'new': return 'bg-primary text-white';
        case 'received': return 'bg-info text-white';
        case 'preparing': return 'bg-warning text-dark';
        case 'on_the_way': return 'bg-secondary text-white';
        case 'pickup_ready': return 'bg-dark text-white';
        case 'delivered': return 'bg-success text-white';
        case 'picked_up': return 'bg-success text-white';
        case 'cancelled': return 'bg-danger text-white';
        default: return 'bg-light text-dark';
    }
};

const RestaurantDashboard = () => {

    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
        transports: ['websocket'],
    });

    // State for showing/hiding the change password modal
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

    // State for password fields
    const [restaurantPassword, setRestaurantPassword] = useState({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });

    // State for password validation criteria
    const [restaurantPasswordCriteria, setRestaurantPasswordCriteria] = useState({
      length: false,
      uppercase: false,
      lowercase: false,
      number: false,
      special: false
    });

    const [validationErrors, setValidationErrors] = useState({
        password: ""
    });

    // State for error/success/loading
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState(false);
    const [restaurantPasswordLoading, setRestaurantPasswordLoading] = useState(false);

    // Validate password criteria for new password
    const validateRestaurantPassword = (password) => {
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
      const isLongEnough = password && password.length >= 6;
      setRestaurantPasswordCriteria({
        length: isLongEnough,
        uppercase: hasUpperCase,
        lowercase: hasLowerCase,
        number: hasNumber,
        special: hasSpecialChar
      });
      return isLongEnough && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
    };

    // Handle input changes for password fields
    const handleRestaurantPasswordInputChange = (e) => {
      const { name, value } = e.target;
      setRestaurantPassword((prev) => ({ ...prev, [name]: value }));
      if (name === 'newPassword') {
        validateRestaurantPassword(value);
      }
    };

    const restaurantId = useSelector((state) => state.auth.restaurant?.id);
    
    // Handle restaurant password change submit using Redux thunk
    const handleRestaurantPasswordChange = async (e) => {
      e.preventDefault();

      // Reset errors
      setValidationErrors({ ...validationErrors, password: "" });
      setPasswordError("");
      setPasswordSuccess(false);
      setRestaurantPasswordLoading(true);

      // Validate password fields
      if (!restaurantPassword.currentPassword) {
        setValidationErrors({ ...validationErrors, password: "Current password is required" });
        setRestaurantPasswordLoading(false);
        return;
      }
      if (!validateRestaurantPassword(restaurantPassword.newPassword)) {
        setValidationErrors({ ...validationErrors, password: "New password must meet all requirements" });
        setRestaurantPasswordLoading(false);
        return;
      }
      if (restaurantPassword.newPassword !== restaurantPassword.confirmPassword) {
        setValidationErrors({ ...validationErrors, password: "Passwords don't match" });
        setRestaurantPasswordLoading(false);
        return;
      }
      try {
        // Use updateRestaurantProfile thunk for password update
        // Only send password fields, backend should handle password change
        await dispatch(updateRestaurantProfile({
          restaurantId,
          restaurantData: {
            currentPassword: restaurantPassword.currentPassword,
            newPassword: restaurantPassword.newPassword
          }
        })).unwrap();
        setPasswordSuccess(true);
        setRestaurantPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setRestaurantPasswordCriteria({ length: false, uppercase: false, lowercase: false, number: false, special: false });
        setTimeout(() => setShowChangePasswordModal(false), 1500);
      } catch (err) {
        console.error("Error updating password:", err);
        setValidationErrors({
            ...validationErrors, 
            password: typeof err === 'string' ? err : "Failed to update password"
        });
      } finally {
        setRestaurantPasswordLoading(false);
      }
    };


    // State for Edit Profile modal
    const [showEditProfileModal, setShowEditProfileModal] = useState(false);
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const { restaurant, loading, error, orders, ordersStatus, ordersError } = useSelector((state) => state.restaurant);
    
    // For debugging
    // useEffect(() => {
    //     console.log('Current orders: ', orders);
    // }, [orders]);
    
    const [isTogglingStatus, setIsTogglingStatus] = useState(false);
    const [statusToggleError, setStatusToggleError] = useState(null);
    const hasAvailableDishes = restaurant?.dishes?.some(dish => dish.isAvailable);
    const shouldDisableStatusToggle = restaurant?.status === 'inactive' && !hasAvailableDishes;

    // Local loading states to avoid full-page spinner on toggle
    const [deliveryLoading, setDeliveryLoading] = useState(false);
    const [pickupLoading, setPickupLoading] = useState(false);

    // --- Operating Hours Modal State and Handlers ---
    const [showOperatingHoursModal, setShowOperatingHoursModal] = useState(false);
    const [operatingHours, setOperatingHours] = useState({
        monday: { open: '', close: '', isClosed: false },
        tuesday: { open: '', close: '', isClosed: false },
        wednesday: { open: '', close: '', isClosed: false },
        thursday: { open: '', close: '', isClosed: false },
        friday: { open: '', close: '', isClosed: false },
        saturday: { open: '', close: '', isClosed: false },
        sunday: { open: '', close: '', isClosed: false },
    });
    const [savingHours, setSavingHours] = useState(false);
    const [hoursError, setHoursError] = useState('');
    const [hoursSuccess, setHoursSuccess] = useState('');

    const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
    const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);
    // Track which order is updating status
    const [updatingOrderId, setUpdatingOrderId] = useState(null);
    // Show temporary status change info
    const [statusChangeInfo, setStatusChangeInfo] = useState(null);

    const [sortBy, setSortBy] = useState('latest');
    const [filterTypes, setFilterTypes] = useState([]);
    const [filterStatuses, setFilterStatuses] = useState([]);
    // Helpers for filter dropdowns
    const toggleFilterType = type => setFilterTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
    const toggleFilterStatus = status => setFilterStatuses(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
    const clearFilters = () => { setSortBy('latest'); setFilterTypes([]); setFilterStatuses([]); };
    const isFiltered = sortBy !== 'latest' || filterTypes.length > 0 || filterStatuses.length > 0;

    // Show temporary success message when profile is updated
    const [showProfileSuccess, setShowProfileSuccess] = useState(false);
    const handleProfileUpdate = () => {
        setShowProfileSuccess(true);
        setTimeout(() => setShowProfileSuccess(false), 3000);
    };

    // Refetch orders on new socket order event
    useEffect(() => {
        socket.on('new_order', (order) => {
            toast(`New Order: ${order.orderNumber} received!`,
                {position: 'top-center',
                autoClose: 5000,
                className: 'custom-toast-light',
                progressClassName: 'custom-progress-dark'
            });
          dispatch(fetchRestaurantOrders(restaurantId));
        });
    
        return () => {
          socket.off('new_order');
        };
    }, []);

    useEffect(() => {
        if (restaurantId) {
            dispatch(fetchRestaurant(restaurantId));
        }
    }, [dispatch, restaurantId]);

    useEffect(() => {
        if (restaurant?.operatingHours) {
            setOperatingHours(restaurant.operatingHours);
        }
    }, [restaurant]);

    // Fetch restaurant orders on mount
    useEffect(() => {
        if (restaurantId) {
            dispatch(fetchRestaurantOrders(restaurantId));
        }
    }, [dispatch, restaurantId]);

    // Listen for order cancellation socket event
    useEffect(() => {
        if (!socket) return;
        socket.on('order_cancelled', (cancelEvent) => {
            toast.warn(cancelEvent.event || `Order ${cancelEvent.orderNumber} has been cancelled by customer!`, {
                position: 'top-center',
                autoClose: 5000,
                className: 'custom-toast-light',
                progressClassName: 'custom-progress-dark',
            });
            // Optionally, refetch orders if needed:
            dispatch(fetchRestaurantOrders(restaurantId));
        });
        // Clean up
        return () => {
            socket.off('order_cancelled');
        };
    }, [socket, dispatch, restaurantId]);

    const handleUpdateDishClick = () => {
        navigate('/restaurant/dishes');
    };

    const handleToggleDelivery = async () => {
        if (!restaurantId) return;
        setDeliveryLoading(true);
        try {
            await dispatch(toggleDelivery(restaurantId)).unwrap();
        } catch (err) {
            console.error('Delivery toggle error:', err);
        } finally {
            setDeliveryLoading(false);
        }
    };

    const handleTogglePickup = async () => {
        if (!restaurantId) return;
        setPickupLoading(true);
        try {
            await dispatch(togglePickup(restaurantId)).unwrap();
        } catch (err) {
            console.error('Pickup toggle error:', err);
        } finally {
            setPickupLoading(false);
        }
    };

    // Custom status toggle handler - uses direct API call instead of Redux action
    const handleToggleStatus = async () => {
        if (!restaurantId || isTogglingStatus) return;
        
        setIsTogglingStatus(true);
        setStatusToggleError(null);
        
        try {
            await axios.put(`/api/restaurants/status/${restaurantId}`);
            
            // Update local state to avoid complete reload
            dispatch(fetchRestaurant(restaurantId));
        } catch (error) {
            console.error('Error toggling restaurant status:', error);
            setStatusToggleError('Failed to update restaurant status');
        } finally {
            setIsTogglingStatus(false);
        }
    };

    const handleOperatingHoursClick = () => {
        setShowOperatingHoursModal(true);
        setHoursError('');
        setHoursSuccess('');
    };

    // Update a specific day's open/close time
    const handleTimeChange = (day, field, value) => {
        setOperatingHours(prev => ({
            ...prev,
            [day]: { ...prev[day], [field]: value }
        }));
    };

    // Toggle closed state for a day
    const handleClosedChange = (day, isClosed) => {
        setOperatingHours(prev => ({
            ...prev,
            [day]: {
                ...prev[day],
                isClosed,
                open: isClosed ? '' : prev[day].open,
                close: isClosed ? '' : prev[day].close
            }
        }));
    };

    const handleSaveOperatingHours = async (e) => {
        e.preventDefault();
        setSavingHours(true);
        setHoursError('');
        setHoursSuccess('');
        try {
            await axios.put(
                `/api/restaurants/operating-hours/${restaurantId}`,
                { operatingHours }
            );
            setHoursSuccess('Operating hours updated successfully!');
            setShowOperatingHoursModal(false);
            dispatch(fetchRestaurant(restaurantId));
        } catch (err) {
            console.error('Error updating operating hours:', err);
            setHoursError(err.response?.data?.message || 'Failed to update operating hours. Please try again.');
        } finally {
            setSavingHours(false);
        }
    };

    const handleStatusChange = (orderId, newStatus, isDelivery) => {
        let restaurantNote = '';
        if (newStatus === 'cancelled') {
            restaurantNote = window.prompt('Please provide a cancellation note for the customer:');
            if (!restaurantNote) return;
        }
        // save previous for message
        const prevStatus = orders.find(o => o.id === orderId)?.status;
        setUpdatingOrderId(orderId);
        dispatch(updateOrder({ orderId, status: newStatus, restaurantNote }))
            .unwrap()
            .then(() => {
                setUpdatingOrderId(null);
                setStatusChangeInfo({ orderId, from: prevStatus.replace('_', ' '), to: newStatus.replace('_', ' '), isVisible: true });
                // After visible duration, start fade-out
                setTimeout(() => {
                    setStatusChangeInfo(prev => prev ? { ...prev, isVisible: false } : null);
                    // Remove notice after fade-out
                    setTimeout(() => setStatusChangeInfo(null), 200);
                }, 2000);
            })
            .catch(() => setUpdatingOrderId(null));
    };

    if (loading && !restaurant) {
        return (
            <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center">
                <div className="spinner-border text-success" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container-fluid py-4">
                <div className="alert alert-danger m-0" role="alert">
                    Error: {error}
                </div>
            </div>
        );
    }

    // If no restaurant data is available, show loading spinner
    if (!restaurant) {
        return (
            <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center">
                <div className="spinner-border text-success" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    // Format the address if it exists
    const formattedAddress = restaurant.address && typeof restaurant.address === 'object' ? 
        `${restaurant.address.street}, ${restaurant.address.city}, ${restaurant.address.state} ${restaurant.address.zipCode}, ${restaurant.address.country}` : 
        'Address not available';

    // apply sort & filter before rendering
    const displayedOrders = orders
        .filter(o => (filterTypes.length === 0 || filterTypes.includes(o.isDelivery ? 'delivery' : 'pickup'))
                 && (filterStatuses.length === 0 || filterStatuses.includes(o.status)))
        .sort((a, b) => {
            const ta = Date.parse(a.createdAt), tb = Date.parse(b.createdAt);
            return sortBy === 'latest' ? tb - ta : ta - tb;
        });

    return (
        <>
            <style>{statusToggleStyles}</style>
            <NavbarDark />
            <ToastContainer />
            {showProfileSuccess && (
                <div className="container mt-3 mb-3">
                    <div className="alert alert-success">
                        Updated Profile Successfully
                    </div>
                </div>
            )}
            <div className="container-fluid py-2 mb-0">
                <div className="container">
                    <div className="row">
                        <div className="col-12 col-md-12 col-lg-12 mx-auto">
                            {/* Restaurant Name and Main Controls */}
                            <div className="card mb-4 border-2 border-light rounded-4 shadow-sm">
                                <div className="card-body p-4">
                                    <div className="d-flex align-items-center mb-3">
                                        {/* Restaurant Image */}
                                        <img 
                                            src={restaurant.imageUrl || DEFAULT_IMAGE_PLACEHOLDER}
                                            alt={restaurant.name}
                                            className="rounded-circle me-3"
                                            style={{ 
                                                width: '70px', 
                                                height: '70px', 
                                                objectFit: 'cover',
                                                border: '1px solid #dee2e6'
                                            }}
                                            onError={(e) => {
                                                e.target.onerror = null; // Prevent infinite loop
                                                e.target.src = DEFAULT_IMAGE_PLACEHOLDER;
                                            }}
                                        />
                                        
                                        <h2 className="fw-bold mb-0">{restaurant.name}</h2>
                                        {/* Status Toggle Pill */}
                                        <div style={{ cursor: shouldDisableStatusToggle ? 'not-allowed' : 'pointer' }}>
                                            <div 
                                                className={`status-pill-toggle${isTogglingStatus ? ' loading' : ''}${shouldDisableStatusToggle ? ' disabled' : ''}`} 
                                                data-active={restaurant.status}
                                                onClick={!shouldDisableStatusToggle ? handleToggleStatus : undefined}
                                                style={{
                                                    opacity: shouldDisableStatusToggle ? 0.6 : 1,
                                                    pointerEvents: shouldDisableStatusToggle ? 'none' : 'auto',
                                                    cursor: shouldDisableStatusToggle ? 'not-allowed' : 'pointer',
                                                    position: 'relative'
                                                }}
                                            >
                                                <div className={`status-pill-toggle-option ${restaurant.status !== 'active' ? 'active' : ''}`}>
                                                    Inactive
                                                </div>
                                                <div className={`status-pill-toggle-option ${restaurant.status === 'active' ? 'active' : ''}`}>
                                                    Active
                                                </div>
                                                <div className="status-pill-toggle-slider"></div>
                                                {isTogglingStatus && (
                                                    <div className="position-absolute w-100 h-100 d-flex justify-content-center align-items-center" style={{zIndex: 2}}>
                                                        <div className="spinner-border spinner-border-sm text-success" role="status">
                                                            <span className="visually-hidden">Loading...</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {shouldDisableStatusToggle && (
                                                    <span className="tooltiptext" style={{
                                                        visibility: 'visible',
                                                        opacity: 1,
                                                        position: 'absolute',
                                                        left: '50%',
                                                        bottom: '110%',
                                                        transform: 'translateX(-50%)',
                                                        backgroundColor: 'rgba(0,0,0,0.8)',
                                                        color: '#fff',
                                                        borderRadius: '6px',
                                                        padding: '5px',
                                                        zIndex: 10,
                                                        fontSize: '0.7rem',
                                                        width: '270px',
                                                        textAlign: 'center',
                                                    }}>
                                                        You must have at least one available dish.
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {statusToggleError && (
                                        <div className="alert alert-danger">
                                            Error: {statusToggleError}
                                        </div>
                                    )}
                                    
                                    <div className="d-flex align-items-center mb-0">
                                        {/* Restaurant Description */}
                                        <div className="mb-0">
                                            <p className="mb-1 fst-italic">{restaurant.description}</p>
                                            <p className="mb-1"><strong><i className="bi bi-envelope-fill"></i></strong> {restaurant.email}</p>
                                            <p className="mb-1"><strong><i className="bi bi-telephone-fill"></i></strong> {restaurant.phone}</p>
                                            <p className="mb-0"><strong><FaMapMarkerAlt /></strong> {formattedAddress}</p>
                                            {/* Horizontal container for Edit and Change Password links */}
                                            <div className="d-flex gap-3 align-items-center mt-2 mb-2">
                                                <a className="text-decoration-underline text-success fw-medium m-0" style={{ cursor: 'pointer', fontSize: '0.9rem' }} onClick={() => setShowEditProfileModal(true)}><strong>Edit Information</strong></a>
                                                <a className="text-decoration-underline text-success fw-medium m-0" style={{ cursor: 'pointer', fontSize: '0.9rem' }} onClick={() => setShowChangePasswordModal(true)}><strong>Change Password</strong></a>
                                            </div>
                                            {/* Restaurant Change Password Modal */}
                                            {showChangePasswordModal && (
                                                <div className="modal show d-block" tabIndex="-1" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
                                                    <div className="modal-dialog modal-dialog-centered">
                                                        <div className="modal-content rounded-5 px-2 py-2">
                                                            <div className="modal-header border-bottom-0">
                                                                <h5 className="modal-title fw-semibold">Change Password</h5>
                                                                <button type="button" className="btn-close" onClick={() => setShowChangePasswordModal(false)}></button>
                                                            </div>
                                                            <div className="modal-body px-4 py-3">
                                                                {validationErrors.password && (
                                                                    <div className="alert alert-danger">{validationErrors.password}</div>
                                                                )}
                                                                {passwordSuccess && (
                                                                    <div className="alert alert-success">Password changed successfully!</div>
                                                                )}
                                                                <form onSubmit={handleRestaurantPasswordChange}>
                                                                    <div className="mb-3">
                                                                        <label htmlFor="currentPassword" className="form-label">Current Password</label>
                                                                        <input type="password" className="form-control" id="currentPassword" name="currentPassword" value={restaurantPassword.currentPassword} onChange={handleRestaurantPasswordInputChange} required />
                                                                    </div>
                                                                    <div className="mb-3">
                                                                        <label htmlFor="newPassword" className="form-label">New Password</label>
                                                                        <input type="password" className="form-control" id="newPassword" name="newPassword" value={restaurantPassword.newPassword} onChange={handleRestaurantPasswordInputChange} required />
                                                                        <div className="password-criteria mt-2">
                                                                            <small className={`d-block ${restaurantPasswordCriteria.length ? 'text-success' : 'text-muted'}`}><i className={`bi ${restaurantPasswordCriteria.length ? 'bi-check-circle-fill' : 'bi-circle'}`}></i> At least 6 characters</small>
                                                                            <small className={`d-block ${restaurantPasswordCriteria.uppercase ? 'text-success' : 'text-muted'}`}><i className={`bi ${restaurantPasswordCriteria.uppercase ? 'bi-check-circle-fill' : 'bi-circle'}`}></i> One uppercase letter</small>
                                                                            <small className={`d-block ${restaurantPasswordCriteria.lowercase ? 'text-success' : 'text-muted'}`}><i className={`bi ${restaurantPasswordCriteria.lowercase ? 'bi-check-circle-fill' : 'bi-circle'}`}></i> One lowercase letter</small>
                                                                            <small className={`d-block ${restaurantPasswordCriteria.number ? 'text-success' : 'text-muted'}`}><i className={`bi ${restaurantPasswordCriteria.number ? 'bi-check-circle-fill' : 'bi-circle'}`}></i> One number</small>
                                                                            <small className={`d-block ${restaurantPasswordCriteria.special ? 'text-success' : 'text-muted'}`}><i className={`bi ${restaurantPasswordCriteria.special ? 'bi-check-circle-fill' : 'bi-circle'}`}></i> One special character</small>
                                                                        </div>
                                                                    </div>
                                                                    <div className="mb-3">
                                                                        <label htmlFor="confirmPassword" className="form-label">Re-enter New Password</label>
                                                                        <input 
                                                                            type="password" 
                                                                            className="form-control" 
                                                                            id="confirmPassword" 
                                                                            name="confirmPassword" 
                                                                            value={restaurantPassword.confirmPassword} 
                                                                            onChange={handleRestaurantPasswordInputChange} 
                                                                            required 
                                                                        />
                                                                        {/* Real-time password matching indicator */}
                                                                        {restaurantPassword.newPassword && restaurantPassword.confirmPassword && 
                                                                            restaurantPassword.newPassword !== restaurantPassword.confirmPassword && (
                                                                            <small className="text-danger">Passwords don't match</small>
                                                                        )}
                                                                    </div>
                                                                    <div className="d-flex justify-content-end">
                                                                        <button type="button" className="btn btn-outline-dark me-2" onClick={() => setShowChangePasswordModal(false)}>Cancel</button>
                                                                        {/*
                                                                        Enable the submit button only if:
                                                                        - The current password is not empty
                                                                        - The new and confirm passwords match
                                                                        - Not currently loading
                                                                        */}
                                                                        <button 
                                                                            type="submit" 
                                                                            className="btn btn-dark" 
                                                                            disabled={
                                                                                restaurantPasswordLoading ||
                                                                                !restaurantPassword.currentPassword ||
                                                                                !restaurantPassword.newPassword ||
                                                                                !restaurantPassword.confirmPassword ||
                                                                                restaurantPassword.newPassword !== restaurantPassword.confirmPassword
                                                                            }
                                                                        >
                                                                            {restaurantPasswordLoading ? 'Updating...' : 'Update Password'}
                                                                        </button>
                                                                    </div>
                                                                </form>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>


                                    <div className="d-flex flex-wrap align-items-center justify-content-between mb-0 p-0">
                                        <div className="d-flex flex-wrap gap-4 align-items-center">
                                            {/* Delivery Toggle */}
                                            <div className="d-flex align-items-center">
                                                <span className="me-2">Delivery</span>
                                                {deliveryLoading && <Spinner animation="border" size="sm" className="ms-2 text-muted" />}
                                                <div className="form-check form-switch mb-0" style={{ cursor: 'pointer' }}>
                                                    <input 
                                                        className="form-check-input" 
                                                        type="checkbox" 
                                                        role="switch" 
                                                        id="deliveryToggle" 
                                                        checked={restaurant.offersDelivery}
                                                        onChange={handleToggleDelivery}
                                                        style={{
                                                            backgroundColor: restaurant.offersDelivery ? '#1b1b1b' : '#c0c0c0',
                                                            borderColor: restaurant.offersDelivery ? '#1b1b1b' : '#c0c0c0',
                                                            width: '3em',
                                                            height: '1.5em',
                                                            cursor: 'pointer'
                                                        }}
                                                    />
                                                </div>
                                                
                                            </div>

                                            {/* Pickup Toggle */}
                                            <div className="d-flex align-items-center">
                                                <span className="me-2">Pickup</span>
                                                {pickupLoading && <Spinner animation="border" size="sm" className="ms-2 text-muted" />}
                                                <div className="form-check form-switch mb-0" style={{ cursor: 'pointer' }}>
                                                    <input 
                                                        className="form-check-input" 
                                                        type="checkbox" 
                                                        role="switch" 
                                                        id="pickupToggle" 
                                                        checked={restaurant.offersPickup}
                                                        onChange={handleTogglePickup}
                                                        style={{
                                                            backgroundColor: restaurant.offersPickup ? '#1b1b1b' : '#c0c0c0',
                                                            borderColor: restaurant.offersPickup ? '#1b1b1b' : '#c0c0c0',
                                                            width: '3em',
                                                            height: '1.5em',
                                                            cursor: 'pointer'
                                                        }}
                                                    />
                                                </div>
                                                
                                            </div>

                                            {/* Manage Dishes Button */}
                                            <button 
                                                onClick={handleUpdateDishClick}
                                                className="btn btn-outline-dark rounded-pill py-1 px-3"
                                            >
                                                <div className="d-flex align-items-center">
                                                    <i className="bi bi-journal-text me-2"></i>
                                                    <span>Manage Dishes</span>
                                                </div>
                                            </button>

                                            {/* Update Operating Hours Button */}
                                            <button 
                                                onClick={handleOperatingHoursClick}
                                                className="btn btn-outline-dark rounded-pill py-1 px-3"
                                            >
                                                <div className="d-flex align-items-center">
                                                    <i className="bi bi-clock me-2"></i>
                                                    <span>Update Hours</span>
                                                </div>
                                            </button>

                                            {/* Track Performance Button */}
                                            <button 
                                                onClick={() => navigate('/restaurant/performance')}
                                                className="btn btn-outline-dark rounded-pill py-1 px-3"
                                            >
                                                <div className="d-flex align-items-center">
                                                    <i className="bi bi-graph-up me-2"></i>
                                                    <span>Track Performance</span>
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>


            {/* Orders List Section */}
            <div className="container mt-0">
                <div className="d-flex align-items-center justify-content-start flex-wrap mb-3">
                    <h3 className="fw-bold me-3">Orders</h3>
                    <Dropdown className="me-3 mb-2">
                        <Dropdown.Toggle variant="bg-white rounded-pill py-1 px-3" id="sort-by-dropdown" style={{border: '1px solid #c0c0c0'}}>
                            Sort By: {sortBy === 'latest' ? 'Latest' : 'Oldest'}
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                            <div className="dropdown-animate">
                                <Dropdown.Item onClick={() => setSortBy('latest')} className={sortBy === 'latest' ? 'text-dark fw-bold bg-light' : ''}>Latest</Dropdown.Item>
                                <Dropdown.Item onClick={() => setSortBy('oldest')} className={sortBy === 'oldest' ? 'text-dark fw-bold bg-light' : ''}>Oldest</Dropdown.Item>
                            </div>
                        </Dropdown.Menu>
                    </Dropdown>
                    <Dropdown className="me-3 mb-2">
                        <Dropdown.Toggle variant="bg-white rounded-pill py-1 px-3" id="filter-type-dropdown" style={{border: '1px solid #c0c0c0'}}>Filter By Type</Dropdown.Toggle>
                        <Dropdown.Menu className="px-3">
                            <div className="dropdown-animate">
                                <Form.Check inline type="checkbox" id="type-pickup" label="Pickup" checked={filterTypes.includes('pickup')} onChange={() => toggleFilterType('pickup')} className="my-1" />
                                <Form.Check inline type="checkbox" id="type-delivery" label="Delivery" checked={filterTypes.includes('delivery')} onChange={() => toggleFilterType('delivery')} className="my-1" />
                            </div>
                        </Dropdown.Menu>
                    </Dropdown>
                    <Dropdown className="me-3 mb-2">
                        <Dropdown.Toggle variant="bg-white rounded-pill py-1 px-3" id="filter-status-dropdown" style={{border: '1px solid #c0c0c0'}}>Filter By Status</Dropdown.Toggle>
                        <Dropdown.Menu className="px-3" style={{minWidth: '200px'}}>
                            <div className="dropdown-animate">
                                {['new','received','preparing','pickup_ready','picked_up','on_the_way','delivered','cancelled'].map(st => (
                                    <Form.Check key={st} inline type="checkbox" id={`status-${st}`} label={st[0].toUpperCase() + st.slice(1).replaceAll('_',' ')} checked={filterStatuses.includes(st)} onChange={() => toggleFilterStatus(st)} className="my-1" />
                                ))}
                            </div>
                        </Dropdown.Menu>
                    </Dropdown>
                    {isFiltered && (<span className="text-success text-decoration-underline" style={{ cursor: 'pointer' }} onClick={clearFilters}>Clear all</span>)}
                </div>
                {ordersStatus === 'loading' ? (
                    <div className="text-center py-4">
                        <div className="spinner-border text-success" role="status"><span className="visually-hidden">Loading orders...</span></div>
                        <p className="mt-2">Loading orders...</p>
                    </div>
                ) : ordersError ? (
                    <div className="alert alert-danger">Error: {ordersError}</div>
                ) : displayedOrders.length === 0 ? (
                    <div className="alert alert-light w-fit">
                        {isFiltered ? (
                            <>
                            No orders match your filter selection. Please{' '}
                            <a onClick={clearFilters} className="text-decoration-underline text-muted" style={{ cursor: 'pointer' }}>
                                clear
                            </a>{' '}
                            your selection or try another filter.
                            </>
                        ) : (
                            'No orders for your restaurant yet.'
                        )}
                    </div>
                ) : (
                    <div className="row g-3">
                        {displayedOrders.map(order => (
                            <div key={order.id} className="col-md-6 mb-1">
                                <div
                                    className="card rounded-4 h-100 pb-2"
                                    style={{ 
                                        position: 'relative', 
                                        cursor: 'pointer', 
                                        transition: 'transform 0.2s, box-shadow 0.2s', 
                                        overflow: 'visible' 
                                    }}
                                    onClick={() => { setSelectedOrderDetails(order); setShowOrderDetailsModal(true); }}
                                    onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.1)'; }}
                                    onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
                                >
                                    {/* Temporary status change notice */}
                                    {statusChangeInfo && statusChangeInfo.orderId === order.id && (
                                        <div className="position-absolute rounded-top-4 w-100 text-center py-3"
                                            style={{
                                                top: 0,
                                                left: 0,
                                                zIndex: 5000,
                                                backgroundColor: 'rgba(23, 23, 23, 1)',
                                                color: '#fff',
                                                fontSize: '1rem',
                                                opacity: statusChangeInfo.isVisible ? 1 : 0,
                                                transition: 'opacity 0.5s ease-in-out'
                                            }}>
                                            Status changed from <strong>{statusChangeInfo.from.replace(/_/g, ' ').toUpperCase()}</strong> to <strong>{statusChangeInfo.to.replace(/_/g, ' ').toUpperCase()}</strong>
                                        </div>
                                    )}
                                    {/* Card header */}
                                    <div className="card-header rounded-4 mb-0 bg-white border-bottom-0 py-0 pt-2 px-3">
                                        <div className="d-flex flex-wrap justify-content-between align-items-center">
                                            <h5 className="card-title fw-bold mb-0 me-auto">#{order.orderNumber}</h5>
                                            {order.customerNote && (
                                                <OverlayTrigger
                                                    trigger="click"
                                                    placement="bottom-start"
                                                    flip={false}
                                                    rootClose
                                                    container={document.body}
                                                    overlay={
                                                        <Popover id={`popover-note-${order.id}`}>
                                                            <Popover.Body>{order.customerNote}</Popover.Body>
                                                        </Popover>
                                                    }
                                                >
                                                    <span onClick={e => e.stopPropagation()} className="badge text-white me-1 py-1" style={{ cursor: 'pointer', backgroundColor: 'rgb(0, 97, 133)' }}>
                                                        <i className="bi bi-info-circle me-1" style={{ fontSize: '0.6rem' }}></i>Customer Note
                                                    </span>
                                                </OverlayTrigger>
                                            )}
                                            <div>
                                                <span className="badge text-dark rounded-2 px-2 py-1 me-1" style={{ border: '1px solid lightgray' }}>
                                                    {order.isDelivery ? <><i className="bi bi-truck me-1"></i> Delivery</> : <><i className="bi bi-box-seam me-1"></i> Pickup</>}
                                                </span>
                                                {updatingOrderId === order.id ? (
                                                    <Spinner animation="border" size="sm" className="ms-2 text-success" />
                                                ) : (
                                                    <Dropdown
                                                        onClick={e => e.stopPropagation()}
                                                        onSelect={newStatus => handleStatusChange(order.id, newStatus, order.isDelivery)}
                                                        className="d-inline-block"
                                                        disabled={order.cancelledByCustomer}
                                                        style={{ cursor: order.cancelledByCustomer ? 'not-allowed' : 'pointer', opacity: order.cancelledByCustomer ? 0.5 : 1 }}
                                                    >
                                                        <Dropdown.Toggle
                                                            as="button"
                                                            type="button"
                                                            id={`status-dropdown-${order.id}`}
                                                            className={`badge ${getStatusBadgeClass(order.status)} rounded-2 px-2 py-1`}
                                                            disabled={order.cancelledByCustomer}
                                                        >
                                                            {order.status.replace(/_/g, ' ').toUpperCase()}
                                                        </Dropdown.Toggle>
                                                        <Dropdown.Menu>
                                                            <div className="dropdown-animate">
                                                                {(order.isDelivery
                                                                    ? ['new','received','preparing','on_the_way','delivered','cancelled']
                                                                    : ['new','received','preparing','pickup_ready','picked_up','cancelled']
                                                                ).map(st => (
                                                                    <Dropdown.Item
                                                                        eventKey={st}
                                                                        key={st}
                                                                        disabled={st === order.status}
                                                                        style={st === order.status ? { cursor: 'not-allowed' } : undefined}
                                                                    >
                                                                        {st.replace(/_/g, ' ').toUpperCase()}
                                                                    </Dropdown.Item>
                                                                ))}
                                                            </div>
                                                        </Dropdown.Menu>
                                                    </Dropdown>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="d-flex flex-column align-items-between mb-0 py-0">
                                            {/* Placed on text */}
                                            <div className="d-flex align-items-center mb-0 py-0">
                                                <p className="text-muted small fst-italic my-1"><FaClock className="me-1 mb-0 mb-0 text-secondary" size={12}/>Placed on: {new Date(order.createdAt).toLocaleString()}</p>
                                            </div>
                                            {/* Cancelled by Customer conditional text */}
                                            {order?.cancelledByCustomer && (
                                                <p className="text-danger small fst-italic mb-1"><i className="bi bi-x-circle me-1 mb-0 text-danger" style={{ fontSize: 12 }}/>Order Cancelled By Customer</p>
                                            )}
                                            {/* Restaurant note if any*/}
                                            {order?.restaurantNote && order?.status === "cancelled" && (
                                                <OverlayTrigger
                                                    trigger="click"
                                                    placement="bottom-start"
                                                    flip={false}
                                                    rootClose
                                                    container={document.body}
                                                    overlay={
                                                        <Popover id={`popover-cancel-${order.id}`}>
                                                            <Popover.Body>{order.restaurantNote}</Popover.Body>
                                                        </Popover>
                                                    }
                                                >
                                                    <span
                                                        onClick={e => e.stopPropagation()}
                                                        className="text-danger small me-1 mb-1"
                                                        style={{ cursor: 'pointer' }}
                                                    >
                                                        <i className="bi bi-x-circle me-1" style={{ fontSize: 12 }}></i><u>Cancelled by Restaurant</u>
                                                    </span>
                                                </OverlayTrigger>
                                            )}

                                            {/* Delivery address if any*/}
                                            {order?.isDelivery && order?.deliveryAddress && (
                                                <div className="d-flex align-items-center mb-0">
                                                    <p className="small mb-1">
                                                        <FaMapMarkerAlt className="me-1 mb-1" size={13}/>
                                                        <span className="text-dark me-1 fw-bold">Deliver to:</span>
                                                        {order.deliveryAddress.street}, {order.deliveryAddress.city}, {order.deliveryAddress.state} {order.deliveryAddress.zipCode}, {order.deliveryAddress.country}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {/* Card body */}
                                    <div className="card-body pt-0 px-3 py-2 my-0">
                                        <hr className="border border-1 opacity-50 my-1"/>
                                        <div className="d-flex justify-content-between align-items-center mb-0">
                                            <p className="mb-0 fw-semibold"><FaUtensils className="me-1" size={12} />Total Items: {order?.totalItems}</p>
                                            <OverlayTrigger
                                                trigger="click"
                                                placement="bottom-start"
                                                flip={false}
                                                popperConfig={{ modifiers: [{ name: 'offset', options: { offset: [0, 8] } }] }}
                                                container={document.body}
                                                overlay={
                                                    <Popover id={`popover-financials-${order.id}`}>
                                                    <Popover.Body>
                                                        <div><strong>Subtotal:</strong> ${order?.financials?.subtotal?.toFixed(2)}</div>
                                                        <div><strong>Tax Rate:</strong> {order?.financials?.taxRate}%</div>
                                                        <div><strong>Tax Amount:</strong> ${order?.financials?.taxAmount?.toFixed(2)}</div>
                                                        <div><strong>Delivery Fee:</strong> ${order?.financials?.deliveryFee?.toFixed(2) || '0.00'}</div>
                                                        <div><strong>Total Amount:</strong> ${order?.financials?.totalAmount?.toFixed(2)}</div>
                                                    </Popover.Body>
                                                    </Popover>
                                                }
                                                >
                                                <span
                                                    onClick={e => e.stopPropagation()}
                                                    className="fs-6 fw-medium text-dark"
                                                    style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                                >
                                                    ${order?.financials?.totalAmount?.toFixed(2)}
                                                </span>
                                            </OverlayTrigger>
                                        </div>
                                        {/* Order Items Overview */}
                                        <div className="order-items pt-0 mt-0">
                                            <div className="row">
                                                <div className="col-md-8">
                                                    <ul className="list-unstyled small mb-0">
                                                        {order.items.slice(0,2).map((item, idx) => (
                                                            <li key={idx} className="mb-1">
                                                                • {item.name}{item.size ? ` (${item.size})` : ''} × {item.quantity}
                                                            </li>
                                                        ))}
                                                        {order.items.length > 2 && (
                                                            <li className="text-muted" style={{ textDecoration: 'underline' }}>
                                                                +{order.items.length - 2} more item(s)
                                                            </li>
                                                        )}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="d-flex justify-content-center align-items-center">
                                        <span className="text-muted small fst-italic"><i className="bi bi-info-circle me-1"></i>Click to view order details</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>


            {/* Operating Hours Modal */}
            <Modal show={showOperatingHoursModal} onHide={() => setShowOperatingHoursModal(false)} size="lg" centered contentClassName="rounded-5 py-2 px-3">
                <Modal.Header closeButton>
                    <Modal.Title className="fw-bold">Update Operating Hours</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {/* Allows updating weekly operating hours */}
                    <form onSubmit={handleSaveOperatingHours}>
                        {Object.keys(operatingHours).map(day => (
                            <div className="mb-3 row align-items-center" key={day}>
                                <label className="col-12 col-sm-3 col-form-label text-capitalize fw-medium">{day}</label>
                                <div className="col-12 col-sm-9 d-flex flex-wrap align-items-center gap-2 custom-modal-width">
                                    <div className="form-check me-2">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id={`${day}-closed`}
                                            checked={operatingHours[day].isClosed}
                                            onChange={e => handleClosedChange(day, e.target.checked)}
                                        />
                                        <label className="form-check-label" htmlFor={`${day}-closed`}>Closed</label>
                                    </div>
                                    <div className="time-input-container me-1" style={{ minWidth: '100px', maxWidth: '140px' }}>
                                        <input
                                            type="time"
                                            className="form-control form-control-sm"
                                            disabled={operatingHours[day].isClosed}
                                            value={operatingHours[day].open}
                                            onChange={e => handleTimeChange(day, 'open', e.target.value)}
                                            style={{ colorScheme: 'light', cursor: 'text', width: '100%' }}
                                        />
                                    </div>
                                    <span className="mx-1">to</span>
                                    <div className="time-input-container me-1" style={{ minWidth: '100px', maxWidth: '140px' }}>
                                        <input
                                            type="time"
                                            className="form-control form-control-sm"
                                            disabled={operatingHours[day].isClosed}
                                            value={operatingHours[day].close}
                                            onChange={e => handleTimeChange(day, 'close', e.target.value)}
                                            style={{ colorScheme: 'light', cursor: 'text', width: '100%' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {hoursError && <div className="alert alert-danger my-2">{hoursError}</div>}
                        {hoursSuccess && <div className="alert alert-success my-2">{hoursSuccess}</div>}
                    </form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="outline-dark rounded-5 py-1 px-3" onClick={() => setShowOperatingHoursModal(false)}>Cancel</Button>
                    <Button variant="dark rounded-5 py-1 px-3" onClick={handleSaveOperatingHours} disabled={savingHours}>{savingHours ? 'Saving...' : 'Save'}</Button>
                </Modal.Footer>
            </Modal>
            {/* Order Details Modal */}
            <Modal show={showOrderDetailsModal} onHide={() => setShowOrderDetailsModal(false)} size="lg" centered contentClassName="rounded-5 px-4 py-2 z-index-000">
                <Modal.Header closeButton className="border-0 pb-0">
                    <Modal.Title className="fw-bold">{selectedOrderDetails ? `Order #${selectedOrderDetails.orderNumber}` : 'Order Details'}</Modal.Title>
                </Modal.Header>
                <Modal.Body className="pt-0 mt-2">
                    {selectedOrderDetails && (
                        <>
                            {/* Customer Details Section */}
                            <div className="border-0 rounded-3 mb-3">
                                <div className="card-body">
                                    <div className="row">
                                        <div className="col-12 col-sm-9">
                                            <h6 className="fw-bold mb-2 mt-4 fs-5">Customer Details</h6>
                                            <p className="mb-1"><strong>Name:</strong> {selectedOrderDetails.customer.name}</p>
                                            <p className="mb-1"><strong>Email:</strong> {selectedOrderDetails.customer.email}</p>
                                            <p className="mb-0"><strong>Phone:</strong> {selectedOrderDetails.customer.phone}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* Order Items Section */}
                            <div className="border-0 rounded-3 mb-2">
                                <div className="card-body">
                                    <h6 className="fw-bold mb-2 mt-4 fs-5">Order Items</h6>
                                    <div className="table-responsive ms-2">
                                        <table className="table table-hover">
                                            <thead className="table-secondary">
                                                <tr>
                                                    <th>Item</th>
                                                    <th>Size</th>
                                                    <th>Price</th>
                                                    <th>Quantity</th>
                                                    <th className="text-end">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedOrderDetails.items.map((item, idx) => (
                                                    <tr key={idx}>
                                                        <td>{item.name}</td>
                                                        <td>{item.size || '-'}</td>
                                                        <td>${item.price.toFixed(2)}</td>
                                                        <td>{item.quantity}</td>
                                                        <td className="text-end">${item.totalPrice.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                            {/* Order Summary Section */}
                            <div className="order-summary">
                                <div className="row justify-content-end">
                                    <div className="col-md-5">
                                        <div className="card shadow-sm border-0 rounded-3">
                                            <div className="card-body">
                                                <h6 className="fw-bold mb-2">
                                                    <i className="bi bi-receipt me-2"></i> Order Summary
                                                </h6>
                                                <div className="d-flex justify-content-between mb-2">
                                                    <span>Subtotal:</span>
                                                    <span>${selectedOrderDetails.financials.subtotal.toFixed(2)}</span>
                                                </div>
                                                <div className="d-flex justify-content-between mb-2">
                                                    <span>Tax ({selectedOrderDetails.financials.taxRate}%):</span>
                                                    <span>${selectedOrderDetails.financials.taxAmount.toFixed(2)}</span>
                                                </div>
                                                {selectedOrderDetails.financials.deliveryFee !== null && (
                                                    <div className="d-flex justify-content-between mb-2">
                                                        <span>
                                                            Delivery Fee
                                                            {selectedOrderDetails.financials.deliveryFee === 0 && (
                                                                <span className="badge bg-success ms-2 small">FREE</span>
                                                            )}
                                                        </span>
                                                        <span>${selectedOrderDetails.financials.deliveryFee.toFixed(2)}</span>
                                                    </div>
                                                )}
                                                <div className="d-flex justify-content-between fw-bold">
                                                    <span>Total:</span>
                                                    <span>${selectedOrderDetails.financials.totalAmount.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>

                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="outline-dark rounded-5 py-1 px-3" onClick={() => setShowOrderDetailsModal(false)}>Close</Button>
                </Modal.Footer>
            </Modal>
            {/* Edit Profile Modal for updating restaurant info */}
            <EditProfileModal
                show={showEditProfileModal}
                handleClose={() => setShowEditProfileModal(false)}
                onUpdateSuccess={handleProfileUpdate}
            />
        </>
    );
};

export default RestaurantDashboard;