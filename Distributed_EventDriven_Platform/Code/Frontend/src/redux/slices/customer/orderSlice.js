import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../../config/axios";

// Async thunk for placing orders
export const placeOrder = createAsyncThunk(
  "cart/placeOrder",
  async ({ restaurantId, orderData }, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        `/api/customers/orders/create/${restaurantId}`, 
        orderData, 
        {
          headers: { "Content-Type": "application/json" }
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || error.response?.data?.message || "Failed to place order"
      );
    }
  }
);

// Async thunk for fetching orders by restaurant
export const fetchOrdersByRestaurant = createAsyncThunk(
  "cart/fetchOrdersByRestaurant",
  async (restaurantId, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `/api/orders/restaurant/${restaurantId}`
      );
      return response.data;
    } catch (error) {
      return rejectWithValue("Failed to load orders. Please try again later.");
    }
  }
);

// Async thunk for fetching order details
export const fetchOrderDetails = createAsyncThunk(
  "cart/fetchOrderDetails",
  async (orderId, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `/api/customers/orders/single/${orderId}`
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        "Failed to load order details. Please try again later."
      );
    }
  }
);

// Async thunk for fetching orders by customer
export const fetchOrdersByCustomer = createAsyncThunk(
  "cart/fetchOrdersByCustomer",
  async (customerId, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `/api/customers/orders/${customerId}`
      );
      return response.data;
    } catch (error) {
      return rejectWithValue("Failed to load customer orders. Please try again later.");
    }
  }
);

// Async thunk for updating the order status
export const updateOrderStatus = createAsyncThunk(
  "cart/updateOrderStatus",
  async ({ orderId, status }, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `/api/orders/${orderId}`,
        { status },
        {
          headers: { "Content-Type": "application/json" }
        }
      );
      return response.data; // Updated order data
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || "Failed to update order status"
      );
    }
  }
);

const orderSlice = createSlice({
  name: "order",
  initialState: {
    items: [], // Stores added dishes
    restaurantId: null, // Track which restaurant the cart items are from
    orderStatus: "idle", // idle, loading, succeeded, failed
    orderError: null,
    currentOrder: null,
    orders: [],
    orderDetails: null,
    customerOrders: [], // Store orders fetched by customer
    loadingOrders: false,
    loadingOrderDetails: false,
    loadingCustomerOrders: false, // Track loading state for customer orders
  },
  reducers: {
    resetOrderStatus: (state) => {
      state.orderStatus = "idle";
      state.orderError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(placeOrder.pending, (state) => {
        state.orderStatus = "loading";
        state.orderError = null;
      })
      .addCase(placeOrder.fulfilled, (state, action) => {
        state.orderStatus = "succeeded";
        state.currentOrder = action.payload;
        state.items = [];
        state.restaurantId = null;
      })
      .addCase(placeOrder.rejected, (state, action) => {
        state.orderStatus = "failed";
        state.orderError = action.payload;
      })
      .addCase(fetchOrdersByRestaurant.pending, (state) => {
        state.loadingOrders = true;
      })
      .addCase(fetchOrdersByRestaurant.fulfilled, (state, action) => {
        state.loadingOrders = false;
        state.orders = action.payload;
      })
      .addCase(fetchOrdersByRestaurant.rejected, (state, action) => {
        state.loadingOrders = false;
        state.orderError = action.payload;
      })
      .addCase(fetchOrderDetails.pending, (state) => {
        state.loadingOrderDetails = true;
      })
      .addCase(fetchOrderDetails.fulfilled, (state, action) => {
        state.loadingOrderDetails = false;
        state.orderDetails = action.payload;
      })
      .addCase(fetchOrderDetails.rejected, (state, action) => {
        state.loadingOrderDetails = false;
        state.orderError = action.payload;
      })
      .addCase(fetchOrdersByCustomer.pending, (state) => {
        state.loadingCustomerOrders = true;
      })
      .addCase(fetchOrdersByCustomer.fulfilled, (state, action) => {
        state.loadingCustomerOrders = false;
        state.customerOrders = action.payload;
      })
      .addCase(fetchOrdersByCustomer.rejected, (state, action) => {
        state.loadingCustomerOrders = false;
        state.orderError = action.payload;
      })
      .addCase(updateOrderStatus.pending, (state) => {
        state.orderStatus = "loading";
        state.orderError = null;
      })
      .addCase(updateOrderStatus.fulfilled, (state, action) => {
        state.orderStatus = "succeeded";
        // Assuming the updated order is returned in the response
        const updatedOrder = action.payload;
        const index = state.orders.findIndex(order => order.id === updatedOrder.id);
        if (index !== -1) {
          state.orders[index] = updatedOrder;
        }
      })
      .addCase(updateOrderStatus.rejected, (state, action) => {
        state.orderStatus = "failed";
        state.orderError = action.payload;
      });
  },
});

export const { resetOrderStatus } = orderSlice.actions;
export const selectCustomerOrders = (state) => state.order.customerOrders;

export default orderSlice.reducer;