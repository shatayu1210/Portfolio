import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchOrdersByCustomer, fetchOrderDetails } from "../../redux/slices/customer/orderSlice"; 
import { useNavigate } from "react-router-dom";
import NavbarDark from '../Common/NavbarDark';
import "bootstrap/dist/css/bootstrap.min.css"; // Ensure Bootstrap is imported
import "bootstrap-icons/font/bootstrap-icons.css"; // Import Bootstrap Icons

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

const getOrderTypeIcon = (orderType) => {
    return orderType.toLowerCase() === "pickup" 
        ? <i className="bi bi-box-seam me-2"></i>  // Pickup icon
        : <i className="bi bi-truck me-2"></i>;  // Delivery icon
};

const CustomerOrders = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    
    const customerId = useSelector((state) => state.auth.customer?.id);
    const loadingCustomerOrders = useSelector((state) => state.loadingCustomerOrders);
    const orderError = useSelector((state) => state.orderError);
    
    const [orders, setOrders] = useState([]);
    const [expandedOrderId, setExpandedOrderId] = useState(null);
    const [orderDetails, setOrderDetails] = useState(null);

    useEffect(() => {
        if (customerId) {
            dispatch(fetchOrdersByCustomer(customerId))
                .then((response) => {
                    const ordersArray = [...response.payload];
                    const sortedOrders = ordersArray.sort((a, b) => 
                        new Date(b.created_at) - new Date(a.created_at)
                    );
                    setOrders(sortedOrders);
                })
                .catch((error) => console.error("Failed to fetch orders:", error));
        }
    }, [dispatch, customerId]);

    const handleViewDetails = (orderId) => {
        setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
        
        if (expandedOrderId !== orderId) {
            dispatch(fetchOrderDetails(orderId))
                .then((response) => setOrderDetails(response.payload))
                .catch((error) => console.error("Failed to fetch order details:", error));
        } else {
            setOrderDetails(null);
        }
    };

    return (
        <>
        <NavbarDark />
        <button
            className="btn text-dark border-0 d-flex ms-5 align-items-center mt-3 ms-3 fw-bold"
            style={{ backgroundColor: 'transparent' }}
            onClick={() => navigate('/customer/home')}
        >
        <span className="fs-5 me-1">←</span><u>Back to Home</u>
        </button>
        <div className="container mt-4">
            <h2 className="fw-bold ms-0 px-0 mb-3">Orders</h2>
            {loadingCustomerOrders ? (
                <p>Loading order details...</p>
            ) : orderError ? (
                <p className="text-danger">Error: {orderError}</p>
            ) : null}

            <div className="orders-list">
                {orders.length === 0 ? (
                    <p>No orders found</p>
                ) : (
                    <div className="row">
                        {orders.map((order) => (
                            <div key={order.id} className="col-12 mb-3">
                                <div className="card mb-4 shadow-sm border-1 border-light-subtle">
                                    <div className="card-body">
                                        <h5 className="card-title fw-bold">Order #{order.order_number}</h5>
                                        <p className="card-text ms-3 my-0"><strong>Restaurant Name:</strong> {order.Restaurant.name}</p>
                                        <p className="card-text ms-3 my-0"><strong>Restaurant Address:</strong> {order.Restaurant.address}</p>
                                        <p className="card-text ms-3 my-0">
                                            <strong>Status:</strong>
                                            <span className={`badge ${getStatusBadgeClass(order.status)} ms-2`}>
                                                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                            </span>
                                        </p>
                                        <p className="card-text ms-3 my-0">
                                            <strong>Order Type:</strong> 
                                            <span className="ms-2">
                                                {getOrderTypeIcon(order.order_type)}
                                                {order.order_type.charAt(0).toUpperCase() + order.order_type.slice(1).toLowerCase()}
                                            </span>
                                        </p>
                                        <p className="card-text ms-3 mt-3 fs-4 my-0"><strong>Total: ${order.total}</strong></p>
                                        <p className="text-muted fst-italic mt-2 mb-0 py-0">Created At: {new Date(order.created_at).toLocaleString()}</p>
                                        
                                        <button
                                            className="btn btn-dark mt-3"
                                            onClick={() => handleViewDetails(order.id)}
                                        >
                                            {expandedOrderId === order.id ? "Hide Details" : "View Details"}
                                        </button>
                                        
                                        {expandedOrderId === order.id && orderDetails && orderDetails.id === order.id && (
                                            <div className="order-details mt-3">
                                                <h6>Order Items:</h6>
                                                <div className="row">
                                                    {Array.isArray(orderDetails.OrderItems) && orderDetails.OrderItems.length > 0 ? (
                                                        orderDetails.OrderItems.map((item) => (
                                                            <div key={item.id} className="col-12 col-md-3 mb-3">
                                                                <div className="card">
                                                                    <img 
                                                                        src={item.Dish.image_url ? (
                                                                            item.Dish.image_url.startsWith('/uploads/') 
                                                                                ? `http://127.0.0.1:3000${item.Dish.image_url}` 
                                                                                : item.Dish.image_url
                                                                        ) : 'http://127.0.0.1:3000/uploads/blank_dish.png'} 
                                                                        alt={item.Dish.name} 
                                                                        className="card-img-top" 
                                                                        style={{ height: '170px', objectFit: 'cover' }} 
                                                                    />
                                                                    <div className="card-body">
                                                                        <h5 className="card-title">{item.Dish.name}</h5>
                                                                        <p className="card-text">{item.Dish.description}</p>
                                                                        <p className="card-text"><strong>Price:</strong> ${item.price}</p>
                                                                        <p className="card-text"><strong>Quantity:</strong> {item.quantity}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p>No items found for this order.</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
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

export default CustomerOrders;