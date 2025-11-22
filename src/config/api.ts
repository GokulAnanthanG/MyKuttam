let Config: any = null;

try {
  Config = require('react-native-config').default;
} catch (e) {
  // react-native-config not available, use defaults
  console.warn('react-native-config not available, using default values');
}

const DEFAULT_BASE_URL = 'https://your-api-base-url.com';

export const BASE_URL =
  Config?.API_BASE_URL && Config.API_BASE_URL.length > 0
    ? Config.API_BASE_URL
    : DEFAULT_BASE_URL;

export const endpoints = {
  login: `${BASE_URL}/api/registration/login`,
  sendOtp: `${BASE_URL}/api/registration/before-register`,
  register: `${BASE_URL}/api/registration/register`,
  updateProfile: `${BASE_URL}/api/user/update-profile`,
  resetPassword: `${BASE_URL}/api/user/reset-password`,
  forgotPasswordRequestOtp: `${BASE_URL}/api/registration/forgot-password/request-otp`,
  forgotPasswordReset: `${BASE_URL}/api/registration/forgot-password/reset`,
  gallery: `${BASE_URL}/api/gallery`,
  updateGalleryStatus: (id: string) => `${BASE_URL}/api/gallery/${id}/status`,
  deleteGalleryImage: (id: string) => `${BASE_URL}/api/gallery/${id}`,
  uploadGalleryImage: `${BASE_URL}/api/gallery/upload`,
};

export const ENV = Config?.ENV || 'development';

