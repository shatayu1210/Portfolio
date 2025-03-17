import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import "bootstrap/dist/css/bootstrap.min.css";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { createRestaurantOwner } from "../../redux/slices/owner/ownerSlice"; //
import NavbarDark from "../Common/NavbarDark";
import { validateEmail, validatePhone } from "../../utils/validation";

const OwnerSignup = () => {
    const [owner, setOwner] = useState({
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
    const { loading, error } = useSelector((state) => state.restaurantOwner);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setOwner({ ...owner, [name]: value });
        
        // Clear validation errors when user types
        if (name === 'email' || name === 'phone') {
            setValidationErrors({
                ...validationErrors,
                [name]: ""
            });
        }
    };

    // Handle Pictures through the upload route using multer
    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
    
        const formData = new FormData();
        formData.append("image_url", file);
    
        try {
            const response = await axios.post("http://127.0.0.1:3000/api/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setOwner({ ...owner, image_url: response.data.filePath }); // Storing file path
        } catch (error) {
            console.error("File upload failed", error);
        }
    };

    // Sending json data to reducer
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validate email and phone before submission
        let isValid = true;
        const newValidationErrors = { email: "", phone: "" };
        
        if (!validateEmail(owner.email)) {
            newValidationErrors.email = "Please enter a valid email address";
            isValid = false;
        }
        
        if (!validatePhone(owner.phone)) {
            newValidationErrors.phone = "Please enter a valid 10-digit phone number";
            isValid = false;
        }
        
        if (!isValid) {
            setValidationErrors(newValidationErrors);
            return;
        }
        
        console.log("Submitting restaurant owner data:", owner);
        await dispatch(createRestaurantOwner(owner));
        navigate("/owner/login", { state: { accountCreated: true } });
    };

    return (
        <div className="container-fluid px-0">
            <NavbarDark />
            {/* Back Button */}
            <button className="btn text-dark border-0 d-flex align-items-center mt-3 ms-3 fw-bold" 
                style={{ backgroundColor: 'transparent' }} 
                onClick={() => navigate('/')}>
                <span className="fs-5 me-1">←</span><u>Back to Home</u>
            </button>
            <h3 className="text-center mt-4 mb-4 fw-bold">Create an Owner Account</h3>
            {loading && <p className="text-center text-primary">Loading...</p>}
            {error && <p className="text-center text-danger">{error.message || "An error occurred"}</p>}

            <form onSubmit={handleSubmit} className="w-50 mx-auto">
                <div className="row">
                    <div className="col-md-6">
                        <div className="mb-3">
                            <label htmlFor="first_name" className="form-label my-0">
                                First Name <span className="text-danger">*</span>
                            </label>
                            <input type="text" className="form-control" name="first_name" value={owner.first_name} onChange={handleChange} required />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="phone" className="form-label my-0">
                                Phone <span className="text-danger">*</span>
                            </label>
                            <input 
                                type="tel" 
                                className="form-control" 
                                name="phone" 
                                value={owner.phone} 
                                onChange={handleChange} 
                                pattern="[0-9]*" 
                                inputMode="numeric"
                                required 
                            />
                            {validationErrors.phone && <div className="text-danger">{validationErrors.phone}</div>}
                        </div>
                        <div className="mb-3">
                            <label htmlFor="email" className="form-label my-0">
                                Email <span className="text-danger">*</span>
                            </label>
                            <input type="email" className="form-control" name="email" value={owner.email} onChange={handleChange} required />
                            {validationErrors.email && <div className="text-danger">{validationErrors.email}</div>}
                        </div>
                        <div className="mb-3">
                            <label htmlFor="password" className="form-label my-0">
                                Password <span className="text-danger">*</span>
                            </label>
                            <input type="password" className="form-control" name="password" value={owner.password} onChange={handleChange} required />
                        </div>
                    </div>

                    <div className="col-md-6">
                        <div className="mb-3">
                            <label htmlFor="last_name" className="form-label my-0">
                                Last Name <span className="text-danger">*</span>
                            </label>
                            <input type="text" className="form-control" name="last_name" value={owner.last_name} onChange={handleChange} required />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="date_of_birth" className="form-label my-0">
                                Date of Birth <span className="text-danger">*</span>
                            </label>
                            <input type="date" className="form-control" name="date_of_birth" value={owner.date_of_birth} onChange={handleChange} required />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="address" className="form-label my-0">
                                Address <span className="text-danger">*</span>
                            </label>
                            <input type="text" className="form-control" name="address" value={owner.address} onChange={handleChange} required />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="image_url" className="form-label my-0">
                                Upload a Profile Picture (Optional)
                            </label>
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

export default OwnerSignup;
