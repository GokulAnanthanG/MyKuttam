import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { AuthLayout } from '../components/AuthLayout';
import { AppTextInput } from '../components/AppTextInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { TextLink } from '../components/TextLink';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Otp'>;

export const OtpScreen = ({ navigation, route }: Props) => {
  const { loading, requestOtp } = useAuth();
  const initialPhone = route.params?.initialPhone || '';
  const [phone, setPhone] = useState(initialPhone);
  const [otp, setOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);

  useEffect(() => {
    setPhone(initialPhone);
  }, [initialPhone]);

  const canSendOtp = useMemo(
    () => phone.trim().length === 10 && !loading,
    [phone, loading],
  );

  const canContinue = useMemo(
    () => otpRequested && otp.trim().length >= 4,
    [otpRequested, otp],
  );

  const handleSendOtp = async () => {
    if (!canSendOtp) {
      return;
    }

    const success = await requestOtp(phone.trim());
    if (success) {
      setOtpRequested(true);
    }
  };

  const handleContinue = () => {
    if (!canContinue) {
      return;
    }

    navigation.navigate('Register', {
      phone: phone.trim(),
      otp: otp.trim(),
    });
  };

  return (
    <AuthLayout
      title="Verify your number"
      subtitle="We’ll text you a one time password to secure your registration."
      footer={
        <TextLink label="Back to login" onPress={() => navigation.goBack()} />
      }>
      <View style={styles.content}>
        <View style={styles.progress}>
          <Text style={styles.step}>Step 1 of 2</Text>
          <Text style={styles.caption}>Request your secure OTP</Text>
        </View>
        <AppTextInput
          label="Registered phone"
          placeholder="10 digit mobile number"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          maxLength={10}
        />
        <PrimaryButton
          label={otpRequested ? 'Resend OTP' : 'Send OTP'}
          onPress={handleSendOtp}
          loading={loading}
          disabled={!canSendOtp}
        />
        {otpRequested ? (
          <View style={styles.otpBlock}>
            <Text style={styles.otpLabel}>Enter received OTP</Text>
            <AppTextInput
              label="One time password"
              placeholder="6 digit code"
              keyboardType="number-pad"
              value={otp}
              onChangeText={setOtp}
              maxLength={6}
            />
            <PrimaryButton
              label="Continue to registration"
              onPress={handleContinue}
              disabled={!canContinue}
            />
          </View>
        ) : null}
      </View>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  content: {
    gap: 12,
  },
  progress: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.cardMuted,
  },
  step: {
    color: colors.primary,
    fontFamily: fonts.heading,
    fontSize: 14,
  },
  caption: {
    color: colors.text,
    fontFamily: fonts.body,
    marginTop: 4,
  },
  otpBlock: {
    marginTop: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: colors.cardMuted,
  },
  otpLabel: {
    fontFamily: fonts.heading,
    color: colors.text,
    marginBottom: 8,
  },
});


