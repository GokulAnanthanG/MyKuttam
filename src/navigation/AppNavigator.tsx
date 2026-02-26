import React, { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet, Linking } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { OtpScreen } from '../screens/OtpScreen';
import { RegistrationScreen } from '../screens/RegistrationScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { AboutScreen } from '../screens/AboutScreen';
import { ActiveUsersScreen } from '../screens/ActiveUsersScreen';
import { BottomTabNavigator } from './BottomTabNavigator';
import { navigationRef } from './navigationRef';
import { colors } from '../theme/colors';

export type RootStackParamList = {
  Login: undefined;
  Otp: { initialPhone?: string };
  Register: { phone: string };
  ForgotPassword: undefined;
  MainTabs: undefined;
  About: undefined;
  ActiveUsers: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Wait until the navigation container is ready (needed for cold start). */
function waitForNavigationReady(): Promise<void> {
  return new Promise((resolve) => {
    if (navigationRef.isReady()) {
      resolve();
      return;
    }
    const check = () => {
      if (navigationRef.isReady()) {
        resolve();
      } else {
        setTimeout(check, 50);
      }
    };
    setTimeout(check, 50);
  });
}

/** Navigate based on deep link URL. Handles cold start, background, and foreground. */
function handleDeepLink(url: string): void {
  if (!url) return;
  console.log('Global deep link handler:', url);

  // Parse news deep link: mykuttam://news/:id
  const newsMatch = url.match(/mykuttam:\/\/news\/(.+)/);
  if (newsMatch && newsMatch[1]) {
    const newsId = newsMatch[1];
    try {
      (navigationRef as any).navigate('MainTabs', {
        screen: 'Home',
        params: { initialNewsId: newsId },
      });
    } catch (error) {
      console.error('Failed to navigate to news:', error);
    }
    return;
  }

  // Parse gallery deep link: mykuttam://gallery/:id
  const galleryMatch = url.match(/mykuttam:\/\/gallery\/(.+)/);
  if (galleryMatch && galleryMatch[1]) {
    const imageId = galleryMatch[1];
    try {
      (navigationRef as any).navigate('MainTabs', {
        screen: 'Gallery',
        params: { imageId },
      });
    } catch (error) {
      console.error('Failed to navigate to gallery:', error);
    }
    return;
  }

  // Parse audio deep link: mykuttam://audio/:id
  const audioMatch = url.match(/mykuttam:\/\/audio\/(.+)/);
  if (audioMatch && audioMatch[1]) {
    const audioId = audioMatch[1];
    try {
      (navigationRef as any).navigate('MainTabs', {
        screen: 'Music',
        params: { audioId },
      });
    } catch (error) {
      console.error('Failed to navigate to music:', error);
    }
    return;
  }

  // Parse subcategory deep link: mykuttam://subcategory/:categoryId/:subcategoryId
  const subcategoryMatch = url.match(/mykuttam:\/\/subcategory\/([^/]+)\/([^/]+)/);
  if (subcategoryMatch && subcategoryMatch[1] && subcategoryMatch[2]) {
    const categoryId = subcategoryMatch[1];
    const subcategoryId = subcategoryMatch[2];
    try {
      (navigationRef as any).navigate('MainTabs', {
        screen: 'Donation',
        params: {
          screen: 'SubcategoryDetail',
          params: {
            categoryId,
            subcategoryId,
          },
        },
      });
    } catch (error) {
      console.error('Failed to navigate to subcategory:', error);
    }
  }
}

export const AppNavigator = () => {
  const { isAuthenticated, initializing } = useAuth();

  // Global deep link handler: cold start, background, and foreground
  useEffect(() => {
    if (!isAuthenticated) return;

    // Cold start: app opened from closed state via deep link
    Linking.getInitialURL().then((url) => {
      if (!url) return;
      waitForNavigationReady().then(() => {
        handleDeepLink(url);
      });
    });

    // Foreground / background: app already open or coming back from background
    const subscription = Linking.addEventListener('url', (event) => {
      if (navigationRef.isReady()) {
        handleDeepLink(event.url);
      } else {
        waitForNavigationReady().then(() => handleDeepLink(event.url));
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated]);

  // Show loading screen while checking for stored session
  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Determine initial route based on authentication status
  // If user and token exist in Realm, navigate directly to MainTabs (Home)
  const initialRoute: 'Login' | 'MainTabs' = isAuthenticated
    ? 'MainTabs'
    : 'Login';

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Otp" component={OtpScreen} />
      <Stack.Screen name="Register" component={RegistrationScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="ActiveUsers" component={ActiveUsersScreen} />
      <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});

