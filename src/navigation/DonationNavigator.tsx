import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DonationScreen } from '../screens/DonationScreen';
import { SubcategoryDetailScreen } from '../screens/SubcategoryDetailScreen';

export type DonationStackParamList = {
  DonationSummary: undefined;
  SubcategoryDetail: {
    categoryId: string;
    categoryName: string;
    subcategoryId: string;
    subcategoryTitle: string;
    subcategoryDescription?: string;
    subcategoryType?: string;
    subcategoryAmount?: number;
    managers?: {
      id: string;
      name: string;
      phone?: string;
    }[];
    subcategoryIncome?: number;
    subcategoryExpense?: number;
    subcategoryNet?: number;
  };
};

const Stack = createNativeStackNavigator<DonationStackParamList>();

export const DonationNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="DonationSummary"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="DonationSummary" component={DonationScreen} />
      <Stack.Screen name="SubcategoryDetail" component={SubcategoryDetailScreen} />
    </Stack.Navigator>
  );
};


