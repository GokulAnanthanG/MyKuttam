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
  // News endpoints
  news: `${BASE_URL}/api/news`,
  newsById: (id: string) => `${BASE_URL}/api/news/${id}`,
  newsList: `${BASE_URL}/api/news/list`,
  newsHighlighted: `${BASE_URL}/api/news/highlighted`,
  // Comment endpoints
  comments: `${BASE_URL}/api/comments`,
  commentById: (id: string) => `${BASE_URL}/api/comments/${id}`,
  commentsByNews: (newsId: string) => `${BASE_URL}/api/comments/news/${newsId}`,
  // Like endpoints
  likes: `${BASE_URL}/api/likes`,
  likeStatus: `${BASE_URL}/api/likes/status`,
  likesByNews: (newsId: string) => `${BASE_URL}/api/likes/news/${newsId}`,
  // Donation endpoints
  donations: `${BASE_URL}/api/donations`,
  donationById: (id: string) => `${BASE_URL}/api/donations/${id}`,
  donationCategoriesSummary: `${BASE_URL}/api/donations/categories-summary`,
  // Expense endpoints
  expenses: `${BASE_URL}/api/expenses`,
  expenseById: (id: string) => `${BASE_URL}/api/expenses/${id}`,
};

export const ENV = Config?.ENV || 'development';

