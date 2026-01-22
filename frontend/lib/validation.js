/**
 * Centralized validation utilities for LifeSaver Connect
 */

export const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
};

export const validatePhone = (phone) => {
    // Simple check for 10-15 digits
    const re = /^\d{10,15}$/;
    return re.test(String(phone).replace(/\D/g, ''));
};

export const validateZipCode = (zip) => {
    // Generic check for 5-6 digits
    const re = /^\d{5,6}$/;
    return re.test(String(zip));
};

export const validateName = (name) => {
    // Minimum 2 characters, only letters and spaces
    const re = /^[a-zA-Z\s]{2,}$/;
    return re.test(String(name));
};

export const validatePassword = (password) => {
    return String(password).length >= 8;
};

export const validateDateNotInFuture = (dateString) => {
    if (!dateString) return true;
    const selectedDate = new Date(dateString);
    const now = new Date();
    return selectedDate <= now;
};

export const validateDateInFuture = (dateString) => {
    if (!dateString) return true;
    const selectedDate = new Date(dateString);
    const now = new Date();
    return selectedDate >= now;
};

export const validatePositiveInteger = (value) => {
    const num = Number(value);
    return Number.isInteger(num) && num > 0;
};
