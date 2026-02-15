import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, View, StyleSheet, Linking } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { OtpScreen } from '../screens/OtpScreen';
import { RegistrationScreen } from '../screens/RegistrationScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { AboutScreen } from '../screens/AboutScreen';
import { ActiveUsersScreen } from '../screens/ActiveUsersScreen';
import { BottomTabNavigator } from './BottomTabNavigator';
import { colors } from '../theme/colors';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';

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

type NavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<RootStackParamList>,
  BottomTabNavigationProp<any>
>;

export const AppNavigator = () => {
  const { isAuthenticated, initializing } = useAuth();
  const navigationRef = useRef<NavigationProp | null>(null);
  
  // Global deep link handler for subcategory (when app opens from closed state)
  useEffect(() => {
    if (!isAuthenticated) return; // Only handle deep links when authenticated
    
    const handleDeepLink = (url: string) => {
      console.log('Global deep link handler:', url);
      
      // Parse audio deep link: mykuttam://audio/:id
      const audioMatch = url.match(/mykuttam:\/\/audio\/(.+)/);
      if (audioMatch && audioMatch[1]) {
        const audioId = audioMatch[1];
        
        // Navigate to Music tab
        setTimeout(() => {
          try {
            (navigationRef.current as any)?.navigate('MainTabs', {
              screen: 'Music',
            });
            // The MusicScreen will handle the deep link and play the audio
          } catch (error) {
            console.error('Failed to navigate to music:', error);
          }
        }, 500);
        return;
      }

      // Parse subcategory deep link: mykuttam://subcategory/:categoryId/:subcategoryId
      const subcategoryMatch = url.match(/mykuttam:\/\/subcategory\/([^\/]+)\/([^\/]+)/);
      if (subcategoryMatch && subcategoryMatch[1] && subcategoryMatch[2]) {
        const categoryId = subcategoryMatch[1];
        const subcategoryId = subcategoryMatch[2];
        
        // Navigate to Donation tab and then to SubcategoryDetail
        // Note: This requires the navigation to be ready
        setTimeout(() => {
          try {
            (navigationRef.current as any)?.navigate('MainTabs', {
              screen: 'Donation',
              params: {
                screen: 'SubcategoryDetail',
                params: {
                  categoryId,
                  subcategoryId,
                  // Other params will be fetched by the screen
                },
              },
            });
          } catch (error) {
            console.error('Failed to navigate to subcategory:', error);
          }
        }, 500);
        return;
      }
    };

    // Handle deep link when app opens from closed state
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    // Listen for deep links when app is open
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
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

