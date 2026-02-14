import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MoreScreen } from '../screens/MoreScreen';
import { RSSScreen } from '../screens/RSSScreen';
import { ExploreScreen } from '../screens/ExploreScreen';
import { ExploreDetailScreen } from '../screens/ExploreDetailScreen';

export type MoreStackParamList = {
  More: undefined;
  RSS: undefined;
  Explore: undefined;
  ExploreDetail: { title: string };
};

const Stack = createNativeStackNavigator<MoreStackParamList>();

export const MoreNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="More" component={MoreScreen} />
      <Stack.Screen name="RSS" component={RSSScreen} />
      <Stack.Screen name="Explore" component={ExploreScreen} />
      <Stack.Screen name="ExploreDetail" component={ExploreDetailScreen} />
    </Stack.Navigator>
  );
};

