import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MoreStackParamList } from '../navigation/MoreNavigator';
import Toast from 'react-native-toast-message';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { BASE_URL } from '../config/api';

type MoreScreenNavigationProp = NativeStackNavigationProp<MoreStackParamList, 'More'>;

const { width } = Dimensions.get('window');
const PADDING = 20;
const GAP = 20;
const ITEM_WIDTH = (width - PADDING * 2 - GAP) / 2; // 2 columns with padding and gap

interface AppOption {
  id: string;
  title: string;
  icon: string;
  iconColor: string;
  backgroundColor: string;
  onPress: () => void;
}

export const MoreScreen = () => {
  const navigation = useNavigation<MoreScreenNavigationProp>();

  const appOptions: AppOption[] = [
    {
      id: 'news',
      title: 'News',
      icon: 'newspaper-o',
      iconColor: '#FFFFFF',
      backgroundColor: '#FF6B6B', // Red
      onPress: () => {
        // Navigate to RSS screen
        navigation.navigate('RSS');
      },
    },
    {
      id: 'explore',
      title: 'Explore',
      icon: 'compass',
      iconColor: '#FFFFFF',
      backgroundColor: '#4ECDC4', // Teal
      onPress: () => {
        navigation.navigate('Explore');
      },
    },
    {
      id: 'events',
      title: 'Events',
      icon: 'gift',
      iconColor: '#FFFFFF',
      backgroundColor: '#FFE66D', // Yellow
      onPress: async () => {
        try {
          if (!BASE_URL) {
            Toast.show({
              type: 'error',
              text1: 'Error',
              text2: 'Base URL not configured',
              visibilityTime: 3000,
            });
            return;
          }

          // Remove /api from BASE_URL if present (web endpoint is at root level)
          let baseUrl = BASE_URL;
          if (baseUrl.endsWith('/api')) {
            baseUrl = baseUrl.slice(0, -4);
          } else if (baseUrl.includes('/api/')) {
            baseUrl = baseUrl.replace('/api', '');
          }

          // Ensure no trailing slash
          baseUrl = baseUrl.replace(/\/$/, '');

          const eventsUrl = `${baseUrl}/events`;
          await Linking.openURL(eventsUrl);
        } catch (error) {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: error instanceof Error ? error.message : 'Failed to open events page',
            visibilityTime: 3000,
          });
        }
      },
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>More</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.gridContainer}>
          {appOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.appCard,
                { backgroundColor: option.backgroundColor },
              ]}
              onPress={option.onPress}
              activeOpacity={0.8}>
              <View style={styles.iconContainer}>
                <Icon
                  name={option.icon}
                  size={48}
                  color={option.iconColor}
                />
              </View>
              <Text style={styles.appTitle}>{option.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 28,
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  appCard: {
    width: ITEM_WIDTH,
    aspectRatio: 1,
    borderRadius: 20,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: GAP,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  iconContainer: {
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

