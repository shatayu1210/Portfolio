import { createSlice, createAsyncThunk, createSelector } from "@reduxjs/toolkit";
import axios from "../../../config/axios";

// Load cart from localStorage if it exists
const loadCartFromStorage = () => {
  const savedCart = localStorage.getItem("cart");
  return savedCart ? JSON.parse(savedCart) : { items: [], restaurantId: null, orderPreference: "delivery" };
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
      const { id, restaurantId } = action.payload;
      
      // Check if item is from a different restaurant
      if (state.restaurantId && state.restaurantId !== restaurantId && state.items.length > 0) {
        // Replace cart with the new item from different restaurant
        state.items = [action.payload];
        state.restaurantId = restaurantId;
      } else {
        // Set restaurant ID if cart is empty
        if (!state.restaurantId) {
          state.restaurantId = restaurantId;
        }
        
        // Check if item already exists in cart
        const existingItemIndex = state.items.findIndex(item => {
          // If both have selected sizes, compare by dish ID and size ID or size value
          if (item.selectedSize && action.payload.selectedSize) {
            const itemSizeId = item.selectedSize._id || item.selectedSize.id;
            const payloadSizeId = action.payload.selectedSize._id || action.payload.selectedSize.id;
            
            // If both have size IDs, compare them
            if (itemSizeId && payloadSizeId) {
              return item.id === id && itemSizeId === payloadSizeId;
            }
            
            // Fallback to comparing size values if either doesn't have ID
            return item.id === id && item.selectedSize.size === action.payload.selectedSize.size;
          }
          
          // If no sizes, compare just the dish IDs
          return item.id === id && !item.selectedSize && !action.payload.selectedSize;
        });
        
        if (existingItemIndex >= 0) {
          // Update existing item quantity
          state.items[existingItemIndex].quantity += action.payload.quantity;
        } else {
          // Add new item to cart
          state.items.push(action.payload);
        }
      }

      saveCartToStorage(state); // Save updated cart
    },
    updateQuantity: (state, action) => {
      const { id, quantity, selectedSize } = action.payload;
      
      // Find item using the same logic as addToCart
      const itemIndex = state.items.findIndex(item => {
        if (item.selectedSize && selectedSize) {
          const itemSizeId = item.selectedSize._id || item.selectedSize.id;
          const payloadSizeId = selectedSize._id || selectedSize.id;
          
          if (itemSizeId && payloadSizeId) {
            return item.id === id && itemSizeId === payloadSizeId;
          }
          
          return item.id === id && item.selectedSize.size === selectedSize.size;
        }
        
        return item.id === id && !item.selectedSize && !selectedSize;
      });
      
      if (itemIndex >= 0) {
        state.items[itemIndex].quantity = quantity;
        saveCartToStorage(state); // Save updated cart
      }
    },
    removeItem: (state, action) => {
      const { id, selectedSize } = action.payload;
      
      // Use filter with the same comparison logic
      state.items = state.items.filter(item => {
        if (item.selectedSize && selectedSize) {
          const itemSizeId = item.selectedSize._id || item.selectedSize.id;
          const payloadSizeId = selectedSize._id || selectedSize.id;
          
          if (itemSizeId && payloadSizeId) {
            return !(item.id === id && itemSizeId === payloadSizeId);
          }
          
          return !(item.id === id && item.selectedSize.size === selectedSize.size);
        }
        
        return !(item.id === id && !item.selectedSize && !selectedSize);
      });
      
      // Reset restaurant ID if cart is empty
      if (state.items.length === 0) {
        state.restaurantId = null;
      }
      saveCartToStorage(state); // Save updated cart
    },
    clearCart: (state) => {
      state.items = [];
      state.restaurantId = null;
      state.orderPreference = "delivery";
      saveCartToStorage(state); // Save updated cart
    },
    updateItemSize: (state, action) => {
      const { id, selectedSize } = action.payload;
      
      // Find the existing item with the exact same ID (no size comparison needed as we're changing the size)
      const itemIndex = state.items.findIndex(item => item.id === id);
      
      if (itemIndex >= 0) {
        // Check if an item with the new size already exists
        const existingItemWithNewSizeIndex = state.items.findIndex(item => {
          if (!item.selectedSize || !selectedSize) return false;
          
          const itemSizeId = item.selectedSize._id || item.selectedSize.id;
          const newSizeId = selectedSize._id || selectedSize.id;
          
          if (itemSizeId && newSizeId) {
            return item.id === id && itemSizeId === newSizeId && itemIndex !== state.items.indexOf(item);
          }
          
          return item.id === id && item.selectedSize.size === selectedSize.size && itemIndex !== state.items.indexOf(item);
        });
        
        if (existingItemWithNewSizeIndex >= 0) {
          // If an item with the new size already exists, combine quantities
          state.items[existingItemWithNewSizeIndex].quantity += state.items[itemIndex].quantity;
          // Remove the original item
          state.items.splice(itemIndex, 1);
        } else {
          // Otherwise just update the size
          state.items[itemIndex].selectedSize = selectedSize;
          // Update the price if it was based on the size
          if (selectedSize.price) {
            state.items[itemIndex].price = selectedSize.price;
          }
        }
        saveCartToStorage(state); // Save updated cart
      }
    },
    updateCartItemCategory: (state, action) => {
      const { id, category } = action.payload;
      
      // Find the item by ID
      const itemIndex = state.items.findIndex(item => item.id === id);
      
      if (itemIndex >= 0) {
        // Update the category field to be an array
        state.items[itemIndex].category = category;
        saveCartToStorage(state); // Save updated cart
      }
    },
    setOrderPreference: (state, action) => {
      state.orderPreference = action.payload;
    }
  },
  extraReducers: (builder) => {
    
  },
});

export const { 
  addToCart, 
  updateQuantity, 
  removeItem, 
  clearCart, 
  setOrderPreference,
  updateItemSize,
  updateCartItemCategory
} = cartSlice.actions;

// Selectors
export const selectCartItems = (state) => state.cart.items;
export const selectRestaurantId = (state) => state.cart.restaurantId;
export const selectOrderPreference = (state) => state.cart.orderPreference;

// Memoized selector for cart total
export const selectCartTotal = createSelector(
  [selectCartItems],
  (items) => {
    return items.reduce((total, item) => {
      // Use selectedSize.price if available, otherwise fall back to item.price
      const itemPrice = parseFloat(item.selectedSize?.price || item.price || 0);
      const itemQuantity = parseInt(item.quantity || 0);
      return total + (itemPrice * itemQuantity);
    }, 0).toFixed(2);
  }
);

// Memoized selector for total items count
export const selectCartItemsCount = createSelector(
  [selectCartItems],
  (items) => {
    return items.reduce((count, item) => count + (item.quantity || 0), 0);
  }
);

// Selector for cart items with details
export const selectCartItemsWithDetails = (state) => {
  return state.cart.items.map(item => ({
    id: item.id,
    name: item.name,
    price: item.price.toFixed(2),
    quantity: item.quantity,
    total: (item.price * item.quantity).toFixed(2)
  }));
};

export default cartSlice.reducer;