import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from 'react';
import Toast from 'react-native-toast-message';
import { AuthService } from '../services/auth';
import { saveUserToRealm, getStoredUser } from '../storage/userRealm';
import { StoredUser } from '../types/user';

type AuthContextType = {
  loading: boolean;
  initializing: boolean;
  isAuthenticated: boolean;
  login: (phone: string, password: string) => Promise<boolean>;
  requestOtp: (phone: string) => Promise<boolean>;
  register: (user: StoredUser, otp: string) => Promise<boolean>;
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

  if (typeof error === 'object' && 'message' in error) {
    return String((error as { message?: string }).message);
  }

  return 'Something went wrong. Please try again.';
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);

  // Load user from Realm on mount
  useEffect(() => {
    const loadStoredUser = async () => {
      try {
        const { user, token } = await getStoredUser();
        // Only set user if both user and token exist
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
        // Save user and token to Realm
        await saveUserToRealm(result.user, result.token);
        setCurrentUser(result.user);
        showSuccess(result.message || 'Login successful!');
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

  const register = async (user: StoredUser, otp: string): Promise<boolean> => {
    try {
      setLoading(true);
      const result = await AuthService.register({ user, OTP: otp });
      if (result.user) {
        // Save user and token (if provided) to Realm
        await saveUserToRealm(result.user, result.token);
        setCurrentUser(result.user);
        showSuccess('Registration complete!');
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
    const { clearStoredUser } = await import('../storage/userRealm');
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
        register,
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

