import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from '../../config/axios';
import { useSelector } from 'react-redux';
import NavbarDark from '../Common/NavbarDark';
import { useNavigate } from "react-router-dom";
import { Modal, Button, Dropdown, Form } from 'react-bootstrap';
import "bootstrap/dist/css/bootstrap.min.css";

const DEFAULT_IMAGE_PLACEHOLDER = "https://res.cloudinary.com/dvylvq84d/image/upload/v1744151036/ImagePlaceholder_gg1xob.png";

// Categories for dishes
const DISH_CATEGORIES = [
    { id: 'hawaiian', name: 'Hawaiian' },
    { id: 'bakery', name: 'Bakery' },
    { id: 'drinks', name: 'Drinks' },
    { id: 'thai', name: 'Thai' },
    { id: 'coffee', name: 'Coffee' },
    { id: 'ice_cream', name: 'Ice Cream' },
    { id: 'noodles', name: 'Noodles' },
    { id: 'wings', name: 'Wings' },
    { id: 'sandwich', name: 'Sandwich' },
    { id: 'dessert', name: 'Dessert' },
    { id: 'burger', name: 'Burger' },
    { id: 'mexican', name: 'Mexican' },
    { id: 'indian', name: 'Indian' },
    { id: 'chinese', name: 'Chinese' },
    { id: 'fries', name: 'Fries' },
    { id: 'pizza', name: 'Pizza' }
];

