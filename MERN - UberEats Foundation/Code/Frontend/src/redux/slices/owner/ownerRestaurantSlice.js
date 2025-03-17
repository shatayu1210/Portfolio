import { createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
axios.defaults.withCredentials = true;

const initialState = {
    restaurants: [],
    loading: false,
    error: null
};

const ownerRestaurantSlice = createSlice({
    name: 'ownerRestaurants',
    initialState,
    reducers: {
        fetchRestaurantsStart(state) {
            state.loading = true;
            state.error = null;
        },
        fetchRestaurantsSuccess(state, action) {
            state.loading = false;
            state.restaurants = action.payload;
        },
        fetchRestaurantsFailure(state, action) {
            state.loading = false;
            state.error = action.payload;
        }
    }
});

export const { 
    fetchRestaurantsStart,
    fetchRestaurantsSuccess,
    fetchRestaurantsFailure
} = ownerRestaurantSlice.actions;

// Thunk action to fetch owner's restaurants
export const fetchOwnerRestaurants = (ownerId) => async (dispatch) => {
    console.log('fetchOwnerRestaurants called with ownerId:', ownerId);
    
    if (!ownerId) {
        console.error('fetchOwnerRestaurants called with undefined or null ownerId');
        dispatch(fetchRestaurantsFailure('Owner ID is missing'));
        return;
    }
    
    try {
        dispatch(fetchRestaurantsStart());
        console.log(`Making API request to: http://127.0.0.1:3000/api/restaurants/owner/${ownerId}`);
        
        const response = await axios.get(`http://127.0.0.1:3000/api/restaurants/owner/${ownerId}`);
        console.log('API response received:', response.data);
        
        dispatch(fetchRestaurantsSuccess(response.data));
    } catch (error) {
        console.error('Error fetching owner restaurants:', error);
        
        // Check if it's a 404 error with "No Restaurants found" message
        if (error.response && error.response.status === 404 && 
            error.response.data && error.response.data.error && 
            error.response.data.error.includes('No Restaurants found')) {
            
            console.log('No restaurants found for this owner, showing empty list');
            // Dispatch success with empty array instead of error
            dispatch(fetchRestaurantsSuccess([]));
        } else {
            // For other errors, dispatch failure
            dispatch(fetchRestaurantsFailure(error.message || 'Failed to fetch restaurants'));
        }
    }
};

export default ownerRestaurantSlice.reducer;