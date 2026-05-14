import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../../config/axios";

// Base URL for API - use proxied path instead of full URL
const API_BASE_URL = "/api/customers";

// Async Thunks
export const fetchFavorites = createAsyncThunk(
    "favorites/fetchFavorites",
    async (customerId, { rejectWithValue }) => {
        try {
            // Check if customerId is provided and valid
            if (!customerId) {
                console.log("No customer ID provided for fetching favorites");
                return []; // Return empty array instead of throwing error
            }
            
            const response = await axios.get(`${API_BASE_URL}/favorites/${customerId}`, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return response.data.favorites;
        } catch (error) {
            console.log("Error fetching favorites:", error.message);
            // If it's a 404 error, just return an empty array instead of rejecting
            if (error.response && error.response.status === 404) {
                console.log("No favorites found, returning empty array");
                return [];
            }
            return rejectWithValue(error.response ? error.response.data : error.message);
        }
    }
);

export const addFavorite = createAsyncThunk(
    "favorites/addFavorite",
    async ({ customerId, restaurantId }, { rejectWithValue }) => {
        try {
            await axios.post(`${API_BASE_URL}/favorites/add`, { restaurantId }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return restaurantId;
        } catch (error) {
            return rejectWithValue(error.response ? error.response.data : error.message);
        }
    }
);

export const removeFavorite = createAsyncThunk(
    "favorites/removeFavorite",
    async ({ customerId, restaurantId }, { rejectWithValue }) => {
        try {
            if (!customerId || !restaurantId) {
                console.log("Missing customerId or restaurantId for removeFavorite");
                return null;
            }
            
            await axios.delete(`${API_BASE_URL}/favorites/remove/${restaurantId}`, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return restaurantId;
        } catch (error) {
            console.log("Error removing favorite:", error.message);
            return rejectWithValue(error.response ? error.response.data : error.message);
        }
    }
);

// Add selector function
export const selectFavorites = state => state.favorites.favoriteRestaurants;

// Favorite Slice
const favoriteSlice = createSlice({
    name: "favorites",
    initialState: {
        favoriteRestaurants: [],
        status: "idle",
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchFavorites.pending, (state) => {
                state.status = "loading";
                state.error = null;
            })
            .addCase(fetchFavorites.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.error = null;
                // Ensure payload is always an array
                state.favoriteRestaurants = Array.isArray(action.payload) ? action.payload : [];
            })
            .addCase(fetchFavorites.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload;
                // Keep the previous array to avoid undefined errors
                if (!Array.isArray(state.favoriteRestaurants)) {
                    state.favoriteRestaurants = [];
                }
            })
            .addCase(addFavorite.fulfilled, (state, action) => {
                if (!action.payload) return;
                
                // Check if the ID is already in favorites
                const isAlreadyInFavorites = state.favoriteRestaurants.some(id => 
                    id === action.payload || 
                    (typeof id === 'object' && id !== null && (id._id === action.payload || id.id === action.payload))
                );
                
                if (!isAlreadyInFavorites) {
                    state.favoriteRestaurants.push(action.payload);
                }
            })
            .addCase(removeFavorite.fulfilled, (state, action) => {
                if (!action.payload) return;
                
                // Filter out the ID being removed, handling both string IDs and object IDs
                state.favoriteRestaurants = state.favoriteRestaurants.filter(id => {
                    if (typeof id === 'object' && id !== null) {
                        return (id._id !== action.payload && id.id !== action.payload);
                    }
                    return id !== action.payload;
                });
            });
    },
});

export default favoriteSlice.reducer;