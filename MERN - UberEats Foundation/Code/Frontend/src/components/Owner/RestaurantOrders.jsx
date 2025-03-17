import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchOrdersByRestaurant, fetchOrderDetails } from '../../redux/slices/customer/orderSlice';
import NavbarDark from '../Common/NavbarDark';
import axios from 'axios';

const RestaurantOrders = () => {
    const { restaurantId } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const orders = useSelector((state) => state.order.orders);
    const orderDetails = useSelector((state) => state.order.orderDetails);
    const loading = useSelector((state) => state.order.loading);
    const loadingDetails = useSelector((state) => state.order.loadingDetails);
    const error = useSelector((state) => state.order.error);

    const [selectedOrder, setSelectedOrder] = useState(null);
    const [selectedStatus, setSelectedStatus] = useState(''); // State to track selected status
    const [filterStatus, setFilterStatus] = useState(''); // State to track filter status

    const orderStatusOptions = [
        'Pending', 'Processing', 'Out for Delivery', 'Cancelled', 'Delivered'
    ];   

    const isOwnerAuthenticated = useSelector((state) => state.auth.isOwnerAuthenticated);    

    useEffect(() => {
        if (!isOwnerAuthenticated) {
            navigate("/owner/login"); // Redirect to owner login page if not logged in
        }
    }, [isOwnerAuthenticated, navigate]);

    useEffect(() => {
        dispatch(fetchOrdersByRestaurant(restaurantId));
    }, [restaurantId, dispatch]);

    useEffect(() => {
        if (orderDetails) {
            setSelectedStatus(orderDetails.status); // Set initial status when order details are fetched
        }
    }, [orderDetails]);

    const handleOrderClick = async (order) => {
        setSelectedOrder(order);
        await dispatch(fetchOrderDetails(order.id)); // Fetch order details
        setSelectedStatus(order.status); // Reset selectedStatus to the current order's status
    };

    const handleBackClick = () => {
        if (selectedOrder) {
            setSelectedOrder(null); // Clear selectedOrder to go back to the orders list
        } else {
            navigate('/owner/home'); // Navigate to home if no order is selected
        }
    };

    const handleStatusChange = async (event) => {
        const newStatus = event.target.value;
        setSelectedStatus(newStatus); // Update selected status

        try {
            // Send PUT request to update order status
            await axios.put(`http://localhost:3000/api/orders/${selectedOrder.id}`, {
                status: newStatus
            });
            alert('Order status updated successfully!');
        } catch (error) {
            console.error('Error updating order status:', error);
            alert('Failed to update order status');
        }
    };

    const handleFilterChange = (event) => {
        setFilterStatus(event.target.value); // Update filter status
    };

    const getStatusBadgeClass = (status) => {
        switch (status.toLowerCase()) {
            case 'pending':
                return 'bg-warning';
            case 'processing':
                return 'bg-info';
            case 'out for delivery':
                return 'bg-primary';
            case 'cancelled':
                return 'bg-danger';
            case 'delivered':
                return 'bg-success';
            default:
                return 'bg-secondary';
        }
    };

    const formatDate = (dateString) => {
        const options = { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return new Date(dateString).toLocaleDateString(undefined, options);
    };

    const renderOrderDetails = () => {
        if (!orderDetails) return null;

        return (
            <div className="container mt-4">
                <div className="card border-0 shadow-sm">
                    <div className="card-header bg-dark text-white">
                        <div className="d-flex justify-content-between align-items-center">
                            <h5 className="mb-0">Order #{orderDetails.order_number}</h5>
                            <div className="d-flex align-items-center">
                                {/* Dropdown for order status */}
                                <select
                                    className="form-select form-select-sm"
                                    value={selectedStatus} // Default to selectedStatus
                                    onChange={handleStatusChange}
                                >
                                    {orderStatusOptions.map((status) => (
                                        <option key={status} value={status}>
                                            {status}
                                        </option>
                                    ))}
                                </select>
                                <span className={`badge ${getStatusBadgeClass(orderDetails.status)} ms-2`}>
                                    {orderDetails.status.toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="card-body">
                        <div className="row mb-4">
                            <div className="col-md-6">
                                <h6 className="fw-bold">Customer Information</h6>
                                <p className="mb-1">
                                    <i className="bi bi-person me-2"></i>
                                    {orderDetails.Customer.first_name} {orderDetails.Customer.last_name}
                                </p>
                                <p className="mb-1">
                                    <i className="bi bi-geo-alt me-2"></i>
                                    {orderDetails.Customer.address}
                                </p>
                            </div>
                            <div className="col-md-6">
                                <h6 className="fw-bold">Order Information</h6>
                                <p className="mb-1">
                                    <i className="bi bi-calendar me-2"></i>
                                    {formatDate(orderDetails.created_at)}
                                </p>
                                <p className="mb-1">
                                    <i className="bi bi-truck me-2"></i>
                                    {orderDetails.order_type.charAt(0).toUpperCase() + orderDetails.order_type.slice(1)}
                                </p>
                            </div>
                        </div>

                        <h6 className="fw-bold mb-3">Order Items</h6>
                        <div className="table-responsive">
                            <table className="table table-hover">
                                <thead className="table-light">
                                    <tr>
                                        <th>Item</th>
                                        <th>Size</th>
                                        <th>Price</th>
                                        <th>Quantity</th>
                                        <th>Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orderDetails.OrderItems.map((item) => (
                                        <tr key={item.id}>
                                            <td>
                                                <div className="d-flex align-items-center">
                                                    {item.Dish.image_url && (
                                                        <img 
                                                            src={`http://127.0.0.1:3000${item.Dish.image_url}`} 
                                                            alt={item.Dish.name}
                                                            className="me-2"
                                                            style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }}
                                                        />
                                                    )}
                                                    <div>
                                                        <p className="mb-0 fw-bold">{item.Dish.name}</p>
                                                        <small className="text-muted">{item.Dish.description}</small>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{item.size}</td>
                                            <td>${parseFloat(item.price).toFixed(2)}</td>
                                            <td>{item.quantity}</td>
                                            <td>${(parseFloat(item.price) * item.quantity).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="table-light">
                                    <tr>
                                        <td colSpan="4" className="text-end fw-bold">Total:</td>
                                        <td className="fw-bold">${parseFloat(orderDetails.total).toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderOrdersList = () => {
        if (loading) {
            return (
                <div className="d-flex justify-content-center my-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            );
        }

        if (error && !orders.length) {
            return (
                <div className="alert alert-danger" role="alert">
                    {error}
                </div>
            );
        }

        if (!orders.length) {
            return (
                <div className="text-center my-5">
                    <h3 className="fw-bold">No Orders Yet</h3>
                    <p className="text-muted">This restaurant hasn't received any orders yet.</p>
                </div>
            );
        }

        // Filter orders based on selected filter status
        const filteredOrders = filterStatus
            ? orders.filter((order) => order.status.toLowerCase() === filterStatus.toLowerCase())
            : orders;

        return (
            <>
                {/* Status Filter Dropdown */}
                <div className="mb-4">
                    <label htmlFor="statusFilter" className="form-label fw-bold">Filter by Status:</label>
                    <select
                        id="statusFilter"
                        className="form-select w-25"
                        value={filterStatus}
                        onChange={handleFilterChange}
                    >
                        <option value="">All Orders</option>
                        {orderStatusOptions.map((status) => (
                            <option key={status} value={status}>
                                {status}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Orders List */}
                <div className="row g-4">
                    {filteredOrders.map((order) => (
                        <div key={order.id} className="col-12 col-md-6 col-lg-4" style={{ maxWidth: '350px' }}>
                            <div 
                                className="card h-100 border-0 shadow-sm cursor-pointer" 
                                onClick={() => handleOrderClick(order)}
                                style={{ cursor: 'pointer', transition: 'transform 0.2s', }}
                                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                                onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                <div className="card-header bg-light">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <h6 className="mb-0 fw-bold">Order #{order.order_number}</h6>
                                        <span className={`badge ${getStatusBadgeClass(order.status)}`}>
                                            {order.status.toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                                <div className="card-body">
                                    <div className="mb-3">
                                        <p className="card-text mb-1">
                                            <i className="bi bi-person me-2"></i>
                                            {order.Customer.first_name} {order.Customer.last_name}
                                        </p>
                                        <p className="card-text mb-1">
                                            <i className="bi bi-calendar me-2"></i>
                                            {formatDate(order.created_at)}
                                        </p>
                                        <p className="card-text mb-1">
                                            <i className="bi bi-truck me-2"></i>
                                            {order.order_type.charAt(0).toUpperCase() + order.order_type.slice(1)}
                                        </p>
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <span className="fw-bold">Total:</span>
                                        <span className="fw-bold">${parseFloat(order.total).toFixed(2)}</span>
                                    </div>
                                </div>
                                <div className="card-footer bg-transparent text-center">
                                    <button className="btn btn-sm btn-dark rounded-2">
                                        View Details
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </>
        );
    };

    return (
        <>
            <NavbarDark />
            <button
                    className="btn text-dark border-0 d-flex align-items-center mt-0 ms-5 fw-bold"
                    style={{ backgroundColor: 'transparent' }}
                    onClick={handleBackClick}
                >
                <span className="fs-5 me-1">←</span><u>Back to Orders</u>
            </button>
            <div className="container mt-2">
                {selectedOrder ? renderOrderDetails() : renderOrdersList()}
            </div>
        </>
    );
};

export default RestaurantOrders;