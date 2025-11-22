import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { AuthSimpleLayout } from '../components/AuthSimpleLayout';
import { AppTextInput } from '../components/AppTextInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { TextLink } from '../components/TextLink';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export const LoginScreen = ({ navigation }: Props) => {
  const { loading, login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const isValid = useMemo(
    () => phone.trim().length === 10 && password.trim().length >= 6,
    [phone, password],
  );

  const handleSubmit = async () => {
    if (!isValid || loading) {
      return;
    }

    const success = await login(phone.trim(), password.trim());
    if (success) {
      navigation.replace('MainTabs');
    }
  };

  return (
    <AuthSimpleLayout
      title="Welcome back"
      subtitle="Access your community dashboard with your registered phone number.">
      <View style={styles.form}>
        <View style={styles.greeting}>
          <Text style={styles.hero}>MyKuttam</Text>
          <Text style={styles.heroSubtitle}>Your Village Community</Text>
        </View>
        <AppTextInput
          label="Phone Number"
          placeholder="10 digit mobile number"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          maxLength={10}
          returnKeyType="next"
        />
        <AppTextInput
          label="Password"
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          returnKeyType="done"
        />
        <PrimaryButton
          label="Log in"
          onPress={handleSubmit}
          loading={loading}
          disabled={!isValid || loading}
        />
        <View style={styles.linksContainer}>
          <TextLink
            label="Forgot password?"
            onPress={() => navigation.navigate('ForgotPassword')}
          />
          <Text style={styles.separator}>•</Text>
          <TextLink
            label="Create account"
            onPress={() => navigation.navigate('Otp', {})}
          />
        </View>
      </View>
    </AuthSimpleLayout>
  );
};

const styles = StyleSheet.create({
  form: {
    gap: 8,
  },
  greeting: {
    marginBottom: 12,
  },
  hero: {
    fontFamily: fonts.heading,
    fontSize: 28,
    color: colors.text,
  },
  heroSubtitle: {
    fontFamily: fonts.light,
    color: colors.textMuted,
    marginTop: 4,
  },
  linksContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  separator: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: fonts.body,
  },
});


