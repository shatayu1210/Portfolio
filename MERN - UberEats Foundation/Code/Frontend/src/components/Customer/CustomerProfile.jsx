import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import { fetchCustomer, updateCustomer } from "../../redux/slices/customer/customerSlice";
import "bootstrap/dist/css/bootstrap.min.css";
import NavbarDark from "../Common/NavbarDark";
import axios from "axios"; // Ensure you import axios
import { validateEmail, validatePhone } from "../../utils/validation";
axios.defaults.withCredentials = true;

const CustomerEditProfile = () => {
    const { id } = useParams();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { customer, loading, error, success } = useSelector((state) => state.customer);
    const authCustomer = useSelector((state) => state.auth.customer);
    
    const [formData, setFormData] = useState({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        date_of_birth: "",
        address: "",
        image_url: null,
    });
    
    const [validationErrors, setValidationErrors] = useState({
        email: "",
        phone: ""
    });
    
    const [updateSuccess, setUpdateSuccess] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);

    useEffect(() => {
        // Use ID from params or from auth state
        const customerId = id || authCustomer?.id;
        if (customerId) {
            console.log("Fetching customer data for ID:", customerId);
            // Fetch customer details when component mounts
            dispatch(fetchCustomer(customerId));
        } else {
            console.warn("No customer ID available for fetching");
        }
    }, [dispatch, id, authCustomer]);

    useEffect(() => {
        if (customer) {
            console.log("Received customer data:", customer);
            
            // Format date properly - handle different date formats
            let formattedDateOfBirth = "";
            if (customer.date_of_birth) {
                try {
                    // Try to parse the date and format it to YYYY-MM-DD
                    const date = new Date(customer.date_of_birth);
                    if (!isNaN(date.getTime())) {
                        formattedDateOfBirth = date.toISOString().split('T')[0];
                    } else {
                        console.warn("Invalid date format received:", customer.date_of_birth);
                    }
                } catch (error) {
                    console.error("Error formatting date:", error);
                }
            }

            // Pre-fill form with customer data
            setFormData({
                first_name: customer.first_name || "",
                last_name: customer.last_name || "",
                email: customer.email || "",
                phone: customer.phone || "",
                date_of_birth: formattedDateOfBirth,
                address: customer.address || "",
                image_url: customer.image_url || null,
            });
            
            console.log("Form data initialized with date:", formattedDateOfBirth);
        } else {
            console.warn("No customer data received yet");
        }
    }, [customer]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prevState) => ({
            ...prevState,
            [name]: value,
        }));
        
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

        setUploadLoading(true);
        const formData = new FormData();
        formData.append("image_url", file);

        try {
            const response = await axios.post("/api/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" },
                withCredentials: true
            });
            
            console.log("File upload response:", response.data);
            
            setFormData((prevState) => ({
                ...prevState,
                image_url: response.data.filePath,
            }));
            
        } catch (error) {
            console.error("File upload failed", error);
            alert("Failed to upload file. Please try again.");
        } finally {
            setUploadLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setUpdateSuccess(false);
        
        // Validate email and phone before submission
        let isValid = true;
        const newValidationErrors = { email: "", phone: "" };
        
        if (!validateEmail(formData.email)) {
            newValidationErrors.email = "Please enter a valid email address";
            isValid = false;
        }
        
        if (!validatePhone(formData.phone)) {
            newValidationErrors.phone = "Please enter a valid 10-digit phone number";
            isValid = false;
        }
        
        if (!isValid) {
            setValidationErrors(newValidationErrors);
            return;
        }
        
        // Get the customer ID - ensure using the customer object's ID directly if available
        const customerId = customer?.id || id || authCustomer?.id;
        
        if (!customerId) {
            console.error("Customer ID is missing, cannot update profile");
            alert("Error: Customer ID is missing. Please try again later.");
            return;
        }
        
        // Form validation
        if (!formData.first_name || !formData.last_name || !formData.email || 
            !formData.phone || !formData.address || !formData.date_of_birth) {
            alert("Please fill in all required fields");
            return;
        }
        
        // Create a copy of formData without modifying the state directly
        const dataToSubmit = {...formData};
        
        // If image_url is null or empty, don't include it in the submission
        if (!dataToSubmit.image_url) {
            delete dataToSubmit.image_url;
        }
        
        // Format date to ensure it's in YYYY-MM-DD format
        if (dataToSubmit.date_of_birth) {
            try {
                const date = new Date(dataToSubmit.date_of_birth);
                if (!isNaN(date.getTime())) {
                    dataToSubmit.date_of_birth = date.toISOString().split('T')[0];
                }
            } catch (error) {
                console.error("Error formatting date for submission:", error);
            }
        }
        
        console.log("Final data being dispatched:", { customerId, customerData: dataToSubmit });
        dispatch(updateCustomer({ 
            customerId: customerId.toString(),
            customerData: dataToSubmit 
        }))
        .unwrap()
        .then((response) => {
            console.log("Update successful:", response);
            setUpdateSuccess(true);
            // Redirect after a short delay
            setTimeout(() => {
                navigate('/customer/home');
            }, 1500); // 1.5 second delay to show success message
        })
        .catch((error) => {
            console.error("Error updating profile:", error);
            // Display specific error message if available
            if (typeof error === 'string') {
                alert(`Failed to update profile: ${error}`);
            } else {
                alert("Failed to update profile. Please ensure all required fields are filled correctly.");
            }
            setUpdateSuccess(false);
        });
    };

    return (
        <div className="container-fluid px-0">
            <NavbarDark />
            <button
                className="btn text-dark border-0 d-flex align-items-center mt-3 ms-3 fw-bold"
                style={{ backgroundColor: "transparent" }}
                onClick={() => navigate("/customer/home")}
            >
                <span className="fs-5 me-1">←</span><u>Back to Home</u>
            </button>
            <h3 className="text-center mt-4 mb-4 fw-bold">Edit Customer Profile</h3>

            {loading && <p className="text-center text-primary">Loading...</p>}
            {error && <p className="text-center text-danger">{error}</p>}
            {updateSuccess && <div className="alert alert-success text-center">Profile Updated Successfully! Redirecting...</div>}

            <form onSubmit={handleSubmit} className="w-50 mx-auto">
                <div className="row">
                    <div className="col-md-6">
                        <div className="mb-3">
                            <label htmlFor="first_name">First Name</label>
                            <input
                                type="text"
                                className="form-control"
                                name="first_name"
                                value={formData.first_name}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="phone">Phone</label>
                            <input
                                type="tel"
                                className="form-control"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                pattern="[0-9]*"
                                inputMode="numeric"
                                required
                            />
                            {validationErrors.phone && <div className="text-danger">{validationErrors.phone}</div>}
                        </div>
                        <div className="mb-3">
                            <label htmlFor="email">Email</label>
                            <input
                                type="email"
                                className="form-control"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                            {validationErrors.email && <div className="text-danger">{validationErrors.email}</div>}
                        </div>
                    </div>

                    <div className="col-md-6">
                        <div className="mb-3">
                            <label htmlFor="last_name">Last Name</label>
                            <input
                                type="text"
                                className="form-control"
                                name="last_name"
                                value={formData.last_name}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="date_of_birth">Date of Birth</label>
                            <input
                                type="date"
                                className="form-control"
                                name="date_of_birth"
                                value={formData.date_of_birth}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="address">Address</label>
                            <input
                                type="text"
                                className="form-control"
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="image_url">Replace Profile Picture</label>
                            <div className="d-flex align-items-center">
                                <input
                                    type="file"
                                    className="form-control me-3"
                                    name="image_url"
                                    onChange={handleFileChange}
                                />
                                {formData.image_url && (
                                    <img
                                        src={formData.image_url.startsWith('/') ? `http://localhost:3000${formData.image_url}` : formData.image_url}
                                        alt="Profile Preview"
                                        className="img-thumbnail"
                                        style={{ width: "50px", height: "50px", objectFit: "cover" }}
                                    />
                                )}
                            </div>
                            <small className="text-muted">Profile picture is optional</small>
                        </div>
                    </div>
                </div>
                <div className="d-flex justify-content-center">
                    <button 
                        type="submit" 
                        className="btn btn-dark ms-2 rounded-1 p-2 w-20"
                        disabled={loading || uploadLoading}
                    >
                        {loading ? "Updating..." : uploadLoading ? "Uploading Image..." : "Update Profile"}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CustomerEditProfile;