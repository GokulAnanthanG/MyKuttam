import { useEffect } from 'react';
import { usePushNotification } from '../hooks/usePushNotification';
import { useAuth } from '../context/AuthContext';

/**
 * Component to initialize and handle push notifications
 * This should be added to your App.tsx
 */
export const PushNotificationHandler = () => {
  const { currentUser } = useAuth();
  const { fcmToken, isPermissionGranted, requestPermission, getToken } = usePushNotification();

  useEffect(() => {
    // When user is authenticated:
    // - If permission is not granted, request it (this will also fetch & send token)
    // - If permission is already granted, explicitly fetch/send the token
    if (!currentUser) {
      return;
    }

    const ensureTokenSynced = async () => {
      try {
        if (!isPermissionGranted) {
          await requestPermission();
        } else {
          await getToken();
        }
      } catch (error) {
      }
    };

    ensureTokenSynced();
  }, [currentUser, isPermissionGranted, requestPermission, getToken]);

  // This component doesn't render anything
  return null;
};


