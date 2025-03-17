import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
axios.defaults.withCredentials = true;

// Load cart from localStorage if it exists
const loadCartFromStorage = () => {
  const savedCart = localStorage.getItem("cart");
  return savedCart ? JSON.parse(savedCart) : { items: [], restaurantId: null };
};

// Save cart to localStorage
const saveCartToStorage = (cart) => {
  localStorage.setItem("cart", JSON.stringify(cart));
};

const cartSlice = createSlice({
  name: "cart",
  initialState: loadCartFromStorage(), // Load cart data from localStorage
  reducers: {
    addToCart: (state, action) => {
      const { id, quantity, restaurant_id } = action.payload;

      // If adding items from a different restaurant, clear the cart first
      if (state.restaurantId && state.restaurantId !== restaurant_id && state.items.length > 0) {
        state.items = [];
      }

      // Set the restaurant ID
      state.restaurantId = restaurant_id;

      const existingItem = state.items.find(item => item.id === id);

      // Handle negative quantity for decrementing
      if (quantity < 0 && existingItem) {
        // If quantity would go to zero or negative, remove the item
        if (existingItem.quantity + quantity <= 0) {
          state.items = state.items.filter(item => item.id !== id);
          // If cart is empty, reset restaurant ID
          if (state.items.length === 0) {
            state.restaurantId = null;
          }
        } else {
          // Otherwise just decrement the quantity
          existingItem.quantity += quantity;
        }
        saveCartToStorage(state); // Save updated cart
        return;
      }

      // Normal add to cart functionality
      if (existingItem) {
        existingItem.quantity += quantity || 1; // Increment by specified quantity or default to 1
      } else {
        state.items.push({ ...action.payload, quantity: quantity || 1 });
      }

      saveCartToStorage(state); // Save updated cart
    },
    updateQuantity: (state, action) => {
      const { id, quantity } = action.payload;
      const item = state.items.find(item => item.id === id);
      if (item) {
        item.quantity = quantity;
        saveCartToStorage(state); // Save updated cart
      }
    },
    removeFromCart: (state, action) => {
      state.items = state.items.filter(item => item.id !== action.payload);
      // If cart is empty, reset restaurant ID
      if (state.items.length === 0) {
        state.restaurantId = null;
      }
      saveCartToStorage(state); // Save updated cart
    },
    clearCart: (state) => {
      state.items = []; // Empty the cart after order is placed
      state.restaurantId = null;
      saveCartToStorage(state); // Save updated cart
    }
  },
  extraReducers: (builder) => {
    
  },
});

export const { addToCart, updateQuantity, removeFromCart, clearCart } = cartSlice.actions;

// Selector for cart total
export const selectCartTotal = (state) => {
  return state.cart.items.reduce((total, item) => {
    return total + (parseFloat(item.price) * item.quantity);
  }, 0).toFixed(2);
};

// Selector for total items count
export const selectCartItemsCount = (state) => {
  return state.cart.items.reduce((count, item) => count + item.quantity, 0);
};

// Selector for cart items with details
export const selectCartItems = (state) => {
  return state.cart.items.map(item => ({
    id: item.id,
    name: item.name,
    price: item.price.toFixed(2),
    quantity: item.quantity,
    total: (item.price * item.quantity).toFixed(2)
  }));
};

export default cartSlice.reducer;