/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { StatusBar, View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { colors } from './src/theme/colors';
import { fonts } from './src/theme/typography';

const toastConfig = {
  success: ({ text1, text2 }: { text1?: string; text2?: string }) => (
    <View
      style={[
        styles.toastContainer,
        {
          backgroundColor: colors.card,
          borderLeftColor: colors.success,
          borderColor: colors.border,
        },
      ]}>
      <View style={styles.toastContent}>
        <Text style={[styles.toastText1, { color: colors.text }]}>{text1}</Text>
        {text2 ? (
          <Text style={[styles.toastText2, { color: colors.textMuted }]}>
            {text2}
          </Text>
        ) : null}
      </View>
    </View>
  ),
  error: ({ text1, text2 }: { text1?: string; text2?: string }) => (
    <View
      style={[
        styles.toastContainer,
        {
          backgroundColor: colors.card,
          borderLeftColor: colors.danger,
          borderColor: colors.border,
        },
      ]}>
      <View style={styles.toastContent}>
        <Text style={[styles.toastText1, { color: colors.text }]}>{text1}</Text>
        {text2 ? (
          <Text style={[styles.toastText2, { color: colors.textMuted }]}>
            {text2}
          </Text>
        ) : null}
      </View>
    </View>
  ),
};

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <AuthProvider>
          <NavigationContainer>
            <AppNavigator />
          </NavigationContainer>
          <Toast config={toastConfig} position="top" topOffset={60} />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    height: 'auto',
    width: '90%',
    borderRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  toastContent: {
    flex: 1,
  },
  toastText1: {
    fontSize: 15,
    fontFamily: fonts.heading,
    marginBottom: 4,
  },
  toastText2: {
    fontSize: 13,
    fontFamily: fonts.body,
  },
});

export default App;
