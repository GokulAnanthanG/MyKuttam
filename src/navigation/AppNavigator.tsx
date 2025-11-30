import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { OtpScreen } from '../screens/OtpScreen';
import { RegistrationScreen } from '../screens/RegistrationScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { AboutScreen } from '../screens/AboutScreen';
import { ActiveUsersScreen } from '../screens/ActiveUsersScreen';
import { BottomTabNavigator } from './BottomTabNavigator';
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

export const AppNavigator = () => {
  const { isAuthenticated, initializing } = useAuth();

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

