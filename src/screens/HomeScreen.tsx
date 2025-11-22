import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to MyKuttam</Text>
        <Text style={styles.subtitle}>Your village community platform</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 24,
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textMuted,
  },
});

