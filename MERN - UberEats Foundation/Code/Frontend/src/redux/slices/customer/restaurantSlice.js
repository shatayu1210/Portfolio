import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
axios.defaults.withCredentials = true;

// Async thunk to fetch all restaurants
export const fetchRestaurants = createAsyncThunk(
  "restaurants/fetchRestaurants",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get("/api/restaurants");
      return response.data; // Returns an array of restaurants
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || "Failed to fetch restaurants");
    }
  }
);

// Async thunk to fetch restaurant details along with its dishes
export const fetchRestaurantDetails = createAsyncThunk(
  "restaurants/fetchDetails",
  async (id, { rejectWithValue }) => {
    try {
      const restaurantRes = await axios.get(`/api/restaurants/${id}`);
      
      if (!restaurantRes.data) {
        return rejectWithValue("Restaurant not found");
      }
      
      const dishesRes = await axios.get(`/api/dishes/restaurant/${id}`);
      return { 
        restaurant: restaurantRes.data, 
        dishes: dishesRes.data || []  // Ensure dishes is always an array
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || "Failed to fetch restaurant details");
    }
  }
);

const restaurantSlice = createSlice({
  name: "restaurants",
  initialState: {
    restaurants: [],
    restaurant: null,
    dishes: [],
    status: "idle", // idle | loading | succeeded | failed
    error: null,
  },
  reducers: {
    clearRestaurantDetails: (state) => {
      state.restaurant = null;
      state.dishes = [];
      state.status = "idle";
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch all restaurants
      .addCase(fetchRestaurants.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchRestaurants.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.restaurants = action.payload || []; // Ensure it's always an array
      })
      .addCase(fetchRestaurants.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })
      
      // Fetch a specific restaurant and its dishes
      .addCase(fetchRestaurantDetails.pending, (state) => {
        state.status = "loading";
        state.restaurant = null;
        state.dishes = [];
        state.error = null;
      })
      .addCase(fetchRestaurantDetails.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.restaurant = action.payload.restaurant;
        state.dishes = action.payload.dishes || [];
      })
      .addCase(fetchRestaurantDetails.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
        state.restaurant = null;
        state.dishes = [];
      });
  },
});

export const { clearRestaurantDetails } = restaurantSlice.actions;
export default restaurantSlice.reducer;