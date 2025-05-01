import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { loginRestaurant, checkRestaurantAuth } from "../../redux/slices/auth/authSlice"; // Import Redux action
import "bootstrap/dist/css/bootstrap.min.css";
import NavbarDark from "../Common/NavbarDark";
import Card from 'react-bootstrap/Card'; // Bootstrap Card for consistent form styling
import { Link } from "react-router-dom";


const RestaurantLogin = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const location = useLocation();

    const accountCreated = location.state?.accountCreated || false;

    // Get authentication state from Redux
    const { loading, error, isRestaurantAuthenticated } = useSelector((state) => state.auth);

    // Check if restaurant is already authenticated and redirect
    useEffect(() => {
        dispatch(checkRestaurantAuth()).then(result => {
            if (result.payload?.isRestaurantAuthenticated) {
                navigate("/restaurant/dashboard");
            }
        });
    }, [dispatch, navigate]);

    // Redirect if authenticated status changes
    useEffect(() => {
        if (isRestaurantAuthenticated) {
            navigate("/restaurant/dashboard");
        }
    }, [isRestaurantAuthenticated, navigate]);

    // Local state for form inputs
    const [credentials, setCredentials] = useState({ email: "", password: "" });
    const [loginAttempted, setLoginAttempted] = useState(false);

    // Handle input changes
    const handleChange = (e) => {
        setCredentials({ ...credentials, [e.target.name]: e.target.value });
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoginAttempted(true);
        
        try {
            const result = await dispatch(loginRestaurant(credentials));
            if (result.meta.requestStatus === "fulfilled") {
                // Explicitly check auth status again after login
                await dispatch(checkRestaurantAuth());
                navigate("/restaurant/dashboard");
            }
        } catch (err) {
            console.error("Login Failed!", err);
        }
    };

    return (
        <div className="container-fluid px-4">
            <NavbarDark />
            <button
                className="btn text-dark border-0 d-flex align-items-center mt-3 ms-3 fw-bold"
                style={{ backgroundColor: 'transparent' }}
                onClick={() => navigate('/')}
            >
                <span className="fs-5 me-1">←</span><u>Back</u>
            </button>
            {/* Card wraps the login form for consistent, responsive styling */}
            <Card className="mx-auto mt-4 mb-4 shadow-sm rounded-4 border-2 border-light p-4" style={{ maxWidth: '400px', width: '100%' }}>
              <Card.Body>
                <h3 className="text-center mt-4 mb-4 fw-bold">Log In to Your Restaurant Account</h3>
                {/* Message for Fresh Account */}
                {accountCreated && (
                  <p className="text-center text-success">Account Created Successfully. Please Login.</p>
                )}
                <form onSubmit={handleSubmit}>
                <div className="mb-3">
                    <label htmlFor="email" className="form-label my-0">
                        Email <span className="text-danger">*</span>
                    </label>
                    <input
                        type="email"
                        className="form-control"
                        name="email"
                        value={credentials.email}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div className="mb-3">
                    <label htmlFor="password" className="form-label my-0">
                        Password <span className="text-danger">*</span>
                    </label>
                    <input
                        type="password"
                        className="form-control"
                        name="password"
                        value={credentials.password}
                        onChange={handleChange}
                        required
                    />
                </div>

                {/* Show Error Message If Login Fails */}
                {error && <p className="text-danger text-center">{error}</p>}

                <div className="d-flex justify-content-center mt-4">
                    <button type="submit" className="btn btn-dark ms-2 rounded-1 p-2 w-20" disabled={loading}>
                        {loading ? "Logging in..." : "Log In"}
                    </button>
                </div>
                <div className="d-flex justify-content-center mt-1 text-small">
                    <p className="text-center text-dark">Don't have an account? <Link to="/restaurant/signup" className="text-decoration-underline text-dark">Sign Up</Link></p>
                </div>
                </form>
              </Card.Body>
            </Card>
        </div>
    );
};

export default RestaurantLogin;