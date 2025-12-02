import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { RootStackParamList } from '../navigation/AppNavigator';
import { AuthSimpleLayout } from '../components/AuthSimpleLayout';
import { AppTextInput } from '../components/AppTextInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { TextLink } from '../components/TextLink';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Otp'>;

export const OtpScreen = ({ navigation, route }: Props) => {
  const { loading, requestOtp, validateOtp } = useAuth();
  const initialPhone = route.params?.initialPhone || '';
  const [phone, setPhone] = useState(initialPhone);
  const [otp, setOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    setPhone(initialPhone);
  }, [initialPhone]);

  const canSendOtp = useMemo(
    () => phone.trim().length === 10 && !loading,
    [phone, loading],
  );

  const canContinue = useMemo(
    () => otpRequested && otp.trim().length > 0 && !validating,
    [otpRequested, otp, validating],
  );

  const handleSendOtp = async () => {
    if (!canSendOtp) {
      return;
    }

    try {
      const success = await requestOtp(phone.trim());
      if (success) {
        // OTP was sent successfully
        setOtpRequested(true);
        // Reset OTP when requesting new OTP
        setOtp('');
        setValidating(false);
      }
    } catch (error: any) {
      // Check if this is the special error for "OTP already validated"
      if (error?.message === 'OTP_ALREADY_VALIDATED' || error?.shouldNavigate) {
        // Navigate to registration if OTP is already validated
        navigation.navigate('Register', {
          phone: phone.trim(),
        });
        return;
      }
      
      // For other errors, the error toast is already shown by requestOtp
    }
  };

  const handleContinue = async () => {
    const trimmedPhone = phone.trim();
    const trimmedOtp = otp.trim();
    
    // Validate phone number
    if (trimmedPhone.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Phone Required',
        text2: 'Please enter your phone number.',
      });
      return;
    }

    if (trimmedPhone.length !== 10) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Phone',
        text2: 'Please enter a valid 10-digit phone number.',
      });
      return;
    }

    // Validate OTP input
    if (trimmedOtp.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'OTP Required',
        text2: 'Please enter the OTP sent to your phone.',
      });
      return;
    }

    if (!otpRequested) {
      Toast.show({
        type: 'error',
        text1: 'OTP Not Requested',
        text2: 'Please request an OTP first.',
      });
      return;
    }

    // Prevent multiple simultaneous calls
    if (validating || loading) {
      return;
    }

    setValidating(true);
    
    try {
      const success = await validateOtp(trimmedPhone, trimmedOtp);
      
      if (success) {
        // OTP validated successfully, navigate to registration
        navigation.navigate('Register', {
          phone: trimmedPhone,
        });
      } else {
        // Don't show Alert - error toast is already shown by validateOtp in AuthContext
        // Only navigate if the toast message indicates OTP already validated
        // (This is a fallback in case validateOtp returns false but showed success toast)
        // Error toast is already shown by AuthContext, no need for Alert
      }
    } catch (error: any) {
      
      // Extract error message
      let errorMessage = 'Failed to validate OTP. Please try again.';
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      // If error message indicates OTP already validated, allow navigation to registration
      const normalizedMessage = errorMessage.toLowerCase().trim();
      if (normalizedMessage.includes('otp has already been validated') ||
          normalizedMessage.includes('already been validated')) {
        // Navigate to registration if OTP is already validated
        // Toast is already shown by AuthContext, just navigate
        navigation.navigate('Register', {
          phone: trimmedPhone,
        });
        return;
      }
      
      // Error toast is already shown by AuthContext, no need for additional Alert
      // Just show toast for any additional error context if needed
      Toast.show({
        type: 'error',
        text1: 'Validation Failed',
        text2: errorMessage,
      });
    } finally {
      setValidating(false);
    }
  };

  return (
    <AuthSimpleLayout
      title="Verify your number"
      subtitle="We'll text you a one time password to secure your registration.">
      <View style={styles.content}>
        <View style={styles.progress}>
          <Text style={styles.step}>
            {otpRequested ? 'Step 2 of 3' : 'Step 1 of 3'}
          </Text>
          <Text style={styles.caption}>
            {otpRequested
              ? 'Enter the OTP sent to your phone and continue to registration'
              : 'Request your secure OTP'}
          </Text>
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
              placeholder="Enter OTP code"
              keyboardType="number-pad"
              value={otp}
              onChangeText={setOtp}
              editable={!validating}
            />
            <PrimaryButton
              label="Continue to registration"
              onPress={handleContinue}
              loading={validating || loading}
              disabled={!canContinue || validating}
            />
            {validating && (
              <Text style={styles.validatingText}>Validating OTP...</Text>
            )}
            {loading && (
              <Text style={styles.validatingText}>Loading...</Text>
            )}
          </View>
        ) : null}
        <View style={styles.footerLinks}>
          <TextLink label="Back to login" onPress={() => navigation.goBack()} />
        </View>
      </View>
    </AuthSimpleLayout>
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
  footerLinks: {
    marginTop: 20,
    alignItems: 'center',
  },
  hintText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  validatingText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.primary,
    marginTop: 8,
    textAlign: 'center',
  },
});