const ManageDishes = () => {
    const restaurantId = useSelector((state) => state.auth.restaurant?.id);
    const navigate = useNavigate();
    const isRestaurantAuthenticated = useSelector((state) => state.auth.isRestaurantAuthenticated);
    const fileInputRef = useRef(null);
    const updateFileInputRef = useRef(null);

    const [loading, setLoading] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [deletingDishId, setDeletingDishId] = useState(null);
    const [error, setError] = useState(null);
    const [dishes, setDishes] = useState([]);
    const [restaurant, setRestaurant] = useState(null);
    const [updatedDishes, setUpdatedDishes] = useState({});
    const [showAddDishModal, setShowAddDishModal] = useState(false);
    const [showUpdateDishModal, setShowUpdateDishModal] = useState(false);
    const [selectedDishForUpdate, setSelectedDishForUpdate] = useState(null);
    const [deletedDishMessage, setDeletedDishMessage] = useState('');
    const [previewImage, setPreviewImage] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [updatePreviewImage, setUpdatePreviewImage] = useState(null);
    const [updateSelectedFile, setUpdateSelectedFile] = useState(null);
    const [togglingDishId, setTogglingDishId] = useState(null);
    
    // Ingredients state for new dish
    const [ingredientInput, setIngredientInput] = useState('');
    const [updateIngredientInput, setUpdateIngredientInput] = useState('');
    
    // Modal state for size
    const [sizes, setSizes] = useState([{ size: '', price: '' }]);
    const [updateSizes, setUpdateSizes] = useState([{ size: '', price: '' }]);
    
    // New dish state
    const [newDish, setNewDish] = useState({
        name: '',
        description: '',
        category: [],
        ingredients: [],
        imageUrl: '',
        isAvailable: true
    });

    // Update dish state
    const [updateDish, setUpdateDish] = useState({
        id: '',
        name: '',
        description: '',
        category: [],
        ingredients: [],
        imageUrl: '',
        isAvailable: true
    });

    // Sorting & filtering state
    const [sortOption, setSortOption] = useState('az');
    const [filterCategories, setFilterCategories] = useState([]);
    const toggleFilterCategory = id => setFilterCategories(prev =>
        prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
    const clearFilters = () => { setSortOption('az'); setFilterCategories([]); };
    const isFiltered = sortOption !== 'az' || filterCategories.length > 0;
    const displayedDishes = useMemo(() => {
        let arr = [...dishes];
        if (filterCategories.length > 0) {
            arr = arr.filter(d => d.category?.some(cat => filterCategories.includes(cat)));
        }
        arr.sort((a, b) =>
            sortOption === 'az' ? a.name?.localeCompare(b.name) : b.name?.localeCompare(a.name)
        );
        return arr;
    }, [dishes, sortOption, filterCategories]);

    useEffect(() => {
        if (!isRestaurantAuthenticated) {
            navigate("/restaurant/login");
        }
    }, [isRestaurantAuthenticated, navigate]);

    useEffect(() => {
        if (restaurantId) {
            // Fetch restaurant data directly
            fetchRestaurantData(restaurantId);
        }
    }, [restaurantId]);

    const fetchRestaurantData = async (restaurantId) => {
        try {
            setLoading(true);
            const response = await axios.get(`/api/restaurants/${restaurantId}`);
            if (response.data) {
                setRestaurant(response.data);
                fetchDishes(restaurantId);
            }
        } catch (err) {
            console.error('Error fetching restaurant data:', err);
            setError('Failed to load restaurant data');
        } finally {
            setLoading(false);
        }
    };

    const fetchDishes = async (restaurantId) => {
        try {
            const response = await axios.get(`/api/restaurants/${restaurantId}`);
            // Ensure all dish properties have default values if they're null
            const dishesWithDefaults = response.data.dishes.map(dish => ({
                ...dish,
                name: dish.name || '',
                description: dish.description || '',
                price: dish.price || '',
                size: dish.size || '',
                image_url: dish.image_url || '',
                id: dish._id || dish.id  // Ensure ID is consistently available
            }));
            setDishes(dishesWithDefaults);
        } catch (err) {
            if (err.response && err.response.status === 404) {
                return;
            }
            console.error('Error fetching dishes:', err);
            setError('Failed to fetch dishes');
        }
    };

    const handleDishUpdate = (dish) => {
        openUpdateDishModal(dish);
    };

    // Add handleDeleteDish function
    const handleDeleteDish = async (dishId, dishName) => {
        if (!window.confirm(`Are you sure you want to delete "${dishName}"?`)) {
            return;
        }
        
        setDeletingDishId(dishId);
        setError(null);
        try {
            await axios.delete(`/api/dishes/${dishId}`);
            // Remove the deleted dish from the dishes array
            setDishes(dishes.filter(dish => dish.id !== dishId));
            // Show success message
            setDeletedDishMessage(`Dish "${dishName}" has been deleted successfully`);
            // Clear the message after 5 seconds
            setTimeout(() => {
                setDeletedDishMessage('');
            }, 5000);
        } catch (err) {
            console.error('Error deleting dish:', err);
            setError('Failed to delete dish');
        } finally {
            setDeletingDishId(null);
        }
    };

    const handleChange = (index, e) => {
        const { name, value } = e.target;
        const updatedDishes = [...dishes];
        // Ensure we never set a null value
        updatedDishes[index][name] = value || '';
        setDishes(updatedDishes);
    };

    const handleFileChange = async (index, e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadLoading(true);
        const formData = new FormData();
        formData.append("image", file);

        try {
            const response = await axios.post("/api/dishes/upload-image", formData, {
                headers: { "Content-Type": "multipart/form-data" },
                
            });

            const updatedDishes = [...dishes];
            updatedDishes[index].image_url = response.data.imageUrl;
            setDishes(updatedDishes);
            
            // Show success message
            setUpdatedDishes(prev => ({ 
                ...prev, 
                [updatedDishes[index].id]: `Image for ${updatedDishes[index].name} updated successfully` 
            }));
        } catch (error) {
            console.error("File upload failed", error);
            setError("Failed to upload image. Please try again.");
        } finally {
            setUploadLoading(false);
        }
    };

    // Handle New Dish Modal Image Functions
    const handleNewDishImageClick = () => {
        fileInputRef.current?.click();
    };

    const handleNewDishFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
    
        // Create preview URL
        const previewUrl = URL.createObjectURL(file);
        setPreviewImage(previewUrl);
        setSelectedFile(file);
    };

    const handleRemoveImage = (e) => {
        e.stopPropagation();
        setPreviewImage(null);
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        setNewDish({...newDish, imageUrl: ''});
    };

    // Handle New Dish Input Change
    const handleNewDishChange = (e) => {
        const { name, value } = e.target;
        setNewDish({...newDish, [name]: value});
    };

    // Handle category selection
    const handleCategoryChange = (e) => {
        const options = e.target.options;
        const selectedCategories = [];
        
        for (let i = 0; i < options.length; i++) {
            if (options[i].selected) {
                selectedCategories.push(options[i].value);
            }
        }
        
        setNewDish({...newDish, category: selectedCategories});
    };

    // Handle Ingredient Input
    const addIngredient = () => {
        if (ingredientInput.trim() === '') return;
        
        setNewDish({
            ...newDish,
            ingredients: [...newDish.ingredients, ingredientInput.trim()]
        });
        setIngredientInput('');
    };

    const removeIngredient = (index) => {
        const updatedIngredients = [...newDish.ingredients];
        updatedIngredients.splice(index, 1);
        setNewDish({...newDish, ingredients: updatedIngredients});
    };

    // Handle Size Functions
    const handleSizeChange = (index, field, value) => {
        const updatedSizes = [...sizes];
        updatedSizes[index] = {
            ...updatedSizes[index],
            [field]: value
        };
        setSizes(updatedSizes);
    };

    const addSize = () => {
        setSizes([...sizes, { size: '', price: '' }]);
    };

    const removeSize = (index) => {
        if (sizes.length === 1) return; // Keep at least one size
        const updatedSizes = [...sizes];
        updatedSizes.splice(index, 1);
        setSizes(updatedSizes);
    };

    // Submit New Dish
    const handleAddDish = async () => {
        setLoading(true);
        setError(null);

        if (newDish.category.length === 0) {
            setError('Please select at least one category');
            setLoading(false);
            return;
        }

        try {
            // Upload image if selected
            let imageUrl = null;
            if (selectedFile) {
                const formData = new FormData();
                formData.append("image", selectedFile);
                
                const response = await axios.post("/api/dishes/upload-image", formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
                imageUrl = response.data.imageUrl;
            }

            // Prepare dish data
            const dishData = {
                name: newDish.name,
                description: newDish.description,
                sizes: sizes.map(s => ({
                    size: s.size,
                    price: parseFloat(s.price)
                })),
                category: newDish.category,
                ingredients: newDish.ingredients,
                imageUrl: imageUrl,
                isAvailable: newDish.isAvailable,
                restaurantId: restaurant.id
            };

            // Send create dish request
            const response = await axios.post('/api/dishes', dishData);
            
            // Update dishes list with full created dish
            const { dish: createdDish } = response.data;
            setDishes(prev => [
                ...prev,
                { ...createdDish, id: createdDish._id }
            ]);
            
            // Reset form
            setNewDish({
                name: '',
                description: '',
                category: [],
                ingredients: [],
                imageUrl: '',
                isAvailable: true
            });
            setSizes([{ size: '', price: '' }]);
            setPreviewImage(null);
            setSelectedFile(null);
            
            // Close modal
            setShowAddDishModal(false);
            
            // Show success message
            setDeletedDishMessage(`Dish "${response.data.dish.name}" has been added successfully`);
            setTimeout(() => {
                setDeletedDishMessage('');
            }, 5000);
        } catch (err) {
            console.error('Error adding dish:', err);
            setError('Failed to add dish: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    // Add handleToggleAvailability function 
    const handleToggleAvailability = async (dishId, currentAvailability) => {
        if (togglingDishId || loading) return; // Prevent multiple simultaneous toggles
        
        setTogglingDishId(dishId);
        setError(null);
        try {
            // Call the API endpoint to toggle availability
            const response = await axios.patch(`/api/dishes/${dishId}/availability`);
            
            // Update local state to reflect the change
            const updatedDishes = dishes.map(dish => 
                dish.id === dishId ? { ...dish, isAvailable: !currentAvailability } : dish
            );
            setDishes(updatedDishes);
            
            // Check if restaurant status was changed
            if (response.data.restaurantStatusChanged) {
                // Update local restaurant state
                setRestaurant({
                    ...restaurant,
                    status: response.data.newStatus
                });
                
                // Show alert to user
                window.alert("Your restaurant has been set to inactive because all dishes are unavailable. Customers will not be able to order from your restaurant until at least one dish is available.");
            }
            
            // Check if this is the first available dish for an inactive restaurant
            if (response.data.firstAvailableDish === true) {
                // Show success message first
                setUpdatedDishes(prev => ({ 
                    ...prev, 
                    [dishId]: `Dish is now available for ordering` 
                }));
                
                // Wait a moment before showing the prompt
                setTimeout(() => {
                    const userWantsToActivate = window.confirm(
                        "You now have an available dish! Would you like to make your restaurant active for customers to place orders?"
                    );
                    
                    if (userWantsToActivate) {
                        activateRestaurant();
                    }
                }, 1500); 
            } else {
                // Show regular success message
                setUpdatedDishes(prev => ({ 
                    ...prev, 
                    [dishId]: `Dish is now ${!currentAvailability ? 'available' : 'unavailable'} for ordering` 
                }));
            }
            
            // Clear success message after 3 seconds
            setTimeout(() => {
                setUpdatedDishes(prev => {
                    const updatedState = { ...prev };
                    delete updatedState[dishId];
                    return updatedState;
                });
            }, 1500);
        } catch (err) {
            console.error('Error toggling dish availability:', err);
            setError('Failed to update dish availability. Please try again.');
        } finally {
            setTogglingDishId(null);
        }
    };
    
    // Function to activate restaurant
    const activateRestaurant = async () => {
        try {
            // Update restaurant status to active
            await axios.put(`/api/restaurants/status/${restaurantId}`, { status: 'active' });
            
            // Update local state
            setRestaurant({
                ...restaurant,
                status: 'active'
            });
            
            // Show success message
            setError(null);
            window.alert("Your restaurant is now active. Customers can place orders!");
        } catch (err) {
            console.error('Error activating restaurant:', err);
            setError('Failed to activate restaurant. Please try again.');
        }
    };

    // Function to open update dish modal
    const openUpdateDishModal = (dish) => {
        // Create a copy of the dish to update
        setUpdateDish({
            id: dish.id,
            name: dish.name,
            description: dish.description,
            category: dish.category || [],
            ingredients: dish.ingredients || [],
            imageUrl: dish.imageUrl || '',
            isAvailable: dish.isAvailable
        });

        // Set sizes from the dish
        setUpdateSizes(dish.sizes && dish.sizes.length > 0 
            ? dish.sizes.map(size => ({ 
                size: size.size || '', 
                price: size.price ? size.price.toString() : '' 
            }))
            : [{ size: '', price: '' }]
        );

        // Set preview image if available
        if (dish.imageUrl) {
            setUpdatePreviewImage(dish.imageUrl);
        } else {
            setUpdatePreviewImage(null);
        }

        setSelectedDishForUpdate(dish);
        setShowUpdateDishModal(true);
    };

    // Handle update dish input change
    const handleUpdateDishChange = (e) => {
        const { name, value } = e.target;
        setUpdateDish({...updateDish, [name]: value});
    };

    // Handle update dish category selection
    const handleUpdateCategoryChange = (e) => {
        const options = e.target.options;
        const selectedCategories = [];
        
        for (let i = 0; i < options.length; i++) {
            if (options[i].selected) {
                selectedCategories.push(options[i].value);
            }
        }
        
        setUpdateDish({...updateDish, category: selectedCategories});
    };

    // Handle update dish image click
    const handleUpdateDishImageClick = () => {
        updateFileInputRef.current?.click();
    };

    // Handle update dish file change
    const handleUpdateDishFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
    
        // Create preview URL
        const previewUrl = URL.createObjectURL(file);
        setUpdatePreviewImage(previewUrl);
        setUpdateSelectedFile(file);
    };

    // Handle remove update image
    const handleRemoveUpdateImage = (e) => {
        e.stopPropagation();
        setUpdatePreviewImage(null);
        setUpdateSelectedFile(null);
        if (updateFileInputRef.current) {
            updateFileInputRef.current.value = '';
        }
        setUpdateDish({...updateDish, imageUrl: ''});
    };

    // Add ingredient to update dish
    const addUpdateIngredient = () => {
        if (updateIngredientInput.trim() === '') return;
        
        setUpdateDish({
            ...updateDish,
            ingredients: [...updateDish.ingredients, updateIngredientInput.trim()]
        });
        setUpdateIngredientInput('');
    };

    // Remove ingredient from update dish
    const removeUpdateIngredient = (index) => {
        const updatedIngredients = [...updateDish.ingredients];
        updatedIngredients.splice(index, 1);
        setUpdateDish({...updateDish, ingredients: updatedIngredients});
    };

    // Handle update size change
    const handleUpdateSizeChange = (index, field, value) => {
        const updatedSizes = [...updateSizes];
        updatedSizes[index] = {
            ...updatedSizes[index],
            [field]: value
        };
        setUpdateSizes(updatedSizes);
    };

    // Add size to update dish
    const addUpdateSize = () => {
        setUpdateSizes([...updateSizes, { size: '', price: '' }]);
    };

    // Remove size from update dish
    const removeUpdateSize = (index) => {
        if (updateSizes.length === 1) return; // Keep at least one size
        const updatedSizes = [...updateSizes];
        updatedSizes.splice(index, 1);
        setUpdateSizes(updatedSizes);
    };

    // Submit update dish
    const handleUpdateDishSubmit = async () => {
        setLoading(true);
        setError(null);

        if (updateDish.category.length === 0) {
            setError('Please select at least one category');
            setLoading(false);
            return;
        }

        try {
            // Upload image if a new one is selected
            let imageUrl = updateDish.imageUrl;
            if (updateSelectedFile) {
                const formData = new FormData();
                formData.append("image", updateSelectedFile);
                
                const response = await axios.post("/api/dishes/upload-image", formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
                imageUrl = response.data.imageUrl;
            }

            // Prepare dish data
            const dishData = {
                name: updateDish.name,
                description: updateDish.description,
                sizes: updateSizes.map(s => ({
                    size: s.size,
                    price: parseFloat(s.price)
                })),
                category: updateDish.category,
                ingredients: updateDish.ingredients,
                imageUrl: imageUrl,
                isAvailable: updateDish.isAvailable
            };

            // Send update dish request
            const response = await axios.put(`/api/dishes/${updateDish.id}`, dishData);
            
            // Process the response data to ensure it has a consistent format
            const updatedDish = {
                ...response.data,
                id: response.data._id || response.data.id,
                imageUrl: response.data.imageUrl || response.data.image_url
            };
            
            // Update dishes list
            setDishes(dishes.map(dish => 
                dish.id === updateDish.id ? updatedDish : dish
            ));
            
            // Close modal
            setShowUpdateDishModal(false);
            
            // Show success message
            setUpdatedDishes(prev => ({ 
                ...prev, 
                [updateDish.id]: `Dish "${updateDish.name}" has been updated successfully` 
            }));
            setTimeout(() => {
                setUpdatedDishes(prev => {
                    const updatedState = { ...prev };
                    delete updatedState[updateDish.id];
                    return updatedState;
                });
            }, 3000);
            
            // Refresh dishes to ensure we have the latest data
            if (restaurant && restaurant.id) {
                fetchDishes(restaurant.id);
            } else if (restaurantId) {
                fetchDishes(restaurantId);
            }
        } catch (err) {
            console.error('Error updating dish:', err);
            setError('Failed to update dish: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <NavbarDark />
            <style>
                {`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                `}
            </style>
            <button
                className="btn text-dark border-0 d-flex align-items-center mt-3 ms-5 fw-bold"
                style={{ backgroundColor: "transparent" }}
                onClick={() => navigate("/restaurant/dashboard")}
            >
                <span className="fs-5 me-1">←</span><u>Back to Dashboard</u>
            </button>
            
            {loading ? (
                <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center">
                    <div className="spinner-border text-success" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            ) : error ? (
                <div className="container-fluid py-4">
                    <div className="alert alert-danger m-0" role="alert">
                        Error: {error}
                    </div>
                </div>
            ) : !restaurant ? (
                <div className="container-fluid py-4">
                    <div className="alert alert-info m-0" role="alert">
                        Loading restaurant information...
                    </div>
                </div>
            ) : (
                <div className="container-fluid py-3">
                    <div className="container-lg">
                        <div className="row justify-content-center">
                            <div className="col-12">
                                <div className="card border-0">
                                    <div className="card-body p-4">
                                        {error && <div className="alert alert-danger">{error}</div>}
                                        {deletedDishMessage && <div className="alert alert-success">{deletedDishMessage}</div>}
                                        <div className="d-flex justify-content-between align-items-center mb-4">
                                            <h3 className="fw-bold">Update Dishes for {restaurant.name}</h3>
                                            <button
                                                className="btn btn-outline-dark rounded-5 px-3 py-1"
                                                onClick={() => setShowAddDishModal(true)}
                                            >
                                                <i className="bi bi-plus-lg me-2"></i>
                                                Add Dish
                                            </button>
                                        </div>
                                        
                                        {/* Sort & Filter Controls */}
                                        <div className="d-flex align-items-center flex-wrap mb-3">
                                            <Dropdown className="me-3">
                                                <Dropdown.Toggle variant="bg-white rounded-pill py-1 px-3" id="sort-by-dropdown" style={{border:'1px solid #c0c0c0'}}>
                                                    Sort: {sortOption === 'az' ? 'A → Z' : 'Z → A'}
                                                </Dropdown.Toggle>
                                                <Dropdown.Menu>
                                                    <div className="dropdown-animate">
                                                        <Dropdown.Item onClick={() => setSortOption('az')} className={sortOption === 'az' ? 'text-dark fw-bold bg-light' : ''}>A → Z</Dropdown.Item>
                                                        <Dropdown.Item onClick={() => setSortOption('za')} className={sortOption === 'za' ? 'text-dark fw-bold bg-light' : ''}>Z → A</Dropdown.Item>
                                                    </div>
                                                </Dropdown.Menu>
                                            </Dropdown>
                                            <Dropdown className="me-3">
                                                <Dropdown.Toggle variant="bg-white rounded-pill py-1 px-3" id="filter-category-dropdown" style={{border:'1px solid #c0c0c0'}}>
                                                    Filter By Category
                                                </Dropdown.Toggle>
                                                <Dropdown.Menu className="px-3" style={{minWidth:'200px'}}>
                                                    <div className="dropdown-animate">
                                                        {DISH_CATEGORIES.map(category => (
                                                            <Form.Check key={category.id} inline type="checkbox" id={`filter-cat-${category.id}`} label={category.name} checked={filterCategories.includes(category.id)} onChange={() => toggleFilterCategory(category.id)} className="my-1" />
                                                        ))}
                                                    </div>
                                                </Dropdown.Menu>
                                            </Dropdown>
                                            {isFiltered && <span className="text-success text-decoration-underline" style={{cursor:'pointer'}} onClick={clearFilters}>Clear all</span>}
                                        </div>
                                        
                                        {/* Dishes List */}
                                        {displayedDishes.length === 0 ? (
                                            !isFiltered ? (
                                                <div className="alert alert-light">
                                                    No dishes found. <span onClick={() => setShowAddDishModal(true)} style={{textDecoration: "underline", cursor: "pointer"}}>Add your first dish!</span>
                                                </div>
                                            ) : (
                                                <div className="alert alert-light">
                                                    No dishes match your filter selection. <span className="text-decoration-underline" style={{cursor:'pointer'}} onClick={clearFilters}>Clear filters</span>.
                                                </div>
                                            )
                                        ) : (
                                            <div className="row g-3">
                                                {displayedDishes.map((dish, index) => (
                                                    <div key={`dish-${dish.id}`} className="col-12 col-md-6 mb-3">
                                                        <div className="card rounded-4 shadow-sm border" style={{ height: "170px", overflow: "hidden" }}>
                                                            <div className="row g-0 h-100">
                                                                <div className="col-8">
                                                                    <div className="card-body py-3 px-4 d-flex flex-column h-100">
                                                                        <h5 className="card-title fw-bold fs-6 mb-1" style={{ lineHeight: "1.2" }}>{dish.name}</h5>
                                                                        <p className="card-text text-muted small mt-1 mb-2" style={{ lineHeight: "1.2", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: "1", WebkitBoxOrient: "vertical" }}>{dish.description}</p>
                                                                        
                                                                        <div className="d-flex align-items-center mt-auto">
                                                                            <div className="form-switch ps-0">
                                                                                <input
                                                                                    className="form-check-input mt-1 me-2"
                                                                                    type="checkbox"
                                                                                    id={`availableToggle-${dish.id}`}
                                                                                    checked={dish.isAvailable}
                                                                                    style={{
                                                                                        backgroundColor: dish.isAvailable ? '#1b1b1b' : '#c0c0c0',
                                                                                        borderColor: dish.isAvailable ? '#1b1b1b' : '#c0c0c0',
                                                                                        cursor: togglingDishId === dish.id ? 'wait' : 'pointer',
                                                                                        opacity: togglingDishId === dish.id ? 0.7 : 1,
                                                                                        transform: 'scale(1.2)',
                                                                                        transformOrigin: 'center',
                                                                                        margin: '0 0.5rem 0 0'
                                                                                    }}
                                                                                    onChange={() => handleToggleAvailability(dish.id, dish.isAvailable)}
                                                                                    disabled={togglingDishId === dish.id}
                                                                                />
                                                                                <label 
                                                                                    className="" 
                                                                                    htmlFor={`availableToggle-${dish.id}`}
                                                                                    onClick={() => handleToggleAvailability(dish.id, dish.isAvailable)}
                                                                                    style={{ 
                                                                                        cursor: togglingDishId === dish.id ? 'wait' : 'pointer',
                                                                                        opacity: togglingDishId === dish.id ? 0.7 : 1
                                                                                    }}
                                                                                >
                                                                                    {togglingDishId === dish.id ? 'Updating...' : (dish.isAvailable ? 'Available' : 'Unavailable')}
                                                                                </label>
                                                                            </div>
                                                                            
                                                                            <div className="d-flex ms-auto">
                                                                                <button
                                                                                    className="btn btn-sm btn-outline-dark rounded-pill px-3 py-1 me-2"
                                                                                    style={{ fontSize: "0.8rem" }}
                                                                                    onClick={() => handleDishUpdate(dish)}
                                                                                    disabled={loading}
                                                                                >
                                                                                    Edit
                                                                                </button>
                                                                                <button
                                                                                    className="btn btn-sm btn-outline-danger rounded-circle"
                                                                                    style={{
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        justifyContent: 'center',
                                                                                        width: '32px',
                                                                                        height: '32px',
                                                                                        padding: 0
                                                                                    }}
                                                                                    onClick={() => handleDeleteDish(dish.id, dish.name)}
                                                                                    disabled={deletingDishId === dish.id}
                                                                                >
                                                                                    {deletingDishId === dish.id ? '.' : <i className="bi bi-trash" style={{ fontSize: "0.7rem" }}></i>}
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="col-4 p-0 h-100">
                                                                    <img
                                                                        src={dish.imageUrl || DEFAULT_IMAGE_PLACEHOLDER}
                                                                        alt={dish.name}
                                                                        className="h-100 w-100"
                                                                        style={{ objectFit: "cover" }}
                                                                        onError={(e) => {
                                                                            e.target.onerror = null;
                                                                            e.target.src = DEFAULT_IMAGE_PLACEHOLDER;
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                            {updatedDishes[dish.id] && (
                                                                <div className="position-absolute top-0 start-0 end-0 bg-opacity-90 text-white text-center py-1 small" 
                                                                    style={{
                                                                        background: updatedDishes[dish.id].includes('unavailable') ? '#f8b02b' : '#28a745',
                                                                        zIndex: 10
                                                                    }}
                                                                >
                                                                    <small style={{ fontSize: "0.7rem" }}><i className={`bi ${updatedDishes[dish.id].includes('unavailable') ? 'bi-exclamation-circle' : 'bi-check-circle'} me-1`}></i> {updatedDishes[dish.id]}</small>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Dish Modal */}
            <Modal 
                show={showAddDishModal} 
                onHide={() => setShowAddDishModal(false)}
                size="lg"
                centered
                contentClassName="rounded-5 py-2 px-4"
            >
                <Modal.Header closeButton>
                    <Modal.Title className="fw-bold">Add New Dish</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="row">
                        <div className="col-md-4 text-center">
                            {/* Image Upload Section */}
                            <div 
                                className="position-relative d-inline-block cursor-pointer mb-3"
                                style={{ cursor: 'pointer' }}
                                onClick={handleNewDishImageClick}
                            >
                                {previewImage ? (
                                    <div className="position-relative">
                                        <img 
                                            src={previewImage} 
                                            alt="Dish Preview" 
                                            className="rounded"
                                            style={{ width: '180px', height: '180px', objectFit: 'cover' }}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-danger position-absolute rounded-circle"
                                            style={{ 
                                                top: '5px', 
                                                right: '5px', 
                                                padding: '0.2rem 0.5rem',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
                                            }}
                                            onClick={handleRemoveImage}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ) : (
                                    <div 
                                        className="rounded bg-light d-flex justify-content-center align-items-center border"
                                        style={{ width: '180px', height: '180px', borderStyle: 'dashed', borderColor: '#ccc' }}
                                    >
                                        <img src={DEFAULT_IMAGE_PLACEHOLDER} alt="Dish Preview" className="img-fluid" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                )}
                                <div className="mt-2 small text-muted">
                                    Click to upload dish image
                                </div>
                            </div>
                            <input 
                                type="file" 
                                ref={fileInputRef}
                                className="d-none" 
                                onChange={handleNewDishFileChange} 
                                accept="image/*"
                            />
                        </div>
                        
                        <div className="col-md-8">
                            {/* Dish Details Form */}
                            <div className="mb-3">
                                <label htmlFor="dishName" className="form-label fw-medium">Dish Name <span className="text-danger">*</span></label>
                                <input
                                    id="dishName"
                                    type="text"
                                    name="name"
                                    value={newDish.name}
                                    onChange={handleNewDishChange}
                                    className="form-control"
                                    required
                                />
                            </div>
                            
                            <div className="mb-3">
                                <label htmlFor="dishDescription" className="form-label fw-medium">Description <span className="text-danger">*</span></label>
                                <textarea
                                    id="dishDescription"
                                    name="description"
                                    value={newDish.description}
                                    onChange={handleNewDishChange}
                                    className="form-control"
                                    rows="3"
                                    required
                                ></textarea>
                            </div>
                            
                            <div className="mb-3">
                                <label htmlFor="dishCategory" className="form-label fw-medium">
                                    Category <span className="text-danger">*</span>
                                    <small className="text-muted fw-light ms-2">(Hold Ctrl/Cmd key to select multiple)</small>
                                </label>
                                <select
                                    id="dishCategory"
                                    name="category"
                                    value={newDish.category}
                                    onChange={handleCategoryChange}
                                    className="form-select"
                                    required
                                    multiple
                                    size="5"
                                    style={{ height: "auto" }}
                                >
                                    {DISH_CATEGORIES.map(category => (
                                        <option key={`category-${category.id}`} value={category.id}>
                                            {category.name}
                                        </option>
                                    ))}
                                </select>
                                {newDish.category.length > 0 && (
                                    <div className="mt-2">
                                        <small className="text-muted">Selected: </small>
                                        <div className="d-flex flex-wrap gap-1 mt-1">
                                            {newDish.category.map(catId => (
                                                <span key={`new-selected-category-${catId}`} className="badge bg-success">
                                                    {DISH_CATEGORIES.find(c => c.id === catId)?.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div className="mb-3">
                                <label className="form-label fw-medium d-flex justify-content-between">
                                    <span>Sizes <span className="text-danger">*</span></span>
                                </label>
                                
                                {sizes.map((size, index) => (
                                    <div key={`size-${index}`} className="d-flex mb-2 align-items-center">
                                        <input
                                            type="text"
                                            value={size.size}
                                            onChange={(e) => handleSizeChange(index, 'size', e.target.value)}
                                            className="form-control me-2 w-50"
                                            placeholder="Small, Medium, 16oz, etc)"
                                            required
                                        />
                                        <div className="input-group w-50">
                                            <span className="input-group-text">$</span>
                                            <input
                                                type="number"
                                                value={size.price}
                                                onChange={(e) => handleSizeChange(index, 'price', e.target.value)}
                                                className="form-control"
                                                placeholder="Price"
                                                min="0"
                                                step="0.01"
                                                required
                                            />
                                        </div>
                                        {sizes.length > 1 && (
                                            <button
                                                type="button"
                                                className="btn btn-outline-danger ms-2"
                                                onClick={() => removeSize(index)}
                                            >
                                                <i className="bi bi-trash"></i>
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <div className="d-flex">
                                    <a 
                                        className="text-dark ms-auto"
                                        style={{ fontSize: "0.9rem", cursor: "pointer" }} 
                                        onClick={addSize}
                                    >
                                        <u>Add another size</u>
                                    </a>
                                </div>

                            </div>
                            
                            <div className="mb-3">
                                <label className="form-label fw-medium">Ingredients</label>
                                <div className="input-group mb-2">
                                    <input
                                        type="text"
                                        value={ingredientInput}
                                        onChange={(e) => setIngredientInput(e.target.value)}
                                        className="form-control"
                                        placeholder="Add ingredient"
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-outline-dark"
                                        onClick={addIngredient}
                                    >
                                        Add
                                    </button>
                                </div>
                                
                                <div className="d-flex flex-wrap gap-2 mt-2">
                                    {newDish.ingredients.map((ingredient, index) => (
                                        <div key={`new-ingredient-${index}-${ingredient}`} className="badge bg-success text-light p-2 d-flex align-items-center">
                                            {ingredient}
                                            <button
                                                type="button"
                                                className="btn-close btn-close-white ms-2"
                                                style={{ fontSize: '0.6rem' }}
                                                onClick={() => removeIngredient(index)}
                                            ></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="mb-3">
                                <label className="form-label fw-medium my-2">Availability Status</label>
                                <div className="d-flex align-items-center">
                                    <div className="form-check form-switch">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id="isAvailable"
                                            checked={newDish.isAvailable}
                                            style={{
                                                backgroundColor: newDish.isAvailable ? '#1b1b1b' : '#c0c0c0',
                                                borderColor: newDish.isAvailable ? '#1b1b1b' : '#c0c0c0',
                                                cursor: 'pointer',
                                                outline: 'none',
                                                boxShadow: 'none'
                                            }}
                                            onChange={() => setNewDish({...newDish, isAvailable: !newDish.isAvailable})}
                                        />
                                        <label 
                                            className="form-check-label ms-0" 
                                            htmlFor="isAvailable"
                                            onClick={() => setNewDish({...newDish, isAvailable: !newDish.isAvailable})}
                                            style={{ 
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {newDish.isAvailable ? 'Available' : 'Unavailable'}
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="outline-dark rounded-5 py-1 px-3" onClick={() => setShowAddDishModal(false)}>
                        Cancel
                    </Button>
                    <Button 
                        variant="dark rounded-5 py-1 px-3" 
                        onClick={handleAddDish}
                        disabled={loading || !newDish.name || !newDish.description || sizes.some(s => !s.size || !s.price)}
                    >
                        {loading ? 'Adding...' : 'Add Dish'}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Update Dish Modal */}
            <Modal 
                show={showUpdateDishModal} 
                onHide={() => setShowUpdateDishModal(false)}
                size="lg"
                centered
                contentClassName="rounded-5 py-2 px-4"
            >
                <Modal.Header closeButton>
                    <Modal.Title className="fw-bold">Update Dish</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="row">
                        <div className="col-md-4 text-center">
                            {/* Image Upload Section */}
                            <div 
                                className="position-relative d-inline-block cursor-pointer mb-3"
                                style={{ cursor: 'pointer' }}
                                onClick={handleUpdateDishImageClick}
                            >
                                {updatePreviewImage ? (
                                    <div className="position-relative">
                                        <img 
                                            src={updatePreviewImage} 
                                            alt="Dish Preview" 
                                            className="rounded"
                                            style={{ width: '180px', height: '180px', objectFit: 'cover' }}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-danger position-absolute rounded-circle"
                                            style={{ 
                                                top: '5px', 
                                                right: '5px', 
                                                padding: '0.2rem 0.5rem',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
                                            }}
                                            onClick={handleRemoveUpdateImage}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ) : (
                                    <div 
                                        className="rounded bg-light d-flex justify-content-center align-items-center border"
                                        style={{ width: '180px', height: '180px', borderStyle: 'dashed', borderColor: '#ccc' }}
                                    >
                                        <img src={DEFAULT_IMAGE_PLACEHOLDER} alt="Dish Preview" className="img-fluid" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                )}
                                <div className="mt-2 small text-muted">
                                    Click to upload dish image
                                </div>
                            </div>
                            <input 
                                type="file" 
                                ref={updateFileInputRef}
                                className="d-none" 
                                onChange={handleUpdateDishFileChange} 
                                accept="image/*"
                            />
                        </div>
                        
                        <div className="col-md-8">
                            {/* Dish Details Form */}
                            <div className="mb-3">
                                <label htmlFor="updateDishName" className="form-label fw-medium">Dish Name <span className="text-danger">*</span></label>
                                <input
                                    id="updateDishName"
                                    type="text"
                                    name="name"
                                    value={updateDish.name}
                                    onChange={handleUpdateDishChange}
                                    className="form-control"
                                    required
                                />
                            </div>
                            
                            <div className="mb-3">
                                <label htmlFor="updateDishDescription" className="form-label fw-medium">Description <span className="text-danger">*</span></label>
                                <textarea
                                    id="updateDishDescription"
                                    name="description"
                                    value={updateDish.description}
                                    onChange={handleUpdateDishChange}
                                    className="form-control"
                                    rows="3"
                                    required
                                ></textarea>
                            </div>
                            
                            <div className="mb-3">
                                <label htmlFor="updateDishCategory" className="form-label fw-medium">
                                    Category <span className="text-danger">*</span>
                                    <small className="text-muted fw-light ms-2">(Hold Ctrl/Cmd key to select multiple)</small>
                                </label>
                                <select
                                    id="updateDishCategory"
                                    name="category"
                                    value={updateDish.category}
                                    onChange={handleUpdateCategoryChange}
                                    className="form-select"
                                    required
                                    multiple
                                    size="5"
                                    style={{ height: "auto" }}
                                >
                                    {DISH_CATEGORIES.map(category => (
                                        <option key={`update-category-${category.id}`} value={category.id}>
                                            {category.name}
                                        </option>
                                    ))}
                                </select>
                                {updateDish.category.length > 0 && (
                                    <div className="mt-2">
                                        <small className="text-muted">Selected: </small>
                                        <div className="d-flex flex-wrap gap-1 mt-1">
                                            {updateDish.category.map(catId => (
                                                <span key={`selected-category-${catId}`} className="badge bg-success">
                                                    {DISH_CATEGORIES.find(c => c.id === catId)?.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div className="mb-3">
                                <label className="form-label fw-medium d-flex justify-content-between">
                                    <span>Sizes <span className="text-danger">*</span></span>
                                </label>
                                
                                {updateSizes.map((size, index) => (
                                    <div key={`update-size-${index}`} className="d-flex mb-2 align-items-center">
                                        <input
                                            type="text"
                                            value={size.size}
                                            onChange={(e) => handleUpdateSizeChange(index, 'size', e.target.value)}
                                            className="form-control me-2 w-50"
                                            placeholder="Small, Medium, 16oz, etc)"
                                            required
                                        />
                                        <div className="input-group w-50">
                                            <span className="input-group-text">$</span>
                                            <input
                                                type="number"
                                                value={size.price}
                                                onChange={(e) => handleUpdateSizeChange(index, 'price', e.target.value)}
                                                className="form-control"
                                                placeholder="Price"
                                                min="0"
                                                step="0.01"
                                                required
                                            />
                                        </div>
                                        {updateSizes.length > 1 && (
                                            <button
                                                type="button"
                                                className="btn btn-outline-danger ms-2"
                                                onClick={() => removeUpdateSize(index)}
                                            >
                                                <i className="bi bi-trash"></i>
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <div className="d-flex">
                                    <a 
                                        className="text-dark ms-auto"
                                        style={{ fontSize: "0.9rem", cursor: "pointer" }} 
                                        onClick={addUpdateSize}
                                    >
                                        <u>Add another size</u>
                                    </a>
                                </div>
                            </div>
                            
                            <div className="mb-3">
                                <label className="form-label fw-medium">Ingredients</label>
                                <div className="input-group mb-2">
                                    <input
                                        type="text"
                                        value={updateIngredientInput}
                                        onChange={(e) => setUpdateIngredientInput(e.target.value)}
                                        className="form-control"
                                        placeholder="Add ingredient"
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-outline-dark"
                                        onClick={addUpdateIngredient}
                                    >
                                        Add
                                    </button>
                                </div>
                                
                                <div className="d-flex flex-wrap gap-2 mt-2">
                                    {updateDish.ingredients.map((ingredient, index) => (
                                        <div key={`update-ingredient-${index}-${ingredient}`} className="badge bg-success text-light p-2 d-flex align-items-center">
                                            {ingredient}
                                            <button
                                                type="button"
                                                className="btn-close btn-close-white ms-2"
                                                style={{ fontSize: '0.6rem' }}
                                                onClick={() => removeUpdateIngredient(index)}
                                            ></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="outline-dark rounded-5 py-1 px-3" onClick={() => setShowUpdateDishModal(false)}>
                        Cancel
                    </Button>
                    <Button 
                        variant="dark rounded-5 py-1 px-3" 
                        onClick={handleUpdateDishSubmit}
                        disabled={loading || !updateDish.name || !updateDish.description || updateSizes.some(s => !s.size || !s.price)}
                    >
                        {loading ? 'Updating...' : 'Update Dish'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

export default ManageDishes;