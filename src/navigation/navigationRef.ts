import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './AppNavigator';

/**
 * Shared navigation ref for deep linking. Must be attached to NavigationContainer
 * in App.tsx so that we can navigate from anywhere (e.g. when handling deep links
 * on cold start or when app is in background).
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
