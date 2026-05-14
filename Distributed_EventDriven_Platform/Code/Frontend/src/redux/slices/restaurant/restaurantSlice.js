import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../../config/axios";

// Initial state
const initialState = {
    // Single restaurant management (for restaurant owners)
    restaurant: null,
    loading: false,
    error: null,
    
    // Restaurant browsing (for customers)
    restaurantList: [],
    dishes: [],
    listStatus: "idle", // idle | loading | succeeded | failed
    listError: null,
    
    // Restaurant details status
    detailsStatus: "idle", // idle | loading | succeeded | failed
    detailsError: null,
    
    // Orders for restaurant dashboard
    orders: [],
    ordersCount: 0,
    ordersStatus: 'idle', // idle | loading | succeeded | failed
    ordersError: null
};

// Async thunk to create a Restaurant
export const createRestaurant = createAsyncThunk(
    "restaurant/createRestaurant",
    async (restaurantData, { rejectWithValue }) => {
        try {
            const response = await axios.post("/api/restaurants/register", restaurantData, {
                headers: { "Content-Type": "application/json" },
            });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || "Something went wrong");
        }
    }
);

// Async thunk to fetch a Restaurant by ID
export const fetchRestaurant = createAsyncThunk(
    "restaurant/fetchRestaurant",
    async (restaurantId, { rejectWithValue }) => {
        try {
            const response = await axios.get(`/api/restaurants/${restaurantId}`);
            
            if (!response.data) {
                return rejectWithValue("Restaurant not found");
            }
            
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.error || "Failed to fetch restaurant");
        }
    }
);


// Async thunk to fetch a Restaurant Profile
export const fetchRestaurantProfile = createAsyncThunk(
    "restaurant/fetchRestaurantProfile",
    async (restaurantId, { rejectWithValue }) => {
        try {
            const response = await axios.get(`/api/restaurants/profile/${restaurantId}`);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.error || "Failed to fetch restaurant profile");
        }
    }
);

// Async thunk to update a Restaurant Profile
export const updateRestaurantProfile = createAsyncThunk(
    "restaurant/updateRestaurantProfile",
    async ({ restaurantId, restaurantData }, { rejectWithValue }) => {
        try {
            const response = await axios.put(`/api/restaurants/profile/${restaurantId}`, restaurantData, {
                headers: { "Content-Type": "application/json" },
            });
            return response.data.restaurant || response.data.updatedRestaurant || response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || "Something went wrong");
        }
    }
);

// Async thunk to update restaurant operating hours
export const updateOperatingHours = createAsyncThunk(
    "restaurant/updateOperatingHours",
    async ({ restaurantId, operatingHours }, { rejectWithValue }) => {
        try {
            const response = await axios.put(`/api/restaurants/operating-hours/${restaurantId}`, { operatingHours }, {
                headers: { "Content-Type": "application/json" },
            });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || "Something went wrong");
        }
    }
);

// Async thunk to toggle restaurant status
export const toggleStatus = createAsyncThunk(
    "restaurant/toggleStatus",
    async (restaurantId, { rejectWithValue }) => {
        try {
            const response = await axios({
                method: 'put',
                url: `/api/restaurants/status/${restaurantId}`,
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                data: JSON.stringify({})
            });
            
            return response.data;
        } catch (error) {
            console.error("Toggle status error:", error);
            return rejectWithValue(
                error.response?.data?.message || 
                "Failed to toggle restaurant status"
            );
        }
    }
);

// Async thunk to toggle delivery
export const toggleDelivery = createAsyncThunk(
    "restaurant/toggleDelivery",
    async (restaurantId, { rejectWithValue }) => {
        try {
            const response = await axios.put(`/api/restaurants/delivery/${restaurantId}`);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || "Something went wrong");
        }
    }
);

// Async thunk to toggle pickup
export const togglePickup = createAsyncThunk(
    "restaurant/togglePickup",
    async (restaurantId, { rejectWithValue }) => {
        try {
            const response = await axios.put(`/api/restaurants/pickup/${restaurantId}`);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || "Something went wrong");
        }
    }
);

// Async thunk to delete restaurant account
export const deleteRestaurant = createAsyncThunk(
    "restaurant/deleteRestaurant", 
    async (restaurantId, { rejectWithValue }) => {
        try {
            const response = await axios.delete(`/api/restaurants/account/${restaurantId}`);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || "Something went wrong");
        }
    }
);

// Async thunk to fetch all restaurants (for customer browsing)
export const fetchRestaurants = createAsyncThunk(
    "restaurant/fetchRestaurants",
    async (_, { rejectWithValue }) => {
        try {
            const response = await axios.get("/api/restaurants");
            return response.data; // Returns an array of restaurants
        } catch (error) {
            return rejectWithValue(error.response?.data?.error || "Failed to fetch restaurants");
        }
    }
);

// Async thunk to fetch orders for a restaurant
export const fetchRestaurantOrders = createAsyncThunk(
    'restaurant/fetchRestaurantOrders',
    async (restaurantId, { rejectWithValue }) => {
        try {
            const response = await axios.get(`/api/restaurants/${restaurantId}/orders`);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || 'Failed to fetch orders');
        }
    }
);

