import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import axios from '../../../config/axios';

// Create rating thunk
export const createRating = createAsyncThunk(
  'rating/createRating',
  async ({ restaurantId, rating, review }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`/api/ratings/restaurant/${restaurantId}`, {
        rating,
        review
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'An error occurred while creating the rating' });
    }
  }
);

// Fetch restaurant ratings thunk
export const fetchRestaurantRatings = createAsyncThunk(
  'ratings/fetchRestaurantRatings',
  async (restaurantId, { rejectWithValue }) => {
    try {
      const response = await axios.get(`/api/ratings/restaurant/${restaurantId}`);
      return response.data;
    } catch (error) {
      // If the restaurant has no ratings, return an empty array instead of an error
      if (error.response?.status === 400 && error.response?.data?.message?.includes('No ratings available')) {
        return { 
          ratings: [],
          restaurant: {
            id: restaurantId,
            averageRating: 0,
            ratingCount: 0
          }
        };
      }
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch ratings');
    }
  }
);

// Update rating thunk
export const updateRating = createAsyncThunk(
  'rating/updateRating',
  async ({ ratingId, rating, review }, { rejectWithValue }) => {
    try {
      const response = await axios.put(`/api/ratings/${ratingId}`, {
        rating,
        review
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'An error occurred while updating the rating' });
    }
  }
);

// Delete rating thunk
export const deleteRating = createAsyncThunk(
  'rating/deleteRating',
  async (ratingId, { rejectWithValue }) => {
    try {
      const response = await axios.delete(`/api/ratings/${ratingId}`);
      return { ...response.data, ratingId };
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'An error occurred while deleting the rating' });
    }
  }
);

const initialState = {
  ratings: [],
  restaurantRatingInfo: null,
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null
};

// Memoized selector for restaurant rating statistics
const getRestaurantRatingInfo = state => state.ratings.restaurantRatingInfo;

export const selectRestaurantRatingStats = createSelector(
  [getRestaurantRatingInfo],
  (restaurantRatingInfo) => ({
    rating: restaurantRatingInfo?.averageRating || 0,
    ratingCount: restaurantRatingInfo?.ratingCount || 0
  })
);

const ratingSlice = createSlice({
  name: 'ratings',
  initialState,
  reducers: {
    clearRatings: (state) => {
      state.ratings = [];
      state.restaurantRatingInfo = null;
      state.status = 'idle';
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Create rating
      .addCase(createRating.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(createRating.fulfilled, (state, action) => {
        state.status = 'succeeded';
        // Add the new rating to state if available
        if (action.payload.rating) {
          // Get customer info from the Redux auth state
          const customerInfo = action.meta.arg.customerInfo;
          
          // Create a complete rating object with customer information
          const completeRating = {
            ...action.payload.rating,
            customer: {
              id: customerInfo?.id,
              name: customerInfo?.name || `${customerInfo?.firstName || ''} ${customerInfo?.lastName || ''}`,
              imageUrl: customerInfo?.imageUrl
            }
          };
          
          state.ratings.push(completeRating);
        }
        
        // Update restaurant rating info
        if (state.restaurantRatingInfo) {
          state.restaurantRatingInfo.averageRating = action.payload.restaurantRating || state.restaurantRatingInfo.averageRating;
          state.restaurantRatingInfo.ratingCount = action.payload.ratingCount || state.restaurantRatingInfo.ratingCount;
        } else {
          // Initialize restaurant rating info if it doesn't exist
          state.restaurantRatingInfo = {
            id: action.meta.arg.restaurantId,
            averageRating: action.payload.restaurantRating || 0,
            ratingCount: action.payload.ratingCount || 1
          };
        }
      })
      .addCase(createRating.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload?.message || 'Failed to create rating';
      })
      // Fetch restaurant ratings
      .addCase(fetchRestaurantRatings.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchRestaurantRatings.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.ratings = action.payload.ratings || [];
        state.restaurantRatingInfo = action.payload.restaurant || null;
      })
      .addCase(fetchRestaurantRatings.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      // Update rating cases
      .addCase(updateRating.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(updateRating.fulfilled, (state, action) => {
        state.status = 'succeeded';
        // Update the rating in the ratings array if it exists
        if (action.payload.rating) {
          // Find the existing rating
          const index = state.ratings.findIndex(rating => rating.id === action.payload.rating._id || rating.id === action.payload.rating.id);
          
          if (index !== -1) {
            // Keep the existing customer information when updating
            const existingRating = state.ratings[index];
            
            // Create an updated rating object that preserves existing customer info
            const updatedRating = {
              ...existingRating,
              rating: action.payload.rating.rating,
              review: action.payload.rating.review,
              updatedAt: action.payload.rating.updatedAt || new Date().toISOString()
            };
            
            // Replace the rating in the array
            state.ratings[index] = updatedRating;
          }
        }
        
        // Update restaurant rating info if provided
        if (state.restaurantRatingInfo) {
          if (action.payload.restaurantRating !== undefined) {
            state.restaurantRatingInfo.averageRating = action.payload.restaurantRating;
          }
          // The ratingCount doesn't change on an update, but we still update the value if it's provided
          if (action.payload.ratingCount !== undefined) {
            state.restaurantRatingInfo.ratingCount = action.payload.ratingCount;
          }
        }
      })
      .addCase(updateRating.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      // Delete rating cases
      .addCase(deleteRating.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(deleteRating.fulfilled, (state, action) => {
        state.status = 'succeeded';
        // Remove the deleted rating from the ratings array
        state.ratings = state.ratings.filter(rating => rating.id !== action.payload.ratingId);
        
        // Update rating info in restaurant if it exists
        if (state.restaurantRatingInfo) {
          if (action.payload.restaurantRating !== undefined) {
            state.restaurantRatingInfo.averageRating = action.payload.restaurantRating;
          } else {
            // If not provided, recalculate based on remaining ratings
            if (state.ratings.length > 0) {
              const sum = state.ratings.reduce((acc, rating) => acc + rating.rating, 0);
              state.restaurantRatingInfo.averageRating = sum / state.ratings.length;
            } else {
              state.restaurantRatingInfo.averageRating = 0;
            }
          }
          
          if (action.payload.ratingCount !== undefined) {
            state.restaurantRatingInfo.ratingCount = action.payload.ratingCount;
          } else {
            // If not provided, use the length of the ratings array
            state.restaurantRatingInfo.ratingCount = state.ratings.length;
          }
        }
      })
      .addCase(deleteRating.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  }
});

export const { clearRatings } = ratingSlice.actions;
export default ratingSlice.reducer; 