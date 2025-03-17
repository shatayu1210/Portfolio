/**
 * Validation utility functions for form fields
 */

/**
 * Validates an email address
 * @param {string} email - The email to validate
 * @returns {boolean} - True if email is valid, false otherwise
 */
export const validateEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

/**
 * Validate phone to be 10 digit number
 * @param phone
 * @returns {boolean} - True if valid phone, false otherwise
 */
export const validatePhone = (phone) => {  
    return String(phone).length === 10;
}; 