import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../../config/axios";

// Async thunk to create a customer
export const createCustomer = createAsyncThunk(
    "customers/createCustomer",
    async (formData, { rejectWithValue }) => {
        try {
            // Check if there's an image file
            const hasImage = formData.has('image');
            
            if (hasImage) {
                // With image: Use FormData approach
                const response = await axios.post("/api/customers/register", formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });
                return response.data;
            } else {
                // No image: Use direct JSON approach
                // Convert FormData to JSON object
                const jsonData = {
                    firstName: formData.get('firstName'),
                    lastName: formData.get('lastName'),
                    email: formData.get('email'),
                    password: formData.get('password'),
                    phone: formData.get('phone'),
                    dateOfBirth: formData.get('dateOfBirth'),
                    addresses: JSON.parse(formData.get('addresses'))
                };
                
                const response = await axios.post("/api/customers/register", jsonData, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                return response.data;
            }
        } catch (error) {
            if (error.response?.data?.errors) {
                return rejectWithValue({
                    message: error.response.data.message,
                    errors: error.response.data.errors
                });
            }
            
            return rejectWithValue({
                message: error.response?.data?.message || error.message,
                errors: []
            });
        }
    }
);

// Async thunk to update customer details
export const updateCustomer = createAsyncThunk(
    "customers/updateCustomer",
    async ({ customerId, customerData }, { rejectWithValue }) => {
        try {

            
            // Add validation for required fields
            const requiredFields = ['firstName', 'lastName', 'email', 'phone'];
            const missingFields = requiredFields.filter(field => !customerData[field]);
            
            if (missingFields.length > 0) {
                return rejectWithValue(`Missing required fields: ${missingFields.join(', ')}`);
            }
            
            const response = await axios.put(`/api/customers/profile/${customerId}`, customerData, {
                headers: { 
                    "Content-Type": "application/json"
                }
            });
            
            
            // Return the customer object from the response
            return response.data.customer || response.data.updatedCustomer || response.data;
        } catch (error) {
            console.error('Update error:', error);
            // Extract the most specific error message
            const errorMessage = 
                error.response?.data?.error || 
                error.response?.data?.message || 
                error.message || 
                "Failed to update customer data";
                
            console.error('Error detail:', errorMessage);
            return rejectWithValue(errorMessage);
        }
    }
);

// Async thunk to fetch customer details by ID
export const fetchCustomer = createAsyncThunk(
    "customers/fetchCustomer",
    async (customerId, { rejectWithValue }) => {
        try {
            const response = await axios.get(`/api/customers/profile/${customerId}`);
            return response.data; // Assuming backend returns customer data
        } catch (error) {
            return rejectWithValue(error.response?.data || "Failed to fetch customer data");
        }
    }
);

const customerSlice = createSlice({
    name: "customer",
    initialState: {
        customer: null,
        loading: false,
        success: false,
        error: null
    },
    reducers: {
        clearCustomerError: (state) => {
            state.error = null;
            state.success = false;
        }
    },
    extraReducers: (builder) => {
        builder
            // Create Customer cases
            .addCase(createCustomer.pending, (state) => {
                state.loading = true;
                state.success = false;
                state.error = null;
            })
            .addCase(createCustomer.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                state.error = null;
                state.customer = action.payload.customer;
            })
            .addCase(createCustomer.rejected, (state, action) => {
                state.loading = false;
                state.success = false;
                state.error = action.payload;
            })
            
            // Fetch Customer cases
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
            
            // Update Customer cases
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
    }
});

export const { clearCustomerError } = customerSlice.actions;
export default customerSlice.reducer;
