// Central API configuration
// You can override via window.API_BASE or REACT_APP_API_BASE
// Try explicit window override, then env, else default backend port 5000.
export const API_BASE = (typeof window !== 'undefined' && window.API_BASE)
  || process.env.REACT_APP_API_BASE
  || 'http://localhost:5000';
