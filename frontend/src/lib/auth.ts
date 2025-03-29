// Simple auth utilities for token management

// Get token from local storage
export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
};

// Set token in local storage
export const setToken = (token: string): void => {
  localStorage.setItem('token', token);
};

// Remove token from local storage (logout)
export const removeToken = (): void => {
  localStorage.removeItem('token');
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  return !!getToken();
};
