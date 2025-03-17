import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { resetOrderStatus } from "../../redux/slices/customer/orderSlice";
import { 
    updateQuantity, 
    removeFromCart, 
    clearCart, 
    selectCartTotal,
} from '../../redux/slices/customer/cartSlice';
import { placeOrder } from '../../redux/slices/customer/orderSlice'
import NavbarDark from '../Common/NavbarDark';

const Cart = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const cartItems = useSelector(state => state.cart.items);
    const cartTotal = useSelector(selectCartTotal);
    const restaurantId = useSelector(state => state.cart.restaurantId);
    const { isCustomerAuthenticated, customer, loading } = useSelector(state => state.auth);
    const { orderStatus, orderError } = useSelector(state => state.order);
    const [error, setError] = useState(null);
    const [orderType, setOrderType] = useState("delivery");

    useEffect(() => {
        if (!loading && !isCustomerAuthenticated) {
            navigate("/customer/login", { state: { signedOut: true } });
        }
    }, [isCustomerAuthenticated, navigate, loading]);

    useEffect(() => {
        dispatch(resetOrderStatus()); // Reset order status when entering cart
    }, [dispatch]);

    // Check order status and redirect after successful order
    useEffect(() => {
        if (orderStatus === 'succeeded') {
            setTimeout(() => {
                dispatch(clearCart()); // Clear the cart
                dispatch(resetOrderStatus());
                navigate('/customer/home');
            }, 2000);
        }
    }, [orderStatus, navigate, dispatch]);

    const handleQuantityChange = (itemId, newQuantity) => {
        if (newQuantity < 1) {
            dispatch(removeFromCart(itemId));
        } else {
            dispatch(updateQuantity({ id: itemId, quantity: newQuantity }));
        }
    };

    const handleRemoveItem = (itemId) => {
        dispatch(removeFromCart(itemId));
    };

    const handleOrderTypeChange = (e) => {
        setOrderType(e.target.value);
    };

    const handlePlaceOrder = () => {
        if (!isCustomerAuthenticated) {
            navigate('/customer/login');
            return;
        }

        if (!customer?.id) {
            setError('Customer information not available');
            return;
        }

        if (!restaurantId) {
            setError('Restaurant information not available');
            return;
        }

        // Format order items for API
        const orderItems = cartItems.map(item => ({
            dish_id: item.id,
            quantity: item.quantity
        }));

        // Create order payload based on the required format
        const orderData = {
            customer_id: customer.id,
            restaurant_id: restaurantId,
            order_type: orderType,
            order_items: orderItems
        };

        console.log('Placing order with data:', orderData);
        dispatch(placeOrder(orderData));
    };

    if (orderStatus === 'succeeded') {
        return (
            <>
                <NavbarDark />
                <div className="container mt-5 text-center">
                    <div className="alert alert-success">
                        <h4>Order placed successfully!</h4>
                        <p>You will be redirected to the home page shortly...</p>
                    </div>
                </div>
            </>
        );
    }

    if (cartItems.length === 0) {
        return (
            <>
                <NavbarDark />
                <div className="container mt-5 text-center">
                    <h2>Your Cart is Empty</h2>
                    <Link to="/customer/home" className="btn btn-dark mt-3">
                        Browse Restaurants
                    </Link>
                </div>
            </>
        );
    }

    return (
        <>
            <NavbarDark />
            <div className="container mt-4">
                <h2 className="mb-2 fw-bold">Your Cart</h2>
                
                {(error || orderError) && 
                    <div className="alert alert-danger">
                        {error || orderError}
                    </div>
                }
                
                <div className="card mb-4">
                    <div className="card-header bg-dark text-white">
                        <div className="row">
                            <div className="col-md-6">Item</div>
                            <div className="col-md-2 text-center">Price</div>
                            <div className="col-md-2 text-center">Quantity</div>
                            <div className="col-md-2 text-center">Subtotal</div>
                        </div>
                    </div>
                    <div className="card-body">
                        {cartItems.map(item => (
                            <div key={item.id} className="row mb-3 align-items-center">
                                <div className="col-md-6 d-flex align-items-center">
                                <img 
                                    src={item.image_url ? (
                                        item.image_url.startsWith('/uploads/') 
                                            ? `http://127.0.0.1:3000${item.image_url}` 
                                            : item.image_url
                                    ) : 'http://127.0.0.1:3000/uploads/blank_dish.png'}
                                    alt={item.name}
                                    style={{ width: '40px', height: '40px', objectFit: 'cover', marginRight: '15px' }}
                                    className="rounded-circle"
                                />
                                    <div>
                                        <h5 className="mb-0">{item.name}</h5>
                                        <button 
                                            className="btn btn-link text-danger p-0 mt-1"
                                            onClick={() => handleRemoveItem(item.id)}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                                <div className="col-md-2 text-center">
                                    ${parseFloat(item.price).toFixed(2)}
                                </div>
                                <div className="col-md-2 text-center">
                                    <div className="d-flex justify-content-center align-items-center">
                                        <button 
                                            className="btn btn-sm btn-outline-dark"
                                            onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                        >
                                            -
                                        </button>
                                        <span className="mx-2">{item.quantity}</span>
                                        <button 
                                            className="btn btn-sm btn-outline-dark"
                                            onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                                <div className="col-md-2 text-center fw-bold">
                                    ${(parseFloat(item.price) * item.quantity).toFixed(2)}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="card-footer">
                        <div className="row">
                            <div className="col-md-8">
                                <div className="form-check mt-2">
                                    <input 
                                        className="form-check-input" 
                                        type="radio" 
                                        name="orderType" 
                                        id="delivery" 
                                        value="delivery" 
                                        checked={orderType === "delivery"}
                                        onChange={handleOrderTypeChange}
                                    />
                                    <label className="form-check-label" htmlFor="delivery">
                                        Delivery
                                    </label>
                                </div>
                                <div className="form-check">
                                    <input 
                                        className="form-check-input" 
                                        type="radio" 
                                        name="orderType" 
                                        id="pickup" 
                                        value="pickup" 
                                        checked={orderType === "pickup"}
                                        onChange={handleOrderTypeChange}
                                    />
                                    <label className="form-check-label" htmlFor="pickup">
                                        Pickup
                                    </label>
                                </div>
                            </div>
                            <div className="col-md-4">
                                <div className="d-flex justify-content-between mb-2">
                                    <h5>Total:</h5>
                                    <h5>${cartTotal}</h5>
                                </div>
                                <button 
                                    className="btn btn-dark w-40"
                                    onClick={handlePlaceOrder}
                                    disabled={orderStatus === 'loading'}
                                >
                                    {orderStatus === 'loading' ? 'Processing...' : 'Place Order'}
                                </button>
                                {!isCustomerAuthenticated && (
                                    <div className="text-danger mt-2 small">
                                        You need to log in to place an order
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                
                <Link to="/customer/home" className="btn">
                    ← <u><strong>Continue Shopping</strong></u>
                </Link>
            </div>
        </>
    );
};

export default Cart;