// Async thunk to update an order's status and optional restaurant note
export const updateOrder = createAsyncThunk(
    'restaurant/updateOrder',
    async ({ orderId, status, restaurantNote }, { rejectWithValue }) => {
        try {
            const response = await axios.put(`/api/restaurants/orders/${orderId}/status`, { status, restaurantNote });
            return response.data.order;
        } catch (error) {
            return rejectWithValue(error.response?.data || 'Failed to update order');
        }
    }
);

// Create the slice
const restaurantSlice = createSlice({
    name: "restaurant",
    initialState,
    reducers: {
        clearRestaurant: (state) => {
            state.restaurant = null;
            state.dishes = [];
            state.loading = false;
            state.error = null;
            state.detailsStatus = "idle";
            state.detailsError = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // Create Restaurant
            .addCase(createRestaurant.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createRestaurant.fulfilled, (state, action) => {
                state.loading = false;
                state.restaurant = action.payload;
            })
            .addCase(createRestaurant.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            
            // Fetch Restaurant
            .addCase(fetchRestaurant.pending, (state) => {
                state.detailsStatus = "loading";
                state.detailsError = null;
            })
            .addCase(fetchRestaurant.fulfilled, (state, action) => {
                state.detailsStatus = "succeeded";
                state.restaurant = action.payload;
                state.dishes = action.payload.dishes || [];
            })
            .addCase(fetchRestaurant.rejected, (state, action) => {
                state.detailsStatus = "failed";
                state.detailsError = action.payload;
            })
            
            // Fetch Restaurant Profile
            .addCase(fetchRestaurantProfile.pending, (state) => {
                state.detailsStatus = "loading";
                state.detailsError = null;
            })
            .addCase(fetchRestaurantProfile.fulfilled, (state, action) => {
                state.detailsStatus = "succeeded";
                state.restaurant = action.payload;
            })
            .addCase(fetchRestaurantProfile.rejected, (state, action) => {
                state.detailsStatus = "failed";
                state.detailsError = action.payload;
            })

            // Update Restaurant Profile
            .addCase(updateRestaurantProfile.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateRestaurantProfile.fulfilled, (state, action) => {
                state.loading = false;
                state.restaurant = action.payload.restaurant;
            })
            .addCase(updateRestaurantProfile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            
            // Update Operating Hours
            .addCase(updateOperatingHours.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateOperatingHours.fulfilled, (state, action) => {
                state.loading = false;
                if (state.restaurant) {
                    state.restaurant.operatingHours = action.payload.operatingHours;
                }
            })
            .addCase(updateOperatingHours.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            
            // Toggle Status
            .addCase(toggleStatus.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(toggleStatus.fulfilled, (state, action) => {
                state.loading = false;
                if (state.restaurant) {
                    state.restaurant.status = action.payload.status;
                }
            })
            .addCase(toggleStatus.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            
            // Toggle Delivery
            .addCase(toggleDelivery.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(toggleDelivery.fulfilled, (state, action) => {
                state.loading = false;
                if (state.restaurant) {
                    state.restaurant.offersDelivery = action.payload.offersDelivery;
                }
            })
            .addCase(toggleDelivery.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            
            // Toggle Pickup
            .addCase(togglePickup.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(togglePickup.fulfilled, (state, action) => {
                state.loading = false;
                if (state.restaurant) {
                    state.restaurant.offersPickup = action.payload.offersPickup;
                }
            })
            .addCase(togglePickup.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            
            // Delete Restaurant
            .addCase(deleteRestaurant.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(deleteRestaurant.fulfilled, (state) => {
                state.loading = false;
                state.restaurant = null;
                // We don't need to clean up further as the user will be redirected after deletion
            })
            .addCase(deleteRestaurant.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            
            // Fetch all restaurants (for customer browsing)
            .addCase(fetchRestaurants.pending, (state) => {
                state.listStatus = "loading";
                state.listError = null;
            })
            .addCase(fetchRestaurants.fulfilled, (state, action) => {
                state.listStatus = "succeeded";
                state.restaurantList = action.payload || []; // Ensure it's always an array
            })
            .addCase(fetchRestaurants.rejected, (state, action) => {
                state.listStatus = "failed";
                state.listError = action.payload;
            })
            
            // Fetch restaurant orders
            .addCase(fetchRestaurantOrders.pending, (state) => {
                state.ordersStatus = 'loading';
                state.ordersError = null;
            })
            .addCase(fetchRestaurantOrders.fulfilled, (state, action) => {
                state.ordersStatus = 'succeeded';
                state.orders = action.payload.orders;
                state.ordersCount = action.payload.count;
            })
            .addCase(fetchRestaurantOrders.rejected, (state, action) => {
                state.ordersStatus = 'failed';
                state.ordersError = action.payload;
            })
            
            // Update order status
            .addCase(updateOrder.pending, (state) => {
                state.ordersStatus = 'loading';
                state.ordersError = null;
            })
            .addCase(updateOrder.fulfilled, (state, action) => {
                state.ordersStatus = 'succeeded';
                const updatedOrder = action.payload;
                const idx = state.orders.findIndex(o => o.id === updatedOrder._id || o.id === updatedOrder.id);
                if (idx !== -1) {
                    state.orders[idx].status = updatedOrder.status;
                    state.orders[idx].restaurantNote = updatedOrder.restaurantNote;
                }
            })
            .addCase(updateOrder.rejected, (state, action) => {
                state.ordersStatus = 'failed';
                state.ordersError = action.payload;
            });
    }
});

export const { clearRestaurant } = restaurantSlice.actions;

export default restaurantSlice.reducer;