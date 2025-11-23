import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import { NewsScreen } from './NewsScreen';

export const HomeScreen = () => {
  const hasShownOfflineToast = useRef(false);

  useEffect(() => {
    // Check initial network state
    const checkInitialState = async () => {
      const state = await NetInfo.fetch();
      if (!state.isConnected && !hasShownOfflineToast.current) {
        Toast.show({
          type: 'error',
          text1: 'Offline',
          text2: 'You are currently offline. Some features may not be available.',
          visibilityTime: 4000,
        });
        hasShownOfflineToast.current = true;
      }
    };

    checkInitialState();

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (!state.isConnected && !hasShownOfflineToast.current) {
        Toast.show({
          type: 'error',
          text1: 'Offline',
          text2: 'You are currently offline. Some features may not be available.',
          visibilityTime: 4000,
        });
        hasShownOfflineToast.current = true;
      } else if (state.isConnected) {
        // Reset the flag when back online
        hasShownOfflineToast.current = false;
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return <NewsScreen />;
};

