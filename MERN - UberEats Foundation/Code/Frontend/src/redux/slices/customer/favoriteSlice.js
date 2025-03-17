import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

// Base URL for API
const API_BASE_URL = "http://127.0.0.1:3000/api/favorites";

// Async Thunks
export const fetchFavorites = createAsyncThunk(
    "favorites/fetchFavorites",
    async (customerId, { rejectWithValue }) => {
        try {
            const response = await axios.get(`http://127.0.0.1:3000/api/favorites/${customerId}`);
            return response.data.map((fav) => fav.restaurant_id);
        } catch (error) {
            return rejectWithValue(error.response ? error.response.data : error.message);
        }
    }
);

export const addFavorite = createAsyncThunk(
    "favorites/addFavorite",
    async ({ customerId, restaurantId }, { rejectWithValue }) => {
        try {
            await axios.post("http://127.0.0.1:3000/api/favorites", { customer_id: customerId, restaurant_id: restaurantId });
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
            await axios.delete(`http://127.0.0.1:3000/api/favorites`, {
                data: { customer_id: customerId, restaurant_id: restaurantId } 
            });
            return restaurantId;
        } catch (error) {
            return rejectWithValue(error.response ? error.response.data : error.message);
        }
    }
);

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
            })
            .addCase(fetchFavorites.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.favoriteRestaurants = action.payload; // Store as an array
            })
            .addCase(fetchFavorites.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload;
            })
            .addCase(addFavorite.fulfilled, (state, action) => {
                if (!state.favoriteRestaurants.includes(action.payload)) {
                    state.favoriteRestaurants.push(action.payload);
                }
            })
            .addCase(removeFavorite.fulfilled, (state, action) => {
                state.favoriteRestaurants = state.favoriteRestaurants.filter(id => id !== action.payload);
            });
    },
});

export default favoriteSlice.reducer;