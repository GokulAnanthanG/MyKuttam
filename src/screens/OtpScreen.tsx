import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, Alert } from 'react-native';
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

    const success = await requestOtp(phone.trim());
    if (success) {
      setOtpRequested(true);
      // Reset OTP when requesting new OTP
      setOtp('');
      setValidating(false);
    }
  };

  const handleContinue = async () => {
    console.log('=== OTP Validation Button Clicked ===');
    const trimmedPhone = phone.trim();
    const trimmedOtp = otp.trim();
    console.log('Phone:', trimmedPhone);
    console.log('OTP:', trimmedOtp);
    console.log('Phone Length:', trimmedPhone.length);
    console.log('OTP Length:', trimmedOtp.length);
    console.log('OTP Requested:', otpRequested);
    console.log('Validating:', validating);
    console.log('Loading:', loading);
    console.log('Can Continue:', canContinue);
    
    // Validate phone number
    if (trimmedPhone.length === 0) {
      Alert.alert('Phone Required', 'Please enter your phone number.');
      Toast.show({
        type: 'error',
        text1: 'Phone Required',
        text2: 'Please enter your phone number.',
      });
      return;
    }

    if (trimmedPhone.length !== 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number.');
      Toast.show({
        type: 'error',
        text1: 'Invalid Phone',
        text2: 'Please enter a valid 10-digit phone number.',
      });
      return;
    }

    // Validate OTP input
    if (trimmedOtp.length === 0) {
      Alert.alert('OTP Required', 'Please enter the OTP sent to your phone.');
      Toast.show({
        type: 'error',
        text1: 'OTP Required',
        text2: 'Please enter the OTP sent to your phone.',
      });
      return;
    }

    if (!otpRequested) {
      Alert.alert('OTP Not Requested', 'Please request an OTP first.');
      Toast.show({
        type: 'error',
        text1: 'OTP Not Requested',
        text2: 'Please request an OTP first.',
      });
      return;
    }

    // Prevent multiple simultaneous calls
    if (validating || loading) {
      console.log('Already validating or loading, skipping...');
      return;
    }

    console.log('OTP Validation: Starting validation for phone:', trimmedPhone);
    console.log('OTP Validation: OTP to validate:', trimmedOtp);
    Alert.alert('Validating OTP', 'Please wait while we validate your OTP...');
    setValidating(true);
    
    try {
      console.log('OTP Validation: Calling validateOtp API with:', { phone: trimmedPhone, OTP: trimmedOtp });
      const success = await validateOtp(trimmedPhone, trimmedOtp);
      console.log('OTP Validation: API response success:', success);
      
      if (success) {
        // OTP validated successfully, navigate to registration
        console.log('OTP Validation: Success! Navigating to Register screen');
        Alert.alert('Success', 'OTP validated successfully!');
        navigation.navigate('Register', {
          phone: trimmedPhone,
        });
      } else {
        console.log('OTP Validation: Failed - error already shown by validateOtp');
        Alert.alert('Validation Failed', 'Invalid or expired OTP. Please try again.');
        // Error is already shown by validateOtp in AuthContext
      }
    } catch (error: any) {
      console.error('OTP Validation: Exception caught:', error);
      
      // Extract error message
      let errorMessage = 'Failed to validate OTP. Please try again.';
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      Alert.alert('Validation Failed', errorMessage);
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
            {/* Debug info */}
            <View style={styles.debugInfo}>
              <Text style={styles.debugText}>
                OTP Length: {otp.trim().length} | Requested: {otpRequested ? 'Yes' : 'No'} | Can Continue: {canContinue ? 'Yes' : 'No'}
              </Text>
            </View>
            <PrimaryButton
              label="Continue to registration"
              onPress={() => {
                console.log('Button pressed! Can continue:', canContinue);
                Alert.alert('Button Clicked', `Button was clicked! Can continue: ${canContinue}`);
                handleContinue();
              }}
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
  debugInfo: {
    padding: 8,
    backgroundColor: colors.cardMuted,
    borderRadius: 8,
    marginVertical: 4,
  },
  debugText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
  },
});


