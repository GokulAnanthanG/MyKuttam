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
};

export const ENV = Config?.ENV || 'development';

