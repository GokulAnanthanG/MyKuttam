import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from 'react';
import Toast from 'react-native-toast-message';
import { AuthService } from '../services/auth';
import { saveUserToRealm, getStoredUser, getStoredToken } from '../storage/userRealm';
import { StoredUser } from '../types/user';

type AuthContextType = {
  loading: boolean;
  initializing: boolean;
  isAuthenticated: boolean;
  login: (phone: string, password: string) => Promise<boolean>;
  requestOtp: (phone: string) => Promise<boolean>;
  validateOtp: (phone: string, otp: string) => Promise<boolean>;
  register: (user: StoredUser) => Promise<boolean>;
  updateProfile: (updates: Partial<Pick<StoredUser, 'name' | 'dob' | 'father_name' | 'address' | 'avatar'>> & { avatarFile?: { uri: string; type: string; name: string } }) => Promise<boolean>;
  resetPassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  forgotPasswordRequestOtp: (phone: string) => Promise<boolean>;
  forgotPasswordReset: (phone: string, otp: string, newPassword: string) => Promise<boolean>;
  currentUser: StoredUser | null;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getErrorMessage = (error: unknown) => {
  if (!error) {
    return 'Something went wrong. Please try again.';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error === 'object') {
    // Check for ApiError with message
    if ('message' in error && typeof (error as { message?: string }).message === 'string') {
      const message = (error as { message?: string }).message;
      if (message) {
        return message;
      }
    }
    
    // Check for error property
    if ('error' in error) {
      const errorValue = (error as { error?: unknown }).error;
      if (typeof errorValue === 'string') {
        return errorValue;
      }
      if (typeof errorValue === 'object' && errorValue !== null && 'message' in errorValue) {
        return String((errorValue as { message?: string }).message);
      }
    }
  }

  return 'Something went wrong. Please try again.';
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);

  // Load user from Realm on mount for offline support
  // This allows the app to work offline with cached user data
  useEffect(() => {
    const loadStoredUser = async () => {
      try {
        const { user, token } = await getStoredUser();
        // Only set user if both user and token exist
        // This enables offline access to user profile and authenticated features
        if (user && token && token.length > 0) {
          setCurrentUser(user);
        }
      } catch (error) {
        console.error('Error loading stored user:', error);
      } finally {
        setInitializing(false);
      }
    };

    loadStoredUser();
  }, []);

  const isAuthenticated = currentUser !== null;

  const showError = (error: unknown) => {
    Toast.show({
      type: 'error',
      text1: 'Error',
      text2: getErrorMessage(error),
      visibilityTime: 4000,
    });
  };

  const showSuccess = (message: string) => {
    Toast.show({
      type: 'success',
      text1: 'Success',
      text2: message,
      visibilityTime: 3000,
    });
  };

  const login = async (phone: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      const result = await AuthService.login({ phone, password });
      if (result.success && result.user && result.token) {
        // Save user and token to Realm for offline access
        // This allows the app to work offline after initial login
        await saveUserToRealm(result.user, result.token);
        setCurrentUser(result.user);
        showSuccess(result.message || 'Login successful!');
        return true;
      }
      return false;
    } catch (error) {
      // On network error, check if we have cached credentials
      // Note: Login requires network, but we can show cached user if available
      const cached = await getStoredUser();
      if (cached.user && cached.token) {
        // If we have cached data, we can still use it for offline mode
        // But login itself requires network, so we show error
        showError('Network error. Please check your connection and try again.');
      } else {
        showError(error);
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const requestOtp = async (phone: string): Promise<boolean> => {
    try {
      setLoading(true);
      await AuthService.requestOtp({ phone });
      showSuccess('OTP sent to your phone.');
      return true;
    } catch (error) {
      showError(error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const validateOtp = async (phone: string, otp: string): Promise<boolean> => {
    const trimmedPhone = phone?.trim() || '';
    const trimmedOtp = otp?.trim() || '';
    
    console.log('AuthContext.validateOtp: Called with phone:', trimmedPhone);
    console.log('AuthContext.validateOtp: Called with OTP length:', trimmedOtp.length);
    
    if (!trimmedPhone || !trimmedOtp) {
      console.error('AuthContext.validateOtp: Phone or OTP is empty!', { phone: trimmedPhone, otpLength: trimmedOtp.length });
      showError('Phone and OTP are required');
      return false;
    }

    try {
      setLoading(true);
      console.log('AuthContext.validateOtp: Calling AuthService.validateOtp with:', { phone: trimmedPhone, OTP: trimmedOtp });
      const result = await AuthService.validateOtp({ phone: trimmedPhone, OTP: trimmedOtp });
      console.log('AuthContext.validateOtp: Service result:', { success: result.success, validated: result.data?.validated });
      
      if (result.success && result.data?.validated) {
        showSuccess(result.message || 'OTP validated successfully!');
        return true;
      } else {
        // Show error if validation failed - use server message if available
        const errorMessage = result.message || 'Invalid or expired OTP. Please try again.';
        showError(errorMessage);
      }
      return false;
    } catch (error: any) {
      console.error('AuthContext.validateOtp: Error caught:', error);
      
      // Extract clear error message
      let errorMessage = 'Failed to validate OTP. Please try again.';
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.status) {
        // Handle different HTTP status codes
        switch (error.status) {
          case 400:
            errorMessage = error.message || 'Invalid request. Please check your phone number and OTP.';
            break;
          case 401:
            errorMessage = error.message || 'Unauthorized. Please request a new OTP.';
            break;
          case 404:
            errorMessage = error.message || 'OTP not found. Please request a new OTP.';
            break;
          case 500:
          case 502:
          case 503:
            errorMessage = error.message || 'Server error. Please try again later.';
            break;
          default:
            errorMessage = error.message || 'Failed to validate OTP. Please try again.';
        }
      }
      
      showError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const register = async (user: StoredUser): Promise<boolean> => {
    try {
      setLoading(true);
      const result = await AuthService.register({ user });
      if (result.success && result.user && result.token) {
        // Save user and token to Realm for offline access and session persistence
        await saveUserToRealm(result.user, result.token);
        setCurrentUser(result.user);
        showSuccess(result.message || 'Registration successful!');
        return true;
      }
      return false;
    } catch (error) {
      showError(error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (
    updates: Partial<Pick<StoredUser, 'name' | 'dob' | 'father_name' | 'address' | 'avatar'>> & { avatarFile?: { uri: string; type: string; name: string } },
  ): Promise<boolean> => {
    try {
      setLoading(true);
      const token = await getStoredToken();
      if (!token) {
        showError('Authentication token not found. Please login again.');
        return false;
      }

      const result = await AuthService.updateProfile(token, updates);
      if (result.success && result.user) {
        // Save updated user to Realm
        await saveUserToRealm(result.user, token);
        setCurrentUser(result.user);
        showSuccess(result.message || 'Profile updated successfully!');
        return true;
      }
      return false;
    } catch (error) {
      showError(error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (
    currentPassword: string,
    newPassword: string,
  ): Promise<boolean> => {
    try {
      setLoading(true);
      const token = await getStoredToken();
      if (!token) {
        showError('Authentication token not found. Please login again.');
        return false;
      }

      const result = await AuthService.resetPassword(token, {
        currentPassword,
        newPassword,
      });

      if (result.success) {
        showSuccess(result.message || 'Password reset successfully!');
        return true;
      }
      return false;
    } catch (error) {
      showError(error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const forgotPasswordRequestOtp = async (phone: string): Promise<boolean> => {
    try {
      setLoading(true);
      const result = await AuthService.forgotPasswordRequestOtp({ phone });
      if (result.success) {
        showSuccess(result.message || 'OTP sent to your phone.');
        return true;
      }
      return false;
    } catch (error) {
      showError(error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const forgotPasswordReset = async (
    phone: string,
    otp: string,
    newPassword: string,
  ): Promise<boolean> => {
    try {
      setLoading(true);
      const result = await AuthService.forgotPasswordReset({
        phone,
        OTP: otp,
        newPassword,
      });

      if (result.success) {
        showSuccess(result.message || 'Password reset successfully!');
        return true;
      }
      return false;
    } catch (error) {
      showError(error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    const { clearStoredUser, getStoredToken } = await import('../storage/userRealm');
    const { deleteFCMToken } = await import('../services/notifications');
    
    // Delete FCM token from backend before logout
    try {
      const token = await getStoredToken();
      if (token) {
        await deleteFCMToken(token);
      }
    } catch (error) {
      console.error('Error deleting FCM token on logout:', error);
    }
    
    await clearStoredUser();
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        loading,
        initializing,
        isAuthenticated,
        login,
        requestOtp,
        validateOtp,
        register,
        updateProfile,
        resetPassword,
        forgotPasswordRequestOtp,
        forgotPasswordReset,
        currentUser,
        logout,
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

