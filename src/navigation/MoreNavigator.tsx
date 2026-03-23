import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MoreScreen } from '../screens/MoreScreen';
import { RSSScreen } from '../screens/RSSScreen';
import { ExploreScreen } from '../screens/ExploreScreen';
import { ExploreDetailScreen } from '../screens/ExploreDetailScreen';
import { LuckyDrawConfigScreen } from '../screens/LuckyDrawConfigScreen';
import { GiftConfigScreen } from '../screens/GiftConfigScreen';
import { AdminDrawWebViewScreen } from '../screens/AdminDrawWebViewScreen';

export type MoreStackParamList = {
  More: undefined;
  RSS: undefined;
  Explore: undefined;
  ExploreDetail: { title: string };
  LuckyDrawConfig: undefined;
  GiftConfig: { eventId: string; eventTitle?: string; gifts?: any[] };
  AdminDrawWebView: { url: string };
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
      <Stack.Screen name="LuckyDrawConfig" component={LuckyDrawConfigScreen} />
      <Stack.Screen name="GiftConfig" component={GiftConfigScreen} />
      <Stack.Screen name="AdminDrawWebView" component={AdminDrawWebViewScreen} />
    </Stack.Navigator>
  );
};

