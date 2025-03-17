import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { loginRestaurantOwner, checkOwnerAuth } from "../../redux/slices/auth/authSlice"; // Import Redux action
import "bootstrap/dist/css/bootstrap.min.css";
import NavbarDark from "../Common/NavbarDark";

const OwnerLogin = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const location = useLocation();

    const accountCreated = location.state?.accountCreated || false;

    // Get authentication state from Redux
    const { loading, error, isOwnerAuthenticated } = useSelector((state) => state.auth);

    // Check if owner is already authenticated and redirect
    useEffect(() => {
        dispatch(checkOwnerAuth()).then(result => {
            if (result.payload?.isAuthenticated) {
                navigate("/owner/home");
            }
        });
    }, [dispatch, navigate]);

    // Redirect if authenticated status changes
    useEffect(() => {
        if (isOwnerAuthenticated) {
            navigate("/owner/home");
        }
    }, [isOwnerAuthenticated, navigate]);

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
            const result = await dispatch(loginRestaurantOwner(credentials));
            if (result.meta.requestStatus === "fulfilled") {
                // Explicitly check auth status again after login
                await dispatch(checkOwnerAuth());
                navigate("/owner/home");
            }
        } catch (err) {
            console.error("Login Failed!", err);
        }
    };

    return (
        <div className="container-fluid px-0">
            <NavbarDark />
            <button
                className="btn text-dark border-0 d-flex align-items-center mt-3 ms-3 fw-bold"
                style={{ backgroundColor: 'transparent' }}
                onClick={() => navigate('/')}
            >
                <span className="fs-5 me-1">←</span><u>Back to Home</u>
            </button>
            <h3 className="text-center mt-4 mb-4 fw-bold">Log In to Your Owner Account</h3>

            {/* Message for Fresh Account */}
            {accountCreated && (
                <p className="text-center text-success">Account Created Successfully. Please Login.</p>
            )}

            <form className="w-25 mx-auto" onSubmit={handleSubmit}>
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

                <div className="d-flex justify-content-center">
                    <button type="submit" className="btn btn-dark ms-2 rounded-1 p-2 w-20" disabled={loading}>
                        {loading ? "Logging in..." : "Log In"}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default OwnerLogin;