import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../../config/axios";

// Async thunk to add a new address
export const addAddress = createAsyncThunk(
  "address/addAddress",
  async (addressData, { rejectWithValue }) => {
    try {
      const response = await axios.post(`/api/customers/address`, addressData);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to add address"
      );
    }
  }
);

// Async thunk to update an address
export const updateAddress = createAsyncThunk(
  "address/updateAddress",
  async ({ addressId, addressData }, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `/api/customers/address/${addressId}`,
        addressData
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update address"
      );
    }
  }
);

// Async thunk to delete an address
export const deleteAddress = createAsyncThunk(
  "address/deleteAddress",
  async (addressId, { rejectWithValue }) => {
    try {
      const response = await axios.delete(`/api/customers/address/${addressId}`);
      return { ...response.data, addressId };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to delete address"
      );
    }
  }
);

const addressSlice = createSlice({
  name: "address",
  initialState: {
    addresses: [],
    loading: false,
    error: null,
    success: false,
  },
  reducers: {
    clearAddressState: (state) => {
      state.error = null;
      state.success = false;
    },
    setAddresses: (state, action) => {
      state.addresses = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Add address cases
      .addCase(addAddress.pending, (state) => {
        state.loading = true;
        state.success = false;
        state.error = null;
      })
      .addCase(addAddress.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.addresses = action.payload.addresses || [];
      })
      .addCase(addAddress.rejected, (state, action) => {
        state.loading = false;
        state.success = false;
        state.error = action.payload;
      })
      // Update address cases
      .addCase(updateAddress.pending, (state) => {
        state.loading = true;
        state.success = false;
        state.error = null;
      })
      .addCase(updateAddress.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.addresses = action.payload.addresses || [];
      })
      .addCase(updateAddress.rejected, (state, action) => {
        state.loading = false;
        state.success = false;
        state.error = action.payload;
      })
      // Delete address cases
      .addCase(deleteAddress.pending, (state) => {
        state.loading = true;
        state.success = false;
        state.error = null;
      })
      .addCase(deleteAddress.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.addresses = action.payload.addresses || [];
      })
      .addCase(deleteAddress.rejected, (state, action) => {
        state.loading = false;
        state.success = false;
        state.error = action.payload;
      });
  },
});

export const { clearAddressState, setAddresses } = addressSlice.actions;
export default addressSlice.reducer; 