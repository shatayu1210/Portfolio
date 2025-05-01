import React, { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import { fetchCustomer, updateCustomer } from "../../redux/slices/customer/customerSlice";
import { addAddress, updateAddress, deleteAddress, setAddresses } from "../../redux/slices/customer/addressSlice";
import "bootstrap/dist/css/bootstrap.min.css";
import NavbarDark from "../Common/NavbarDark";
import axios from "../../config/axios";
import { validateEmail, validatePhone, validatePassword } from "../../utils/validation";

const CustomerEditProfile = () => {
    const { id } = useParams();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { customer, loading, error, success } = useSelector((state) => state.customer);
    const { addresses, loading: addressLoading, error: addressError, success: addressSuccess } = useSelector((state) => state.address);
    const authCustomer = useSelector((state) => state.auth.customer);
    
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        dateOfBirth: "",
        imageUrl: null
    });
    
    // Password change modal state
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordData, setPasswordData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
    });
    
    const [passwordCriteria, setPasswordCriteria] = useState({
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        special: false
    });
    
    const [validationErrors, setValidationErrors] = useState({
        email: "",
        phone: "",
        password: ""
    });
    
    const [updateSuccess, setUpdateSuccess] = useState(false);
    const [passwordSuccess, setPasswordSuccess] = useState(false);
    const [imageSuccess, setImageSuccess] = useState(false);
    const [imageSuccessMsg, setImageSuccessMsg] = useState("");
    const [uploadLoading, setUploadLoading] = useState(false);
    
    // Address form state
    const [showAddressForm, setShowAddressForm] = useState(false);
    const [addressFormData, setAddressFormData] = useState({
        label: "",
        street: "",
        city: "",
        state: "",
        country: "",
        zipCode: "",
        isPrimary: false
    });
    
    // Error state for address form
    const [addressFormError, setAddressFormError] = useState("");
    
    // Edit mode for address
    const [editAddressId, setEditAddressId] = useState(null);
    
    // Location data states
    const [countries, setCountries] = useState([]);
    const [states, setStates] = useState([]);
    const [cities, setCities] = useState([]);
    
    // Autocomplete states
    const [countryInput, setCountryInput] = useState("");
    const [stateInput, setStateInput] = useState("");
    const [cityInput, setCityInput] = useState("");
    
    // Filtered suggestions states
    const [countrySuggestions, setCountrySuggestions] = useState([]);
    const [stateSuggestions, setStateSuggestions] = useState([]);
    const [citySuggestions, setCitySuggestions] = useState([]);
    
    // Show suggestions states
    const [showCountrySuggestions, setShowCountrySuggestions] = useState(false);
    const [showStateSuggestions, setShowStateSuggestions] = useState(false);
    const [showCitySuggestions, setShowCitySuggestions] = useState(false);
    
    // Loading states
    const [loadingStates, setLoadingStates] = useState(false);
    const [loadingCities, setLoadingCities] = useState(false);
    
    const [passwordLoading, setPasswordLoading] = useState(false);
    
    const fileInputRef = useRef(null);

    // New validation function for password
    const validatePasswordCheck = (password) => {
        // Match backend validation exactly
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        const isLongEnough = password && password.length >= 6;
        
        setPasswordCriteria({
            length: isLongEnough,
            uppercase: hasUpperCase,
            lowercase: hasLowerCase,
            number: hasNumber,
            special: hasSpecialChar
        });
        
        // All criteria must be met for non-empty password
        return isLongEnough && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
    };

    // Fetch countries, states, cities for location dropdowns
    useEffect(() => {
        // Fetch countries on component mount
        fetchCountries();
    }, []);

    useEffect(() => {
        // Use ID from params or from auth state
        const customerId = id || authCustomer?.id;
        if (customerId) {
            // Fetch customer details when component mounts
            dispatch(fetchCustomer(customerId));
        } else {
            console.warn("No customer ID available for fetching");
        }
    }, [dispatch, id, authCustomer]);

    useEffect(() => {
        if (customer) {
            
            // Format date properly - handle different date formats
            let formattedDateOfBirth = "";
            if (customer.dateOfBirth) {
                try {
                    // Try to parse the date and format it to YYYY-MM-DD
                    const date = new Date(customer.dateOfBirth);
                    if (!isNaN(date.getTime())) {
                        formattedDateOfBirth = date.toISOString().split('T')[0];
                    } else {
                        console.warn("Invalid date format received:", customer.dateOfBirth);
                    }
                } catch (error) {
                    console.error("Error formatting date:", error);
                }
            }

            // Pre-fill form with customer data
            setFormData({
                firstName: customer.firstName || "",
                lastName: customer.lastName || "",
                email: customer.email || "",
                phone: customer.phone || "",
                dateOfBirth: formattedDateOfBirth,
                imageUrl: customer.imageUrl || null
            });
            
            // Set addresses in the address slice
            if (customer.addresses && Array.isArray(customer.addresses)) {
                dispatch(setAddresses(customer.addresses));
            }
            
        } else {
            console.warn("No customer data received yet");
        }
    }, [customer, dispatch]);
    
    // Fetch countries from API
    const fetchCountries = async () => {
        try {
            const response = await axios.get('/api/location/countries');
            setCountries(response.data);
        } catch (error) {
            console.error('Error fetching countries:', error);
        }
    };

    // Fetch states for selected country
    const fetchStates = async (country) => {
        if (!country) return;
        
        try {
            setLoadingStates(true);
            const response = await axios.post('/api/location/states', { country });
            setStates(response.data);
            setStateSuggestions(response.data);
        } catch (error) {
            console.error('Error fetching states:', error);
            setStates([]);
            setStateSuggestions([]);
        } finally {
            setLoadingStates(false);
        }
    };

    // Fetch cities for selected country and state
    const fetchCities = async (country, state) => {
        if (!country || !state) return;
        
        try {
            setLoadingCities(true);
            const response = await axios.post('/api/location/cities', { country, state });
            setCities(response.data);
            setCitySuggestions(response.data);
        } catch (error) {
            console.error('Error fetching cities:', error);
            setCities([]);
            setCitySuggestions([]);
        } finally {
            setLoadingCities(false);
        }
    };

    // Handle country input change
    const handleCountryInputChange = (e) => {
        const value = e.target.value;
        setCountryInput(value);
        
        // Filter countries based on input
        if (value.trim()) {
            const filtered = countries.filter(country => 
                country.toLowerCase().includes(value.toLowerCase())
            );
            setCountrySuggestions(filtered);
            setShowCountrySuggestions(filtered.length > 0);
        } else {
            setCountrySuggestions([]);
            setShowCountrySuggestions(false);
        }
    };

    // Handle country selection
    const handleSelectCountry = (country) => {
        setCountryInput(country);
        
        // Update address form data
        setAddressFormData(prev => ({
            ...prev,
            country,
            state: '',
            city: ''
        }));
        
        // Reset state and city inputs
        setStateInput('');
        setCityInput('');
        
        // Hide suggestions
        setShowCountrySuggestions(false);
        
        // Fetch states for the selected country
        fetchStates(country);
    };

    // Handle state input change
    const handleStateInputChange = (e) => {
        const value = e.target.value;
        setStateInput(value);
        
        // Filter states based on input
        if (value.trim()) {
            const filtered = states.filter(state => 
                state.toLowerCase().includes(value.toLowerCase())
            );
            setStateSuggestions(filtered);
            setShowStateSuggestions(filtered.length > 0);
        } else {
            setStateSuggestions([]);
            setShowStateSuggestions(false);
        }
    };

    // Handle state selection
    const handleSelectState = (state) => {
        setStateInput(state);
        
        // Update address form data
        setAddressFormData(prev => ({
            ...prev,
            state,
            city: ''
        }));
        
        // Reset city input
        setCityInput('');
        
        // Hide suggestions
        setShowStateSuggestions(false);
        
        // Fetch cities for the selected country and state
        fetchCities(addressFormData.country, state);
    };

    // Handle city input change
    const handleCityInputChange = (e) => {
        const value = e.target.value;
        setCityInput(value);
        
        // Filter cities based on input
        if (value.trim()) {
            const filtered = cities.filter(city => 
                city.toLowerCase().includes(value.toLowerCase())
            );
            setCitySuggestions(filtered);
            setShowCitySuggestions(filtered.length > 0);
        } else {
            setCitySuggestions([]);
            setShowCitySuggestions(false);
        }
    };

    // Handle city selection
    const handleSelectCity = (city) => {
        setCityInput(city);
        
        // Update address form data
        setAddressFormData(prev => ({
            ...prev,
            city
        }));
        
        // Hide suggestions
        setShowCitySuggestions(false);
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        
        // For checkbox inputs, use the checked value
        const newValue = type === 'checkbox' ? checked : value;
        
        setFormData((prevState) => ({
            ...prevState,
            [name]: newValue,
        }));
        
        // Clear validation errors when user types
        if (name === 'email' || name === 'phone') {
            setValidationErrors({
                ...validationErrors,
                [name]: ""
            });
        }
    };

    const handlePasswordChange = (e) => {
        const { name, value } = e.target;
        
        setPasswordData(prev => ({
            ...prev,
            [name]: value
        }));
        
        // Validate new password as user types
        if (name === 'newPassword') {
            validatePasswordCheck(value);
        }
    };

    const handleSubmitPasswordChange = async (e) => {
        e.preventDefault();
        
        // Reset errors
        setValidationErrors({...validationErrors, password: ""});
        
        // Validate password fields
        if (!passwordData.currentPassword) {
            setValidationErrors({...validationErrors, password: "Current password is required"});
            return;
        }
        
        if (!validatePasswordCheck(passwordData.newPassword)) {
            setValidationErrors({...validationErrors, password: "New password must meet all requirements"});
            return;
        }
        
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setValidationErrors({...validationErrors, password: "Passwords don't match"});
            return;
        }
        
        // Get the customer ID
        const customerId = customer?.id || id || authCustomer?.id;
        
        if (!customerId) {
            console.error("Customer ID is missing, cannot update password");
            alert("Error: Customer ID is missing. Please try again later.");
            return;
        }
        
        try {
            setPasswordLoading(true);
            
            // Create data for password update
            const passwordUpdateData = {
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword,
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                phone: formData.phone,
                dateOfBirth: formData.dateOfBirth,
                imageUrl: formData.imageUrl
            };
            
            // Update customer with password
            const response = await dispatch(updateCustomer({
                customerId: customerId.toString(),
                customerData: passwordUpdateData
            })).unwrap();
            
            // Clear password fields
            setPasswordData({
                currentPassword: "",
                newPassword: "",
                confirmPassword: ""
            });
            
            // Show password success message
            setPasswordSuccess(true);
            setTimeout(() => {
                setPasswordSuccess(false);
            }, 3000);
            
            // Close modal
            setShowPasswordModal(false);
            
        } catch (error) {
            console.error("Error updating password:", error);
            setValidationErrors({
                ...validationErrors, 
                password: typeof error === 'string' ? error : "Failed to update password"
            });
        } finally {
            setPasswordLoading(false);
        }
    };

    // Handle File Upload
    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadLoading(true);
        const formData = new FormData();
        formData.append("image", file);

        try {
            const response = await axios.post("/api/customers/upload-image", formData, {
                headers: { "Content-Type": "multipart/form-data" },
                
            });
            
            // Determine if this is a new upload or a change
            const isNewUpload = !formData.imageUrl;
            const newImageUrl = response.data.imageUrl;
            
            // Update local state with new image URL
            setFormData(prevState => ({
                ...prevState,
                imageUrl: newImageUrl,
            }));
            
            // Automatically save the profile with the new image
            const customerId = customer?.id || id || authCustomer?.id;
            
            if (customerId) {
                // Get the current form data after state update
                // Use customer data directly for required fields to ensure they're present
                const dataToSubmit = {
                    firstName: customer.firstName,
                    lastName: customer.lastName,
                    email: customer.email,
                    phone: customer.phone,
                    dateOfBirth: customer.dateOfBirth,
                    imageUrl: newImageUrl
                };
                
                // Format date
                if (dataToSubmit.dateOfBirth) {
                    try {
                        const date = new Date(dataToSubmit.dateOfBirth);
                        if (!isNaN(date.getTime())) {
                            dataToSubmit.dateOfBirth = date.toISOString().split('T')[0];
                        }
                    } catch (error) {
                        console.error("Error formatting date for submission:", error);
                    }
                }
                                
                // Update profile immediately
                await dispatch(updateCustomer({ 
                    customerId: customerId.toString(),
                    customerData: dataToSubmit 
                })).unwrap();
                
                // Show success message
                setImageSuccessMsg(isNewUpload ? "Profile Picture Uploaded Successfully!" : "Profile Picture Changed Successfully!");
                setImageSuccess(true);
                setTimeout(() => {
                    setImageSuccess(false);
                }, 3000);
            }
            
        } catch (error) {
            console.error("File upload failed", error);
            alert("Failed to upload file. Please try again.");
        } finally {
            setUploadLoading(false);
        }
    };
    
    const handleImageClick = () => {
        fileInputRef.current?.click();
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setUpdateSuccess(false);
        
        // Validate email and phone before submission
        let isValid = true;
        const newValidationErrors = { email: "", phone: "", password: "" };
        
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
        
        // Get the customer ID - ensure we're using the customer object's ID directly if available
        const customerId = customer?.id || id || authCustomer?.id;
        
        if (!customerId) {
            console.error("Customer ID is missing, cannot update profile");
            alert("Error: Customer ID is missing. Please try again later.");
            return;
        }
        
        // Form validation
        if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.dateOfBirth) {
            alert("Please fill in all required fields");
            return;
        }
        
        // Create a copy of formData without modifying the state directly
        const dataToSubmit = {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            dateOfBirth: formData.dateOfBirth,
            imageUrl: formData.imageUrl
        };
        
        // Even if imageUrl is null, keep it in the request to properly remove profile images
        // if (!dataToSubmit.imageUrl) {
        //     delete dataToSubmit.imageUrl;
        // }
        
        // Format date to ensure it's in YYYY-MM-DD format
        if (dataToSubmit.dateOfBirth) {
            try {
                const date = new Date(dataToSubmit.dateOfBirth);
                if (!isNaN(date.getTime())) {
                    dataToSubmit.dateOfBirth = date.toISOString().split('T')[0];
                }
            } catch (error) {
                console.error("Error formatting date for submission:", error);
            }
        }
        
        dispatch(updateCustomer({ 
            customerId: customerId.toString(),
            customerData: dataToSubmit 
        }))
        .unwrap()
        .then((response) => {
            console.log("Update successful:", response);
            setUpdateSuccess(true);
            setTimeout(() => {
                setUpdateSuccess(false);
            }, 3000);
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
    
    // Address form handlers
    const handleAddressChange = (e) => {
        const { name, value, type, checked } = e.target;
        
        // For checkbox inputs, use the checked value
        const newValue = type === 'checkbox' ? checked : value;
        
        setAddressFormData({
            ...addressFormData,
            [name]: newValue
        });
    };
    
    const handleAddAddress = () => {
        setShowAddressForm(true);
        setEditAddressId(null);
        setAddressFormError("");
        
        // Reset form data
        setAddressFormData({
            label: "",
            street: "",
            city: "",
            state: "",
            country: "",
            zipCode: "",
            isPrimary: addresses.length === 0 // Make primary if first address
        });
        
        // Reset inputs and suggestions
        setCountryInput("");
        setStateInput("");
        setCityInput("");
        setCountrySuggestions([]);
        setStateSuggestions([]);
        setCitySuggestions([]);
    };
    
    const handleEditAddress = (address) => {
        setShowAddressForm(true);
        setEditAddressId(address._id);
        setAddressFormError("");
        
        // Set form data from address
        setAddressFormData({
            label: address.label || "",
            street: address.street || "",
            city: address.city || "",
            state: address.state || "",
            country: address.country || "",
            zipCode: address.zipCode || "",
            isPrimary: address.isPrimary || false
        });
        
        // Set inputs for autocomplete
        setCountryInput(address.country || "");
        setStateInput(address.state || "");
        setCityInput(address.city || "");
        
        // If country is available, fetch states
        if (address.country) {
            fetchStates(address.country);
            
            // If state is available, fetch cities
            if (address.state) {
                fetchCities(address.country, address.state);
            }
        }
    };
    
    const handleDeleteAddress = (addressId) => {
        // Find the address to check if it's primary
        const addressToDelete = addresses.find(addr => addr._id === addressId);
        
        // Check if it's the only address or a primary address
        if (addresses.length === 1) {
            alert("You must have at least one address. Add another address before deleting this one.");
            return;
        }
        
        if (addressToDelete && addressToDelete.isPrimary) {
            alert("Primary address cannot be deleted. Please set another address as primary first.");
            return;
        }
        
        // If not primary and not the only address, confirm deletion
        if (window.confirm("Are you sure you want to delete this address?")) {
            dispatch(deleteAddress(addressId));
        }
    };
    
    const handleAddressSubmit = (e) => {
        e.preventDefault();
        
        // Clear previous errors
        setAddressFormError("");
        
        // Validate address data
        if (!addressFormData.label || !addressFormData.street || !addressFormData.country || 
            !addressFormData.state || !addressFormData.city || !addressFormData.zipCode) {
            setAddressFormError("Please fill in all address fields");
            return;
        }
        
        // Check for duplicate address label
        const isDuplicateLabel = addresses.some(address => 
            address.label.toLowerCase() === addressFormData.label.toLowerCase() && 
            (!editAddressId || address._id.toString() !== editAddressId.toString())
        );
        
        if (isDuplicateLabel) {
            setAddressFormError(`An address with label "${addressFormData.label}" already exists. Please use a different label.`);
            return;
        }
        
        if (editAddressId) {
            // Update existing address
            dispatch(updateAddress({ 
                addressId: editAddressId, 
                addressData: addressFormData 
            }))
            .unwrap()
            .then(() => {
                setShowAddressForm(false);
                setEditAddressId(null);
                setAddressFormError("");
            })
            .catch(error => {
                setAddressFormError(`Failed to update address: ${error}`);
            });
        } else {
            // Add new address
            dispatch(addAddress(addressFormData))
            .unwrap()
            .then(() => {
                setShowAddressForm(false);
                setAddressFormError("");
            })
            .catch(error => {
                setAddressFormError(`Failed to add address: ${error}`);
            });
        }
    };
    
    const handleSetPrimary = (addressId) => {
        // Find the address
        const address = addresses.find(addr => addr._id === addressId);
        if (!address) return;

        // Already primary, nothing to do
        if (address.isPrimary) return;

        // Update this address to be primary
        dispatch(updateAddress({
            addressId,
            addressData: { ...address, isPrimary: true }
        }))
        .unwrap()
        .catch(error => {
            alert(`Failed to set address as primary: ${error}`);
        });
    };
    
    const cancelAddressForm = () => {
        setShowAddressForm(false);
        setEditAddressId(null);
        setAddressFormError("");
    };

    // Check if there's only one address (which must be primary)
    const hasOnlyOneAddress = addresses && addresses.length === 1;

    return (
        <div className="container-fluid px-0">
            <NavbarDark />
            <button
                className="btn text-dark border-0 d-flex align-items-center mt-3 ms-3 fw-bold"
                style={{ backgroundColor: "transparent" }}
                onClick={() => navigate("/restaurants")}
            >
                <span className="fs-5 me-1">←</span><u>Back to Home</u>
            </button>
            
            <h3 className="mt-4 mb-4 fw-bold w-75 mx-auto">Edit Profile</h3>

            {loading && <p className="text-center text-primary">Loading...</p>}
            {error && <p className="text-center text-danger">{error}</p>}
            {updateSuccess && <div className="alert alert-success text-center">Profile Updated Successfully!</div>}
            {passwordSuccess && <div className="alert alert-success text-center">Password Changed Successfully!</div>}
            {imageSuccess && <div className="alert alert-success text-center">{imageSuccessMsg}</div>}

            {/* Profile Image */}
            <div className="mb-4 w-75 mx-auto">
                <div className="d-flex flex-column align-items-start">
                    <div 
                        className="position-relative d-inline-block"
                        style={{ cursor: 'pointer' }}
                        onClick={handleImageClick}
                    >
                        <div 
                            className="rounded-circle overflow-hidden"
                            style={{
                                width: '100px',
                                height: '100px',
                                border: '2px solid #dee2e6',
                                backgroundColor: '#f8f9fa'
                            }}
                        >
                            {formData.imageUrl ? (
                                <img
                                    src={formData.imageUrl.startsWith('/') ? `${axios.defaults.baseURL}${formData.imageUrl}` : formData.imageUrl}
                                    alt="Profile"
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover'
                                    }}
                                />
                            ) : (
                                <div className="d-flex align-items-center justify-content-center h-100">
                                    <i className="bi bi-person-circle" style={{ fontSize: '3rem', color: '#dee2e6' }}></i>
                                </div>
                            )}
                        </div>
                        <div 
                            className="position-absolute bottom-0 end-0 bg-white rounded-circle shadow-sm d-flex align-items-center justify-content-center"
                            style={{
                                width: '30px',
                                height: '30px',
                                border: '2px solid #dee2e6'
                            }}
                        >
                            <i className="bi bi-pencil-fill text-dark" style={{ fontSize: '0.8rem' }}></i>
                        </div>
                        
                        {formData.imageUrl && (
                            <div 
                                className="position-absolute top-0 end-0 bg-danger rounded-circle shadow-sm d-flex align-items-center justify-content-center"
                                style={{
                                    width: '25px',
                                    height: '25px',
                                    border: '2px solid #f8d7da',
                                    cursor: 'pointer'
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if(window.confirm("Are you sure you want to remove your profile picture?")) {
                                        // Update local state
                                        setFormData({...formData, imageUrl: null});
                                        
                                        // Get the customer ID
                                        const customerId = customer?.id || id || authCustomer?.id;
                                        
                                        if (!customerId) {
                                            console.error("Customer ID is missing, cannot update profile");
                                            alert("Error: Customer ID is missing. Please try again later.");
                                            return;
                                        }
                                        
                                        // Create data to submit (only include necessary fields)
                                        const dataToSubmit = {
                                            firstName: formData.firstName,
                                            lastName: formData.lastName,
                                            email: formData.email,
                                            phone: formData.phone,
                                            dateOfBirth: formData.dateOfBirth,
                                            imageUrl: null // Setting to null
                                        };
                                        
                                        // Format date to ensure it's in YYYY-MM-DD format
                                        if (dataToSubmit.dateOfBirth) {
                                            try {
                                                const date = new Date(dataToSubmit.dateOfBirth);
                                                if (!isNaN(date.getTime())) {
                                                    dataToSubmit.dateOfBirth = date.toISOString().split('T')[0];
                                                }
                                            } catch (error) {
                                                console.error("Error formatting date for submission:", error);
                                            }
                                        }
                                                                                
                                        // Update profile immediately
                                        dispatch(updateCustomer({ 
                                            customerId: customerId.toString(),
                                            customerData: dataToSubmit 
                                        }))
                                        .unwrap()
                                        .then((response) => {
                                            // Force a refresh of the customer data to ensure UI updates
                                            dispatch(fetchCustomer(customerId));
                                            // Show specific message for removing profile picture
                                            setImageSuccessMsg("Profile Picture Removed Successfully!");
                                            setImageSuccess(true);
                                            setTimeout(() => {
                                                setImageSuccess(false);
                                            }, 2000);
                                        })
                                        .catch((error) => {
                                            console.error("Error removing profile picture:", error);
                                            alert("Failed to remove profile picture. Please try again.");
                                            // Revert the local state if API call fails
                                            setFormData(prev => ({ ...prev, imageUrl: customer.imageUrl }));
                                        });
                                    }
                                }}
                                title="Remove profile picture"
                            >
                                <i className="bi bi-x text-white" style={{ fontSize: '0.9rem', fontWeight: 'bold' }}></i>
                            </div>
                        )}
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="d-none"
                    />
                    <div className="mt-2 d-flex align-items-center">
                        <p className="text-muted mb-0">
                            {formData.imageUrl ? "Click to edit profile picture" : "Click to upload profile picture"}
                        </p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="w-75 mx-auto">
                <div className="row">
                    <div className="col-md-6">
                        <div className="mb-3">
                            <label htmlFor="firstName">First Name <span className="text-danger">*</span></label>
                            <input
                                type="text"
                                className="form-control"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="phone">Phone <span className="text-danger">*</span></label>
                            <input
                                type="tel"
                                className="form-control"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                inputMode="tel"
                                required
                            />
                            {validationErrors.phone && <div className="text-danger">{validationErrors.phone}</div>}
                        </div>
                        <div className="mb-3">
                            <label htmlFor="email">Email <span className="text-danger">*</span></label>
                            <input
                                type="email"
                                className="form-control"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                disabled
                                required
                            />
                            <small className="form-text text-muted">Email cannot be changed</small>
                            {validationErrors.email && <div className="text-danger">{validationErrors.email}</div>}
                        </div>
                    </div>

                    <div className="col-md-6">
                        <div className="mb-3">
                            <label htmlFor="lastName">Last Name <span className="text-danger">*</span></label>
                            <input
                                type="text"
                                className="form-control"
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="dateOfBirth">Date of Birth <span className="text-danger">*</span></label>
                            <input
                                type="date"
                                className="form-control"
                                name="dateOfBirth"
                                value={formData.dateOfBirth}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>
                </div>
                <div className="d-flex flex-column align-items-start mb-5">
                    <button 
                        type="submit" 
                        className="btn btn-dark ms-0 rounded-1 p-2 px-4"
                        disabled={loading || uploadLoading}
                    >
                        {loading ? "Updating..." : "Update Profile"}
                    </button>
                    <button 
                        type="button" 
                        className="btn btn-link text-dark ms-0 p-0 mt-2" 
                        onClick={() => setShowPasswordModal(true)}
                    >
                        <u>Change Password</u>
                    </button>
                </div>
            </form>

            {/* Password Change Modal */}
            {showPasswordModal && (
                <div className="modal show d-block" tabIndex="-1" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content rounded-4 shadow">
                            <div className="modal-header border-bottom-0">
                                <h5 className="modal-title">Change Password</h5>
                                <button type="button" className="btn-close" onClick={() => setShowPasswordModal(false)}></button>
                            </div>
                            <div className="modal-body px-4 py-3">
                                {validationErrors.password && (
                                    <div className="alert alert-danger">{validationErrors.password}</div>
                                )}
                                <form onSubmit={handleSubmitPasswordChange}>
                        <div className="mb-3">
                                        <label htmlFor="currentPassword" className="form-label">Current Password</label>
                                        <input 
                                            type="password" 
                                            className="form-control" 
                                            id="currentPassword"
                                            name="currentPassword"
                                            value={passwordData.currentPassword}
                                            onChange={handlePasswordChange}
                                            required
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="newPassword" className="form-label">New Password</label>
                                        <input 
                                            type="password" 
                                            className="form-control" 
                                            id="newPassword"
                                            name="newPassword"
                                            value={passwordData.newPassword}
                                            onChange={handlePasswordChange}
                                            required
                                        />
                                        <div className="password-criteria mt-2">
                                            <small className={`d-block ${passwordCriteria.length ? 'text-success' : 'text-muted'}`}>
                                                <i className={`bi ${passwordCriteria.length ? 'bi-check-circle-fill' : 'bi-circle'}`}></i> At least 6 characters
                                            </small>
                                            <small className={`d-block ${passwordCriteria.uppercase ? 'text-success' : 'text-muted'}`}>
                                                <i className={`bi ${passwordCriteria.uppercase ? 'bi-check-circle-fill' : 'bi-circle'}`}></i> One uppercase letter
                                            </small>
                                            <small className={`d-block ${passwordCriteria.lowercase ? 'text-success' : 'text-muted'}`}>
                                                <i className={`bi ${passwordCriteria.lowercase ? 'bi-check-circle-fill' : 'bi-circle'}`}></i> One lowercase letter
                                            </small>
                                            <small className={`d-block ${passwordCriteria.number ? 'text-success' : 'text-muted'}`}>
                                                <i className={`bi ${passwordCriteria.number ? 'bi-check-circle-fill' : 'bi-circle'}`}></i> One number
                                            </small>
                                            <small className={`d-block ${passwordCriteria.special ? 'text-success' : 'text-muted'}`}>
                                                <i className={`bi ${passwordCriteria.special ? 'bi-check-circle-fill' : 'bi-circle'}`}></i> One special character
                                            </small>
                                        </div>
                                    </div>
                                    <div className="mb-4">
                                        <label htmlFor="confirmPassword" className="form-label">Re-enter New Password</label>
                                        <input 
                                            type="password" 
                                            className="form-control" 
                                            id="confirmPassword"
                                            name="confirmPassword"
                                            value={passwordData.confirmPassword}
                                            onChange={handlePasswordChange}
                                            required
                                        />
                                        {passwordData.newPassword && passwordData.confirmPassword && 
                                            passwordData.newPassword !== passwordData.confirmPassword && (
                                            <small className="text-danger">Passwords don't match</small>
                                        )}
                                    </div>
                                    <div className="d-flex justify-content-end">
                                        <button 
                                            type="button" 
                                            className="btn btn-outline-secondary me-2 rounded-pill"
                                            onClick={() => setShowPasswordModal(false)}
                                            disabled={passwordLoading}
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            type="submit" 
                                            className="btn btn-dark rounded-pill"
                                            disabled={passwordLoading}
                                        >
                                            {passwordLoading ? (
                                                <>
                                                    <span className="spinner-border text-success spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                    Updating...
                                                </>
                                            ) : "Update Password"}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Addresses Section */}
            <div className="w-75 mx-auto mt-5 mb-5">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h4 className="fw-bold">My Addresses</h4>
                    <button 
                        className="btn btn-outline-dark rounded-pill"
                        onClick={handleAddAddress}
                        disabled={showAddressForm}
                    >
                        <i className="bi bi-plus-lg me-1"></i> Add New Address
                    </button>
                </div>
                
                {/* Loading and error states for addresses */}
                {addressLoading && <p className="text-center">Loading addresses...</p>}
                {addressError && <p className="text-center text-danger">{addressError}</p>}
                
                {/* Address Form */}
                {showAddressForm && (
                    <div className="card mb-4 p-3 border shadow-sm rounded-4">
                        <h5 className="mb-3">{editAddressId ? 'Edit Address' : 'Add New Address'}</h5>
                        
                        {/* Display form error if any */}
                        {addressFormError && (
                            <div className="alert alert-danger">{addressFormError}</div>
                        )}
                        
                        <form onSubmit={handleAddressSubmit}>
                            <div className="row">
                                <div className="col-md-6">
                                    <div className="mb-3">
                                        <label htmlFor="label">Address Label <span className="text-danger">*</span></label>
                            <input
                                type="text"
                                className="form-control"
                                            name="label"
                                            value={addressFormData.label}
                                            onChange={handleAddressChange}
                                            placeholder="Home, Work, etc."
                                required
                            />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="street">Street <span className="text-danger">*</span></label>
                            <input
                                type="text"
                                className="form-control"
                                name="street"
                                value={addressFormData.street}
                                onChange={handleAddressChange}
                                required
                            />
                        </div>
                                    
                        {/* Country Autocomplete */}
                        <div className="mb-3">
                            <label htmlFor="country">Country <span className="text-danger">*</span></label>
                            <div className="position-relative">
                                <input 
                                    type="text" 
                                    className="form-control"
                                    name="country" 
                                    value={countryInput}
                                    onChange={handleCountryInputChange}
                                    onFocus={() => {
                                        if (countries.length > 0 && countryInput) {
                                            setShowCountrySuggestions(true);
                                        }
                                    }}
                                    onBlur={() => {
                                        // Delay hiding suggestions to allow clicking on them
                                        setTimeout(() => {
                                            setShowCountrySuggestions(false);
                                        }, 200);
                                    }}
                                    placeholder="Start typing a country name..."
                                    required 
                                />
                                
                                {/* Country Suggestions Dropdown */}
                                {showCountrySuggestions && countrySuggestions.length > 0 && (
                                    <div className="position-absolute w-100 mt-1 shadow-sm bg-white border rounded-2" 
                                        style={{ maxHeight: '200px', overflowY: 'auto', zIndex: 1000 }}>
                                        {countrySuggestions.map((country, index) => (
                                            <div 
                                                key={index} 
                                                className="px-3 py-2" 
                                                style={{ cursor: 'pointer' }}
                                                onMouseDown={() => handleSelectCountry(country)}
                                                onMouseOver={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                                                onMouseOut={(e) => e.target.style.backgroundColor = ''}
                                            >
                                                {country}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="col-md-6">
                        {/* State Autocomplete */}
                        <div className="mb-3">
                            <label htmlFor="state">State <span className="text-danger">*</span></label>
                            <div className="position-relative">
                                <input 
                                    type="text" 
                                    className="form-control"
                                    name="state" 
                                    value={stateInput}
                                    onChange={handleStateInputChange}
                                    onFocus={() => {
                                        if (states.length > 0 && stateInput) {
                                            setShowStateSuggestions(true);
                                        }
                                    }}
                                    onBlur={() => {
                                        setTimeout(() => {
                                            setShowStateSuggestions(false);
                                        }, 200);
                                    }}
                                    placeholder={addressFormData.country ? "Start typing a state name..." : "Select a country first"}
                                    required 
                                    disabled={!addressFormData.country || loadingStates}
                                />
                                {loadingStates && (
                                    <div className="position-absolute" style={{ right: '10px', top: '10px' }}>
                                        <span className="spinner-border spinner-border-sm text-success" role="status"></span>
                                    </div>
                                )}
                                            
                                {/* State Suggestions Dropdown */}
                                {showStateSuggestions && stateSuggestions.length > 0 && (
                                    <div className="position-absolute w-100 mt-1 shadow-sm bg-white border rounded-2" 
                                        style={{ maxHeight: '200px', overflowY: 'auto', zIndex: 1000 }}>
                                        {stateSuggestions.map((state, index) => (
                                            <div 
                                                key={index} 
                                                className="px-3 py-2" 
                                                style={{ cursor: 'pointer' }}
                                                onMouseDown={() => handleSelectState(state)}
                                                onMouseOver={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                                                onMouseOut={(e) => e.target.style.backgroundColor = ''}
                                            >
                                                {state}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                                    
                        {/* City Autocomplete */}
                        <div className="mb-3">
                            <label htmlFor="city">City <span className="text-danger">*</span></label>
                            <div className="position-relative">
                                <input 
                                    type="text" 
                                    className="form-control"
                                    name="city" 
                                    value={cityInput}
                                    onChange={handleCityInputChange}
                                    onFocus={() => {
                                        if (cities.length > 0 && cityInput) {
                                            setShowCitySuggestions(true);
                                        }
                                    }}
                                    onBlur={() => {
                                        setTimeout(() => {
                                            setShowCitySuggestions(false);
                                        }, 200);
                                    }}
                                    placeholder={addressFormData.state ? "Start typing a city name..." : "Select a state first"}
                                    required 
                                    disabled={!addressFormData.state || loadingCities}
                                />
                                {loadingCities && (
                                    <div className="position-absolute" style={{ right: '10px', top: '10px' }}>
                                        <span className="spinner-border spinner-border-sm text-success" role="status"></span>
                                    </div>
                                )}
                                            
                                {/* City Suggestions Dropdown */}
                                {showCitySuggestions && citySuggestions.length > 0 && (
                                    <div className="position-absolute w-100 mt-1 shadow-sm bg-white border rounded-2" 
                                        style={{ maxHeight: '200px', overflowY: 'auto', zIndex: 1000 }}>
                                        {citySuggestions.map((city, index) => (
                                            <div 
                                                key={index} 
                                                className="px-3 py-2" 
                                                style={{ cursor: 'pointer' }}
                                                onMouseDown={() => handleSelectCity(city)}
                                                onMouseOver={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                                                onMouseOut={(e) => e.target.style.backgroundColor = ''}
                                            >
                                                {city}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                                
                        <div className="mb-3">
                            <label htmlFor="zipCode">ZIP Code <span className="text-danger">*</span></label>
                            <input
                                type="text"
                                className="form-control"
                                name="zipCode"
                                value={addressFormData.zipCode}
                                onChange={handleAddressChange}
                                required
                            />
                        </div>
                    </div>
                </div>
                <div className="mb-3">
                    {(addresses.length > 0 || editAddressId) && (
                        <div className="form-check">
                            <input
                                type="checkbox"
                                className="form-check-input"
                                name="isPrimary"
                                id="isPrimary"
                                checked={addressFormData.isPrimary}
                                onChange={handleAddressChange}
                                disabled={addresses.length === 0} // Auto-primary if first address
                            />
                            <label className="form-check-label" htmlFor="isPrimary">
                                Set as Primary Address
                                {addresses.length === 0 && <span className="text-muted ms-2">(First address is automatically primary)</span>}
                            </label>
                        </div>
                    )}
                </div>
                <div className="d-flex gap-2 justify-content-end">
                    <button 
                        type="button" 
                        className="btn btn-outline-secondary rounded-pill" 
                        onClick={cancelAddressForm}
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        className="btn btn-dark rounded-pill"
                        disabled={addressLoading}
                    >
                        {addressLoading ? "Saving..." : "Save Address"}
                    </button>
                </div>
            </form>
            </div>
            )}
                
                {/* Address Cards */}
                {addresses && addresses.length > 0 ? (
                    <div className="row row-cols-1 row-cols-md-2 g-4">
                        {addresses.map(address => (
                            <div className="col" key={address._id}>
                                <div className={`card h-100 shadow-sm border rounded-4 overflow-hidden ${address.isPrimary ? 'border-dark border-4' : ''}`}>
                                    <div className="card-body">
                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                            <h5 className="card-title mb-1">
                                                {address.label}
                                            </h5>
                                            <div className="btn-group">
                                                <button 
                                                    className="btn btn-sm btn-outline-dark rounded-circle me-1" 
                                                    onClick={() => handleEditAddress(address)}
                                                    disabled={showAddressForm}
                                                    style={{width: "32px", height: "32px"}}
                                                >
                                                    <i className="bi bi-pencil"></i>
                                                </button>
                                                <button 
                                                    className="btn btn-sm btn-outline-danger rounded-circle" 
                                                    onClick={() => handleDeleteAddress(address._id)}
                                                    disabled={addressLoading || showAddressForm}
                                                    title={address.isPrimary ? "Primary address cannot be deleted. Please set another address as primary first." : "Delete address"}
                                                    style={{width: "32px", height: "32px"}}
                                                >
                                                    <i className="bi bi-trash"></i>
                                                </button>
                                            </div>
                                        </div>
                                        <p className="card-text mb-1">{address.street}</p>
                                        <p className="card-text mb-1">{address.city}, {address.state}</p>
                                        <p className="card-text mb-1">{address.country}, {address.zipCode}</p>
                                        
                                        <div className="form-check mt-2">
                                            <input
                                                type="radio"
                                                className="form-check-input"
                                                name="primaryAddress"
                                                id={`primary-${address._id}`}
                                                checked={address.isPrimary}
                                                onChange={() => {
                                                    // Only perform action if not already primary
                                                    if (!address.isPrimary) {
                                                        handleSetPrimary(address._id);
                                                    }
                                                }}
                                                disabled={addressLoading}
                                                style={{
                                                    cursor: 'pointer',
                                                    borderWidth: '2px',
                                                    borderColor: '#000',
                                                    width: '18px',
                                                    height: '18px',
                                                    backgroundColor: address.isPrimary ? '#000' : ''
                                                }}
                                            />
                                            <label 
                                                className="form-check-label" 
                                                htmlFor={`primary-${address._id}`}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                Primary Address
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center p-5 bg-light rounded-4">
                        <i className="bi bi-geo-alt fs-1 text-muted"></i>
                        <p className="mt-3 mb-0">No addresses found. Add a new address to get started.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomerEditProfile;