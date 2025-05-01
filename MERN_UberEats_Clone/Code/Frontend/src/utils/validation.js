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
 * Validate phone to allow 10-15 digits with optional + prefix
 * @param phone
 * @returns {boolean} - True if valid phone, false otherwise
 */
export const validatePhone = (phone) => {  
    const phoneRegex = /^\+?\d{10,15}$/;
    return phoneRegex.test(phone);
}; 

/**
 * Validates a name (first name or last name)
 * @param {string} name - The name to validate
 * @returns {boolean} - True if name contains only letters, spaces, hyphens, and apostrophes
 */
export const validateName = (name) => {
    const nameRegex = /^[A-Za-z\s'-]+$/;
    return nameRegex.test(name);
}; 

/**
 * Validates a password against security requirements
 * @param {string} password - The password to validate
 * @returns {boolean} - True if password meets all requirements, false otherwise
 */
export const validatePassword = (password) => {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isLongEnough = password && password.length >= 6;
    
    // All criteria must be met
    return isLongEnough && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
}; 