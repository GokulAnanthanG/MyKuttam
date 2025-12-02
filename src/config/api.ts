let Config: any = null;

try {
  Config = require('react-native-config').default;
} catch (e) {
  // react-native-config not available
}

// Always use API_BASE_URL from environment variable, no fallback
export const BASE_URL = Config?.API_BASE_URL || '';

export const endpoints = {
  login: `${BASE_URL}/api/registration/login`,
  sendOtp: `${BASE_URL}/api/registration/before-register`,
  validateOtp: `${BASE_URL}/api/registration/validate-otp`,
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
  categories: `${BASE_URL}/api/categories`,
  categoryById: (id: string) => `${BASE_URL}/api/categories/${id}`,
  categoryStatus: (id: string) => `${BASE_URL}/api/categories/${id}/status`,
  subcategories: `${BASE_URL}/api/subcategories`,
  subcategoryById: (id: string) => `${BASE_URL}/api/subcategories/${id}`,
  subcategoryStatus: (id: string) => `${BASE_URL}/api/subcategories/${id}/status`,
  // Expense endpoints
  expenses: `${BASE_URL}/api/expenses`,
  expenseById: (id: string) => `${BASE_URL}/api/expenses/${id}`,
  // Donation manager mapping endpoints
  donationManagerMappings: `${BASE_URL}/api/donation-manager-mappings`,
  donationManagers: `${BASE_URL}/api/donation-manager-mappings/donation-managers`,
  donationManagersBySubcategory: (subcategoryId: string) =>
    `${BASE_URL}/api/donation-manager-mappings/subcategory/${subcategoryId}/donation-managers`,
  // User donation endpoints
  userDonationsByCategory: (userIdOrPhone: string, categoryId: string) =>
    `${BASE_URL}/api/donations/user/${userIdOrPhone}/category/${categoryId}`,
  userDonationsOverall: (userIdOrPhone: string) =>
    `${BASE_URL}/api/donations/user/${userIdOrPhone}/overall`,
  // Push notification endpoints
  fcmToken: `${BASE_URL}/api/user/fcm-token`,
};

export const ENV = Config?.ENV || 'development';

