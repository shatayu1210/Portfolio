import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
axios.defaults.withCredentials = true;


// Async thunk to create a Restaurant Owner
export const createRestaurantOwner = createAsyncThunk(
    "restaurantOwner/createRestaurantOwner",
    async (ownerData, { rejectWithValue }) => {
        try {
            const response = await axios.post("http://127.0.0.1:3000/api/restaurantOwners", ownerData, {
                headers: { "Content-Type": "application/json" },
            });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || "Something went wrong");
        }
    }
);


// Async thunk to fetch a Restaurant Owner by ID for Profile Edit
export const fetchOwner = createAsyncThunk(
    "restaurantOwner/fetchOwner",
    async (ownerId, { rejectWithValue }) => {
        try {
            const response = await axios.get(`http://127.0.0.1:3000/api/restaurantOwners/${ownerId}`);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || "Something went wrong while fetching owner details");
        }
    }
);


// Async thunk to update a Restaurant Owner by ID for Profile Edit
export const updateOwner = createAsyncThunk(
    "restaurantOwner/updateOwner",
    async ({ ownerId, ownerData }, { rejectWithValue }) => {
        try {
            const response = await axios.put(`http://127.0.0.1:3000/api/restaurantOwners/${ownerId}`, ownerData, {
                headers: { "Content-Type": "application/json" },
            });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || "Something went wrong while updating owner details");
        }
    }
);


const restaurantOwnerSlice = createSlice({
    name: "restaurantOwner",
    initialState: {
        loading: false,
        success: false,
        error: null,
        owner: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(createRestaurantOwner.pending, (state) => {
                state.loading = true;
                state.success = false;
                state.error = null;
            })
            .addCase(createRestaurantOwner.fulfilled, (state) => {
                state.loading = false;
                state.success = true;
                state.error = null;
            })
            .addCase(createRestaurantOwner.rejected, (state, action) => {
                state.loading = false;
                state.success = false;
                state.error = action.payload;
            })
            .addCase(fetchOwner.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchOwner.fulfilled, (state, action) => {
                state.loading = false;
                state.owner = action.payload;
            })
            .addCase(fetchOwner.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(updateOwner.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateOwner.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                state.owner = action.payload;
            })
            .addCase(updateOwner.rejected, (state, action) => {
                state.loading = false;
                state.success = false;
                state.error = action.payload;
            });
    },
});

export default restaurantOwnerSlice.reducer;