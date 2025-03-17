import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
axios.defaults.withCredentials = true;

/* Customer profile management thunks */

// Register a new customer account
export const createCustomer = createAsyncThunk(
    "customers/createCustomer",
    async (customerData, { rejectWithValue }) => {
        try {
            const response = await axios.post("/api/customers", customerData, {
                headers: { "Content-Type": "application/json" },
            });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || "Something went wrong");
        }
    }
);

// Update existing customer profile information
export const updateCustomer = createAsyncThunk(
    "customers/updateCustomer",
    async ({ customerId, customerData }, { rejectWithValue }) => {
        try {
            // Validate required profile fields before sending
            const requiredFields = ['first_name', 'last_name', 'email', 'phone', 'address', 'date_of_birth'];
            const missingFields = requiredFields.filter(field => !customerData[field]);
            
            if (missingFields.length > 0) {
                return rejectWithValue(`Missing required fields: ${missingFields.join(', ')}`);
            }
            
            const response = await axios.put(`/api/customers/${customerId}`, customerData, {
                headers: { 
                    "Content-Type": "application/json"
                },
                withCredentials: true
            });
            
            // Return standardized customer object
            return response.data.customer || response.data.updatedCustomer || response.data;
        } catch (error) {
            // Extract most specific error message for user feedback
            const errorMessage = 
                error.response?.data?.error || 
                error.response?.data?.message || 
                error.message || 
                "Failed to update customer data";
                
            return rejectWithValue(errorMessage);
        }
    }
);

// Retrieve customer profile by ID
export const fetchCustomer = createAsyncThunk(
    "customers/fetchCustomer",
    async (customerId, { rejectWithValue }) => {
        try {
            const response = await axios.get(`/api/customers/${customerId}`);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || "Failed to fetch customer data");
        }
    }
);


/* Customer slice definition */
const customerSlice = createSlice({
    name: "customers",
    initialState: {
        customer: null,
        loading: false,
        success: false,
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            // Account creation states
            .addCase(createCustomer.pending, (state) => {
                state.loading = true;
                state.success = false;
                state.error = null;
            })
            .addCase(createCustomer.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                state.error = null;
                state.customer = action.payload;
            })
            .addCase(createCustomer.rejected, (state, action) => {
                state.loading = false;
                state.success = false;
                state.error = action.payload;
            })
            
            // Profile retrieval states
            .addCase(fetchCustomer.pending, (state) => {
                state.loading = true;
                state.success = false;
                state.error = null;
            })
            .addCase(fetchCustomer.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                state.error = null;
                state.customer = action.payload;
            })
            .addCase(fetchCustomer.rejected, (state, action) => {
                state.loading = false;
                state.success = false;
                state.error = action.payload;
            })
            
            // Profile update states
            .addCase(updateCustomer.pending, (state) => {
                state.loading = true;
                state.success = false;
                state.error = null;
            })
            .addCase(updateCustomer.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                state.error = null;
                state.customer = action.payload;
            })
            .addCase(updateCustomer.rejected, (state, action) => {
                state.loading = false;
                state.success = false;
                state.error = action.payload;
            });
    },
});

export default customerSlice.reducer;
