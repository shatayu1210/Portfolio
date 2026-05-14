import { configureStore } from "@reduxjs/toolkit";
import customerReducer from "./slices/customer/customerSlice";
import authReducer from "./slices/auth/authSlice";
import restaurantReducer from "./slices/restaurant/restaurantSlice"; 
import orderReducer from "./slices/customer/orderSlice";
import cartReducer from "./slices/customer/cartSlice";
import favoriteReducer from "./slices/customer/favoriteSlice";
import ratingReducer from "./slices/customer/ratingSlice";
import addressReducer from "./slices/customer/addressSlice";

const store = configureStore({
    reducer: {
        auth: authReducer, 
        customer: customerReducer,
        cart: cartReducer,
        order: orderReducer,
        restaurant: restaurantReducer, 
        favorites: favoriteReducer,
        ratings: ratingReducer,
        address: addressReducer
    },
});

export default store;
