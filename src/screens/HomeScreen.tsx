import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View, Alert, Linking, Platform, AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NewsScreen } from './NewsScreen';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { RootStackParamList } from '../navigation/AppNavigator';
import { DailyActiveUserService } from '../services/dailyActiveUsers';
import { usePushNotification } from '../hooks/usePushNotification';
import messaging from '@react-native-firebase/messaging';

type Props = NativeStackNavigationProp<RootStackParamList>;

export const HomeScreen = () => {
  const navigation = useNavigation<Props>();
  const { currentUser } = useAuth();
  const { isPermissionGranted, requestPermission, isLoading } = usePushNotification();
  const hasShownOfflineToast = useRef(false);
  const hasCheckedNotificationPermission = useRef(false);
  const appState = useRef(AppState.currentState);

  const isAdmin = useMemo(() => {
    return currentUser?.role && currentUser.role.includes('ADMIN');
  }, [currentUser?.role]);

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

  // Track daily active user when screen loads (if user is authenticated)
  useEffect(() => {
    const recordActiveUser = async () => {
      if (!currentUser) {
        return; // Don't record if user is not authenticated
      }

      try {
        // Silently record user as active - don't show errors to user
        const response = await DailyActiveUserService.recordActiveUser();
        if (response.success) {
        } else {
        }
      } catch (error) {
        // Silently fail - don't interrupt user experience
      }
    };

    recordActiveUser();
  }, [currentUser]);

  // Check notification permission and prompt to enable if disabled
  useEffect(() => {
    const checkNotificationPermission = async () => {
      // Only check once per session
      if (hasCheckedNotificationPermission.current || !currentUser) {
        return;
      }

      // Wait for the hook to finish loading and then check permission
      const checkPermission = async () => {
        try {
          // Check permission status directly from messaging API
          const authStatus = await messaging().hasPermission();
          const hasPermission =
            Platform.OS === 'ios'
              ? authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                authStatus === messaging.AuthorizationStatus.PROVISIONAL
              : authStatus === messaging.AuthorizationStatus.AUTHORIZED;


          // Only show alert if permission is actually not granted
          if (!hasPermission) {
            hasCheckedNotificationPermission.current = true;
            // Show alert to enable notifications
            Alert.alert(
              'Enable Notifications',
              'Notifications are currently disabled. Would you like to enable them to receive important updates?',
              [
                {
                  text: 'Not Now',
                  style: 'cancel',
                },
                {
                  text: 'Enable',
                  onPress: () => {
                    // Directly open device settings to enable notifications
                    // Since notifications are disabled in device settings, requestPermission won't work
                    if (Platform.OS === 'ios') {
                      Linking.openURL('app-settings:').catch((err) => {
                        Alert.alert(
                          'Open Settings',
                          'Please go to Settings > [App Name] > Notifications and enable them manually.'
                        );
                      });
                    } else {
                      Linking.openSettings().catch((err) => {
                        Alert.alert(
                          'Open Settings',
                          'Please go to Settings > Apps > [App Name] > Notifications and enable them manually.'
                        );
                      });
                    }
                  },
                },
              ],
              { cancelable: true }
            );
          } else {
            // Permission is granted, mark as checked so we don't show the alert
            hasCheckedNotificationPermission.current = true;
          }
        } catch (error) {
          // On error, don't show the alert
          hasCheckedNotificationPermission.current = true;
        }
      };

      // Wait for hook to finish loading, then check permission
      if (isLoading) {
        // Wait a bit more for loading to complete
        setTimeout(checkPermission, 1000);
      } else {
        // Hook already loaded, check immediately
        setTimeout(checkPermission, 500);
      }
    };

    checkNotificationPermission();
  }, [currentUser, isLoading]);

  // Listen for app state changes to check permission when returning from settings
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // When app comes back to foreground from settings
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // Reset the check flag so we can check again if needed
        // The usePushNotification hook will update isPermissionGranted automatically
        if (!isPermissionGranted && currentUser) {
          // If still not granted after coming back, user might have enabled it
          // The hook will update the state, but we can show a success message if it's now enabled
          setTimeout(() => {
            // Check again after a brief delay to allow hook to update
            if (isPermissionGranted) {
              Toast.show({
                type: 'success',
                text1: 'Notifications Enabled',
                text2: 'Thank you for enabling notifications!',
              });
            }
          }, 500);
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [currentUser, isPermissionGranted]);

  return (
    <View style={styles.container}>
      <NewsScreen />
      {isAdmin && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('ActiveUsers')}
          activeOpacity={0.85}>
          <Icon name="users" size={20} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 1000,
  },
});

