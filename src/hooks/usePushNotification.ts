import { useState, useEffect, useRef } from 'react';
import { Platform, Alert, AppState, AppStateStatus } from 'react-native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { useNavigation } from '@react-navigation/native';
import { saveFCMToken } from '../services/notifications';
import { getStoredToken } from '../storage/userRealm';

export interface PushNotificationData {
  [key: string]: string | number | boolean | undefined;
}

export interface UsePushNotificationReturn {
  fcmToken: string | null;
  isLoading: boolean;
  isPermissionGranted: boolean;
  requestPermission: () => Promise<boolean>;
  getToken: () => Promise<string | null>;
  deleteToken: () => Promise<void>;
}

/**
 * Custom hook for handling Firebase Cloud Messaging (FCM) push notifications
 * 
 * Features:
 * - Request notification permissions
 * - Get FCM token
 * - Automatically send token to backend
 * - Handle foreground notifications
 * - Handle background notifications
 * - Handle notification taps
 * - Handle token refresh
 * 
 * @returns {UsePushNotificationReturn} Object containing FCM token, loading state, and helper functions
 */
export const usePushNotification = (): UsePushNotificationReturn => {
  const navigation = useNavigation();
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const appState = useRef(AppState.currentState);
  const isRequestingPermission = useRef(false);

  /**
   * Request notification permissions
   */
  const requestPermission = async (): Promise<boolean> => {
    // Prevent multiple simultaneous permission requests
    if (isRequestingPermission.current) {
      console.log('Permission request already in progress');
      return isPermissionGranted;
    }

    try {
      isRequestingPermission.current = true;
      
      if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        setIsPermissionGranted(enabled);
        if (enabled) {
          await getToken();
        }
        return enabled;
      } else {
        // Android 13+ requires runtime permission
        const authStatus = await messaging().requestPermission();
        const granted = authStatus === 1; // 1 = granted
        setIsPermissionGranted(granted);
        if (granted) {
          await getToken();
        }
        return granted;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      setIsPermissionGranted(false);
      return false;
    } finally {
      isRequestingPermission.current = false;
    }
  };

  /**
   * Get FCM token and send to backend
   */
  const getToken = async (): Promise<string | null> => {
    try {
      const token = await messaging().getToken();
      setFcmToken(token);
      
      // Send token to backend if user is authenticated
      const authToken = await getStoredToken();
      if (token && authToken) {
        try {
          await saveFCMToken(token, authToken);
          console.log('FCM token sent to backend successfully');
        } catch (error) {
          console.error('Error sending FCM token to backend:', error);
        }
      }
      
      return token;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      setFcmToken(null);
      return null;
    }
  };

  /**
   * Delete FCM token (for logout)
   */
  const deleteToken = async (): Promise<void> => {
    try {
      await messaging().deleteToken();
      setFcmToken(null);
    } catch (error) {
      console.error('Error deleting FCM token:', error);
    }
  };

  /**
   * Handle foreground notifications
   */
  useEffect(() => {
    const unsubscribe = messaging().onMessage(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      console.log('Foreground notification received:', remoteMessage);

      const { notification, data } = remoteMessage;

      // Show local notification or alert
      if (notification) {
        Alert.alert(
          notification.title || 'New Notification',
          notification.body || 'You have a new message',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'View',
              onPress: () => {
                // Handle navigation based on data
                handleNotificationNavigation(data);
              },
            },
          ],
          { cancelable: true }
        );
      }
    });

    return unsubscribe;
  }, [navigation]);

  /**
   * Handle notification taps (when app is in background or closed)
   */
  useEffect(() => {
    // Handle notification that opened the app from closed state
    messaging()
      .getInitialNotification()
      .then((remoteMessage: FirebaseMessagingTypes.RemoteMessage | null) => {
        if (remoteMessage) {
          console.log('Notification opened app from closed state:', remoteMessage);
          handleNotificationNavigation(remoteMessage.data);
        }
      });

    // Handle notification that opened the app from background
    const unsubscribe = messaging().onNotificationOpenedApp(
      (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
        console.log('Notification opened app from background:', remoteMessage);
        handleNotificationNavigation(remoteMessage.data);
      }
    );

    return unsubscribe;
  }, [navigation]);

  /**
   * Handle token refresh
   */
  useEffect(() => {
    const unsubscribe = messaging().onTokenRefresh(async (token: string) => {
      console.log('FCM token refreshed:', token);
      setFcmToken(token);
      
      // Send new token to backend
      const authToken = await getStoredToken();
      if (token && authToken) {
        try {
          await saveFCMToken(token, authToken);
          console.log('Refreshed FCM token sent to backend');
        } catch (error) {
          console.error('Error sending refreshed FCM token to backend:', error);
        }
      }
    });

    return unsubscribe;
  }, []);

  /**
   * Handle app state changes for background notifications
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground, check for pending notifications
        messaging()
          .getInitialNotification()
          .then((remoteMessage: FirebaseMessagingTypes.RemoteMessage | null) => {
            if (remoteMessage) {
              handleNotificationNavigation(remoteMessage.data);
            }
          });
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [navigation]);

  /**
   * Initialize: Request permission on app launch and get token
   */
  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);

        // Check current permission status
        const authStatus = await messaging().hasPermission();
        const hasPermission =
          Platform.OS === 'ios'
            ? authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
              authStatus === messaging.AuthorizationStatus.PROVISIONAL
            : authStatus === messaging.AuthorizationStatus.AUTHORIZED;

        setIsPermissionGranted(hasPermission);

        // If permission is not granted, request it immediately on app launch
        if (!hasPermission) {
          console.log('Notification permission not granted, requesting...');
          await requestPermission();
        } else {
          // Permission already granted, get FCM token
          await getToken();
        }
      } catch (error) {
        console.error('Error initializing push notifications:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  /**
   * Handle navigation based on notification data
   */
  const handleNotificationNavigation = (data?: PushNotificationData) => {
    if (!data) return;

    try {
      // Check if navigation is available
      if (!navigation || !navigation.navigate) {
        console.warn('Navigation not available yet');
        return;
      }

      // Example: Navigate based on notification type
      const type = data.type as string;
      const id = data.id as string;

      switch (type) {
        case 'news':
          // Navigate to news detail
          if (id) {
            (navigation as any).navigate('MainTabs', {
              screen: 'Home',
              params: { newsId: id },
            });
          }
          break;
        case 'donation':
          // Navigate to donation screen
          (navigation as any).navigate('MainTabs', {
            screen: 'Donation',
          });
          break;
        case 'gallery':
          // Navigate to gallery
          (navigation as any).navigate('MainTabs', {
            screen: 'Gallery',
          });
          break;
        default:
          // Navigate to home
          (navigation as any).navigate('MainTabs', {
            screen: 'Home',
          });
      }
    } catch (error) {
      console.error('Error handling notification navigation:', error);
    }
  };

  return {
    fcmToken,
    isLoading,
    isPermissionGranted,
    requestPermission,
    getToken,
    deleteToken,
  };
};

