import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/HomeScreen';
import { DonationScreen } from '../screens/DonationScreen';
import { GalleryScreen } from '../screens/GalleryScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { Text, View, StyleSheet } from 'react-native';

export type BottomTabParamList = {
  Home: undefined;
  Donation: undefined;
  Gallery: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<BottomTabParamList>();

const TabIcon = ({
  focused,
  icon,
}: {
  focused: boolean;
  icon: string;
}) => (
  <View style={[styles.iconContainer, focused && styles.iconContainerFocused]}>
    <Text
      style={[
        styles.icon,
        focused ? styles.iconFocused : styles.iconInactive,
      ]}>
      {icon}
    </Text>
  </View>
);

export const BottomTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 65,
          paddingBottom: 10,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.body,
          fontSize: 11,
          marginTop: 2,
        },
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon focused={focused} icon="🏠" />
          ),
        }}
      />
      <Tab.Screen
        name="Donation"
        component={DonationScreen}
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon focused={focused} icon="💰" />
          ),
        }}
      />
      <Tab.Screen
        name="Gallery"
        component={GalleryScreen}
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon focused={focused} icon="🖼️" />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon focused={focused} icon="👤" />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  iconContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerFocused: {
    backgroundColor: colors.cardMuted,
  },
  icon: {
    fontSize: 24,
  },
  iconFocused: {
    opacity: 1,
  },
  iconInactive: {
    opacity: 0.5,
  },
});

