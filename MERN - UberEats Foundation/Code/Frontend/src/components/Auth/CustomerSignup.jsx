import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import axios from "axios";
import { useDispatch, useSelector, shallowEqual } from "react-redux";
import { createCustomer } from "../../redux/slices/customer/customerSlice";
import NavbarDark from "../Common/NavbarDark";
import { validateEmail, validatePhone } from "../../utils/validation";

const CustomerSignup = () => {
    const [customer, setCustomer] = useState({
        first_name: "",
        last_name: "",
        email: "",
        password: "",
        phone: "",
        date_of_birth: "",
        address: "",
        image_url: null,
    });

    const [validationErrors, setValidationErrors] = useState({
        email: "",
        phone: ""
    });

    const dispatch = useDispatch();
    const navigate = useNavigate();
    
    const { loading, error, success } = useSelector(
        (state) => state.customer,
        shallowEqual
    );

    const handleChange = (e) => {
        const { name, value } = e.target;
        setCustomer({ ...customer, [name]: value });
        
        // Clear validation errors when user types
        if (name === 'email' || name === 'phone') {
            setValidationErrors({
                ...validationErrors,
                [name]: ""
            });
        }
    };

    // Handle File Upload
    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("image_url", file);

        try {
            const response = await axios.post("http://127.0.0.1:3000/api/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setCustomer({ ...customer, image_url: response.data.filePath }); // Saving file path
        } catch (error) {
            console.error("File upload failed", error);
        }
    };

    // Handle Form Submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validate email and phone before submission
        let isValid = true;
        const newValidationErrors = { email: "", phone: "" };
        
        if (!validateEmail(customer.email)) {
            newValidationErrors.email = "Please enter a valid email address";
            isValid = false;
        }
        
        if (!validatePhone(customer.phone)) {
            newValidationErrors.phone = "Please enter a valid 10-digit phone number";
            isValid = false;
        }
        
        if (!isValid) {
            setValidationErrors(newValidationErrors);
            return;
        }
        
        console.log("Submitting customer data:", customer); 
    
        const result = await dispatch(createCustomer(customer));
    
        if (result.meta.requestStatus === "fulfilled") {
            console.log("Signup Successful!", result.payload); 
            navigate("/customer/login", { state: { accountCreated: true } });
        } else {
            console.error("Signup Failed!", result.payload);
        }
    };
    

    return (
        <div className="container-fluid px-0">
            <NavbarDark />
            <button
                className="btn text-dark border-0 d-flex align-items-center mt-3 ms-3 fw-bold"
                style={{ backgroundColor: "transparent" }}
                onClick={() => navigate("/")}
            >
                <span className="fs-5 me-1">←</span><u>Back to Home</u>
            </button>
            <h3 className="text-center mt-4 mb-4 fw-bold">Create an Account</h3>

            {loading && <p className="text-center text-primary">Loading...</p>}
            {error && <p className="text-center text-danger">{error}</p>}
            {success && <p className="text-center text-success">Signup Successful! Redirecting...</p>}

            <form onSubmit={handleSubmit} className="w-50 mx-auto">
                <div className="row">
                    <div className="col-md-6">
                        <div className="mb-3">
                            <label htmlFor="first_name">First Name <span className="text-danger">*</span></label>
                            <input type="text" className="form-control" name="first_name" value={customer.first_name} onChange={handleChange} required />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="phone">Phone <span className="text-danger">*</span></label>
                            <input 
                                type="tel" 
                                className="form-control" 
                                name="phone" 
                                value={customer.phone} 
                                onChange={handleChange} 
                                pattern="[0-9]*" 
                                inputMode="numeric"
                                required 
                            />
                            {validationErrors.phone && <div className="text-danger">{validationErrors.phone}</div>}
                        </div>
                        <div className="mb-3">
                            <label htmlFor="email">Email <span className="text-danger">*</span></label>
                            <input type="email" className="form-control" name="email" value={customer.email} onChange={handleChange} autoComplete="username" required />
                            {validationErrors.email && <div className="text-danger">{validationErrors.email}</div>}
                        </div>
                        <div className="mb-3">
                            <label htmlFor="password">Password <span className="text-danger">*</span></label>
                            <input type="password" className="form-control" name="password" value={customer.password} onChange={handleChange} autoComplete="current-password" required />
                        </div>
                    </div>

                    <div className="col-md-6">
                        <div className="mb-3">
                            <label htmlFor="last_name">Last Name <span className="text-danger">*</span></label>
                            <input type="text" className="form-control" name="last_name" value={customer.last_name} onChange={handleChange} required />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="date_of_birth">Date of Birth <span className="text-danger">*</span></label>
                            <input type="date" className="form-control" name="date_of_birth" value={customer.date_of_birth} onChange={handleChange} required />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="address">Address <span className="text-danger">*</span></label>
                            <input type="text" className="form-control" name="address" value={customer.address} onChange={handleChange} required />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="image_url">Upload a Profile Picture (Optional)</label>
                            <input type="file" className="form-control" name="image_url" onChange={handleFileChange} />
                        </div>
                    </div>
                </div>

                <div className="d-flex justify-content-center">
                    <button type="submit" className="btn btn-dark ms-2 rounded-1 p-2 w-20">
                        {loading ? "Signing Up..." : "Sign Up"}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CustomerSignup;