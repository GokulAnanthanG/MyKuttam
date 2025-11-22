import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { OtpScreen } from '../screens/OtpScreen';
import { RegistrationScreen } from '../screens/RegistrationScreen';
import { BottomTabNavigator } from './BottomTabNavigator';
import { colors } from '../theme/colors';

export type RootStackParamList = {
  Login: undefined;
  Otp: { initialPhone?: string };
  Register: { phone: string; otp: string };
  MainTabs: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const { isAuthenticated, initializing } = useAuth();
  const [initialRoute, setInitialRoute] = useState<'Login' | 'MainTabs'>(
    'Login',
  );

  useEffect(() => {
    if (!initializing) {
      setInitialRoute(isAuthenticated ? 'MainTabs' : 'Login');
    }
  }, [isAuthenticated, initializing]);

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

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

