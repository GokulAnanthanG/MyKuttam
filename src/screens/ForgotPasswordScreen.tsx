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

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export const ForgotPasswordScreen = ({ navigation }: Props) => {
  const { loading, forgotPasswordRequestOtp, forgotPasswordReset } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);

  const canRequestOtp = useMemo(
    () => phone.trim().length === 10 && !loading,
    [phone, loading],
  );

  const canResetPassword = useMemo(
    () =>
      otpRequested &&
      otp.trim().length >= 4 &&
      newPassword.trim().length >= 6 &&
      newPassword === confirmPassword,
    [otpRequested, otp, newPassword, confirmPassword],
  );

  const handleRequestOtp = async () => {
    if (!canRequestOtp) {
      return;
    }

    const success = await forgotPasswordRequestOtp(phone.trim());
    if (success) {
      setOtpRequested(true);
    }
  };

  const handleResetPassword = async () => {
    if (!canResetPassword) {
      return;
    }

    const success = await forgotPasswordReset(
      phone.trim(),
      otp.trim(),
      newPassword.trim(),
    );
    if (success) {
      // Navigate back to login after successful password reset
      navigation.replace('Login');
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your registered phone number to receive an OTP for password reset."
      footer={
        <TextLink label="Back to login" onPress={() => navigation.goBack()} />
      }>
      <View style={styles.content}>
        {!otpRequested ? (
          <>
            <View style={styles.progress}>
              <Text style={styles.step}>Step 1 of 2</Text>
              <Text style={styles.caption}>Request OTP for password reset</Text>
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
              label="Send OTP"
              onPress={handleRequestOtp}
              loading={loading}
              disabled={!canRequestOtp}
            />
          </>
        ) : (
          <>
            <View style={styles.progress}>
              <Text style={styles.step}>Step 2 of 2</Text>
              <Text style={styles.caption}>Enter OTP and set new password</Text>
            </View>
            <View style={styles.phoneDisplay}>
              <Text style={styles.phoneLabel}>Phone Number</Text>
              <Text style={styles.phoneValue}>{phone}</Text>
            </View>
            <AppTextInput
              label="OTP"
              placeholder="Enter OTP"
              keyboardType="number-pad"
              value={otp}
              onChangeText={setOtp}
              maxLength={6}
            />
            <AppTextInput
              label="New Password"
              placeholder="Enter new password"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <AppTextInput
              label="Confirm New Password"
              placeholder="Confirm new password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            {newPassword !== confirmPassword && confirmPassword.length > 0 && (
              <Text style={styles.errorText}>Passwords do not match</Text>
            )}
            <PrimaryButton
              label="Reset Password"
              onPress={handleResetPassword}
              loading={loading}
              disabled={!canResetPassword}
            />
            <PrimaryButton
              label="Resend OTP"
              onPress={handleRequestOtp}
              variant="secondary"
              loading={loading}
              disabled={!canRequestOtp}
            />
          </>
        )}
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
    fontWeight: '600',
  },
  caption: {
    color: colors.text,
    fontFamily: fonts.body,
    marginTop: 4,
    fontSize: 13,
  },
  phoneDisplay: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  phoneLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  phoneValue: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  errorText: {
    color: colors.danger,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: -8,
    marginBottom: 4,
  },
});

