import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../../config/axios";

// Set axios defaults
axios.defaults.headers.common['Cache-Control'] = 'no-cache';
axios.defaults.headers.common['Pragma'] = 'no-cache';
axios.defaults.headers.common['Authorization'] = `Bearer ${localStorage.getItem('jwtToken')}`;

// Use the shared axios instance from config/axios.js for all requests
// (interceptor will add JWT automatically)


// Login Customer
export const loginCustomer = createAsyncThunk(
  "customerAuth/loginCustomer",
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        "/api/customers/login",
        credentials
      );

      // Store JWT in localStorage
      if (response.data.token) {
        localStorage.setItem('jwtToken', response.data.token);
      }
      // Return both customer and token for reducer
      return { customer: response.data.customer, token: response.data.token };
    } catch (error) {
      console.error("Login Error:", error.response?.data || error.message);
      return rejectWithValue(error.response?.data.error || "Invalid email or password");
    }
  }
);

// Check Customer Authentication
export const checkCustomerAuth = createAsyncThunk(
  "customerAuth/checkAuth",
  async (_, { rejectWithValue }) => {
    try {
      // First try to get from server
      const response = await axios.get(
        "/api/customers/check-auth"
      );
      
      // console.log("Check Customer Auth Response:", response.data);
      
      if (response.data.isCustomerAuthenticated) {
        return {
          isCustomerAuthenticated: true,
          customer: response.data.customer
        };
      }      
      return { isCustomerAuthenticated: false };
    } catch (error) {
      console.error("Check Customer Auth Error:", error.response?.data || error.message);      
      return { isCustomerAuthenticated: false };
    }
  }
);

// Logout Customer
export const logoutCustomer = createAsyncThunk(
  "customerAuth/logoutCustomer",
  async (_, { rejectWithValue }) => {
    try {
      await axios.post(
        "/api/customers/logout"
      );
      // Remove JWT on logout
      localStorage.removeItem('jwtToken');
      return { success: true };
    } catch (error) {
      console.error("Logout Error:", error.response?.data || error.message);
      return rejectWithValue(error.response?.data || "Something went wrong");
    }
  }
);

// Login Restaurant
export const loginRestaurant = createAsyncThunk(
  "restaurantAuth/loginRestaurant",
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        "/api/restaurants/login",
        credentials
      );
      // Store JWT in localStorage
      if (response.data.token) {
        localStorage.setItem('jwtToken', response.data.token);
      }
      // Return both restaurant and token for reducer
      return { restaurant: response.data.restaurant, token: response.data.token };
    } catch (error) {
      return rejectWithValue(error.response?.data.error || "Invalid email or password");
    }
  }
);

// Check Restaurant Authentication
export const checkRestaurantAuth = createAsyncThunk(
  "restaurantAuth/checkRestaurantAuth",
  async (_, { rejectWithValue }) => {
    try {
      // First try to get from server
      const response = await axios.get(
        "/api/restaurants/check-auth"
      );
      
      // Remove console log to reduce noise
      // console.log("Check Restaurant Auth Response:", response.data);
      
      if (response.data.isRestaurantAuthenticated) {
        return {
          isRestaurantAuthenticated: true,
          restaurant: response.data.restaurant
        };
      }
      
      return { isRestaurantAuthenticated: false };
    } catch (error) {
      console.error("Check Restaurant Auth Error:", error.response?.data || error.message);
      return { isRestaurantAuthenticated: false };
    }
  }
);

// Logout Restaurant
export const logoutRestaurant = createAsyncThunk(
  "restaurantAuth/logoutRestaurant",
  async (_, { rejectWithValue }) => {
    try {
      await axios.post(
        "/api/restaurants/logout"
      );
      // Removing JWT on logout
      localStorage.removeItem('jwtToken');
      return { success: true };
    } catch (error) {
      console.error("Logout Error:", error.response?.data || error.message);
      return rejectWithValue(error.response?.data || "Something went wrong");
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState: {
    customer: null,
    restaurant: null,
    isCustomerAuthenticated: false,
    isRestaurantAuthenticated: false,
    loading: false,
    error: null
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Customer Login
      .addCase(loginCustomer.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginCustomer.fulfilled, (state, action) => {
        state.loading = false;
        state.isCustomerAuthenticated = true;
        state.customer = action.payload.customer;
        state.error = null;
      })
      .addCase(loginCustomer.rejected, (state, action) => {
        state.loading = false;
        state.isCustomerAuthenticated = false;
        state.customer = null;
        state.error = action.payload;
      })
      
      // Check Customer Auth
      .addCase(checkCustomerAuth.pending, (state) => {
        state.loading = true;
      })
      .addCase(checkCustomerAuth.fulfilled, (state, action) => {
        state.loading = false;
        state.isCustomerAuthenticated = action.payload.isCustomerAuthenticated;
        state.customer = action.payload.customer || null;
      })
      .addCase(checkCustomerAuth.rejected, (state, action) => {
        state.loading = false;
        state.isCustomerAuthenticated = false;
        state.customer = null;
        state.error = action.payload;
      })
      
      // Customer Logout
      .addCase(logoutCustomer.fulfilled, (state) => {
        state.isCustomerAuthenticated = false;
        state.customer = null;
      })
      
      // Restaurant Login
      .addCase(loginRestaurant.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginRestaurant.fulfilled, (state, action) => {
        state.loading = false;
        state.isRestaurantAuthenticated = true;
        state.restaurant = action.payload.restaurant;
        state.error = null;
      })
      .addCase(loginRestaurant.rejected, (state, action) => {
        state.loading = false;
        state.isRestaurantAuthenticated = false;
        state.restaurant = null;
        state.error = action.payload;
      })
      
      // Check Restaurant Auth
      .addCase(checkRestaurantAuth.pending, (state) => {
        state.loading = true;
      })
      .addCase(checkRestaurantAuth.fulfilled, (state, action) => {
        state.loading = false;
        state.isRestaurantAuthenticated = action.payload.isRestaurantAuthenticated;
        state.restaurant = action.payload.restaurant || null;
        state.error = null;
      })
      .addCase(checkRestaurantAuth.rejected, (state, action) => {
        state.loading = false;
        state.isRestaurantAuthenticated = false;
        state.restaurant = null;
        state.error = action.payload;
      })
      
      // Restaurant Logout
      .addCase(logoutRestaurant.fulfilled, (state) => {
        state.isRestaurantAuthenticated = false;
        state.restaurant = null;
      });
  }
});

export default authSlice.reducer;