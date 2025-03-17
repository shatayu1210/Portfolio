import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import { fetchOwner, updateOwner } from "../../redux/slices/owner/ownerSlice";
import "bootstrap/dist/css/bootstrap.min.css";
import NavbarDark from "../Common/NavbarDark";
import axios from "axios";
import { validateEmail, validatePhone } from "../../utils/validation";

axios.defaults.withCredentials = true;

const OwnerEditProfile = () => {
    const { id } = useParams();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { owner, loading, error } = useSelector((state) => state.restaurantOwner);
    const isOwnerAuthenticated = useSelector((state) => state.auth.isOwnerAuthenticated);

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

    useEffect(() => {
        if (!isOwnerAuthenticated) {
            navigate("/owner/login"); // Redirect to owner login page if not logged in
        }
    }, [isOwnerAuthenticated, navigate]);

    useEffect(() => {
        if (id) {
            dispatch(fetchOwner(id));
        }
    }, [dispatch, id]);

    useEffect(() => {
        if (owner) {
            setFormData({
                first_name: owner.first_name || "",
                last_name: owner.last_name || "",
                email: owner.email || "",
                phone: owner.phone || "",
                date_of_birth: owner.date_of_birth ? new Date(owner.date_of_birth).toISOString().split('T')[0] : "",
                address: owner.address || "",
                image_url: owner.image_url || null,
            });
        }
    }, [owner]);

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

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
    
        const formData = new FormData();
        formData.append("image_url", file);
    
        try {
            const response = await axios.post("http://127.0.0.1:3000/api/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            
            setFormData((prevState) => ({
                ...prevState,
                image_url: response.data.filePath,
            }));

        } catch (error) {
            console.error("File upload failed", error);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
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
        
        if (!id) {
            alert("Owner ID is missing!");
            return;
        }
        console.log('Submitting the following data:', formData);  // Logging form data

        dispatch(updateOwner({ ownerId: id, ownerData: formData }))
            .unwrap()
            .then(() => {
                alert("Profile updated successfully!");
                navigate("/owner/home");
            })
            .catch((error) => {
                alert("Failed to update profile: " + error);
            });
    };

    return (
        <div className="container-fluid px-0">
            <NavbarDark />
            <button className="btn text-dark border-0 d-flex align-items-center mt-3 ms-3 fw-bold" 
                style={{ backgroundColor: 'transparent' }} 
                onClick={() => navigate('/owner/home')}>
                <span className="fs-5 me-1">←</span><u>Back</u>
            </button>
            <h3 className="text-center mt-4 mb-4 fw-bold">Edit Profile</h3>
            {loading && <p className="text-center text-primary">Loading...</p>}
            {error && <p className="text-center text-danger">{error.message || "An error occurred"}</p>}

            <form onSubmit={handleSubmit} className="w-50 mx-auto">
                <div className="row">
                    <div className="col-md-6">
                        <div className="mb-3">
                            <label className="form-label">First Name *</label>
                            <input type="text" className="form-control" name="first_name" value={formData.first_name} onChange={handleChange} required />
                        </div>
                        <div className="mb-3">
                            <label className="form-label">Phone *</label>
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
                            <label className="form-label">Email *</label>
                            <input type="email" className="form-control" name="email" value={formData.email} onChange={handleChange} required disabled />
                            {validationErrors.email && <div className="text-danger">{validationErrors.email}</div>}
                        </div>
                    </div>
                    <div className="col-md-6">
                        <div className="mb-3">
                            <label className="form-label">Last Name *</label>
                            <input type="text" className="form-control" name="last_name" value={formData.last_name} onChange={handleChange} required />
                        </div>
                        <div className="mb-3">
                            <label className="form-label">Date of Birth *</label>
                            <input type="date" className="form-control" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} required />
                        </div>
                        <div className="mb-3">
                            <label className="form-label">Address *</label>
                            <input type="text" className="form-control" name="address" value={formData.address} onChange={handleChange} required />
                        </div>
                    </div>
                </div>

                <div className="row">
                    <div className="col-md-6">
                        <div className="mb-3">
                            <label className="form-label">Upload a Profile Picture (Optional)</label>
                            <input type="file" className="form-control" name="image_url" onChange={handleFileChange} />
                        </div>
                    </div>
                    <div className="col-md-6 d-flex justify-content-left align-items-center">
                        <div>
                        <img 
                            src={
                                owner && owner.image_url && owner.image_url.startsWith('/') 
                                ? `http://localhost:3000${owner.image_url}` 
                                : "http://127.0.0.1:3000/uploads/blank.png"
                            } 
                            alt="Profile" 
                            style={{ maxWidth: "70px", maxHeight: "70px", objectFit: "cover" }} 
                        />
                        </div>
                    </div>
                </div>

                <div className="d-flex justify-content-center">
                    <button type="submit" className="btn btn-dark ms-2 rounded-1 p-2 w-20">
                        {loading ? "Updating..." : "Update"}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default OwnerEditProfile;