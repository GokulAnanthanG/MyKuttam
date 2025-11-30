import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, Pressable, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/FontAwesome';
import { RootStackParamList } from '../navigation/AppNavigator';
import { AuthSimpleLayout } from '../components/AuthSimpleLayout';
import { AppTextInput } from '../components/AppTextInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { AccountType, StoredUser, UserRole } from '../types/user';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

type FormState = {
  name: string;
  password: string;
  confirmPassword: string;
  dob?: Date;
  father_name?: string;
  address?: string;
  account_type: AccountType;
  role: UserRole;
};


export const RegistrationScreen = ({ navigation, route }: Props) => {
  const { loading, register } = useAuth();
  const { phone } = route.params;
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [form, setForm] = useState<FormState>({
    name: '',
    password: '',
    confirmPassword: '',
    dob: undefined,
    father_name: '',
    address: '',
    account_type: 'COMMON',
    role: 'USER',
  });

  const isValid = useMemo(() => {
    return (
      form.name.trim().length >= 3 &&
      form.password.trim().length >= 6 &&
      form.password === form.confirmPassword
    );
  }, [form]);

  const handleChange = (key: keyof FormState, value: string) => {
    setForm(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const formatDate = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateForAPI = (date?: Date) => {
    if (!date) return undefined;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };


  const handleSubmit = async () => {
    if (!isValid || loading) {
      return;
    }

    const user: StoredUser = {
      phone,
      name: form.name.trim(),
      password: form.password.trim(),
      account_type: form.account_type,
      role: form.role,
      dob: formatDateForAPI(form.dob),
      father_name: form.father_name ? form.father_name.trim() : undefined,
      address: form.address ? form.address.trim() : undefined,
    };

    const success = await register(user);
    if (success) {
      navigation.replace('MainTabs');
    }
  };

  return (
    <AuthSimpleLayout
      title="Complete Registration"
      subtitle={`OTP validated for ${phone}. Please fill in your details to complete your registration.`}>
      <View style={styles.form}>
        <AppTextInput
          label="Full name"
          placeholder="Your legal name"
          value={form.name}
          onChangeText={value => handleChange('name', value)}
        />
        <View style={styles.datePickerWrapper}>
          <View style={styles.labelContainer}>
            <Icon name="calendar" size={14} color={colors.textMuted} />
            <Text style={styles.label}>Date of Birth (Optional)</Text>
          </View>
          <Pressable
            style={styles.datePickerButton}
            onPress={() => setShowDatePicker(true)}>
            <Text
              style={[
                styles.datePickerText,
                !form.dob && styles.datePickerPlaceholder,
              ]}>
              {form.dob ? formatDate(form.dob) : 'Select date of birth'}
            </Text>
            <Icon name="chevron-down" size={16} color={colors.primary} />
          </Pressable>
          {showDatePicker && (
            <DateTimePicker
              value={form.dob || new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selectedDate) {
                  setForm({ ...form, dob: selectedDate });
                }
              }}
              maximumDate={new Date()}
            />
          )}
        </View>
        <AppTextInput
          label="Father's Name"
          placeholder="Enter father's name"
          value={form.father_name}
          onChangeText={value => handleChange('father_name', value)}
        />
        <AppTextInput
          label="Address"
          placeholder="Street, City, State (Optional)"
          value={form.address}
          onChangeText={value => handleChange('address', value)}
          multiline
          numberOfLines={3}
        />
        <AppTextInput
          label="Password"
          placeholder="Enter password (min 6 characters)"
          secureTextEntry
          value={form.password}
          onChangeText={value => handleChange('password', value)}
        />
        <AppTextInput
          label="Confirm Password"
          placeholder="Re-enter password"
          secureTextEntry
          value={form.confirmPassword}
          onChangeText={value => handleChange('confirmPassword', value)}
        />
        {form.password !== form.confirmPassword && form.confirmPassword.length > 0 && (
          <Text style={styles.errorText}>Passwords do not match</Text>
        )}
        <PrimaryButton
          label="Create my account"
          onPress={handleSubmit}
          loading={loading}
          disabled={!isValid || loading}
        />
      </View>
    </AuthSimpleLayout>
  );
};

const styles = StyleSheet.create({
  form: {
    gap: 8,
  },
  errorText: {
    color: colors.danger,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: -12,
    marginBottom: 8,
    marginLeft: 4,
  },
  datePickerWrapper: {
    marginBottom: 16,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  label: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: colors.card,
  },
  datePickerText: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 16,
    flex: 1,
  },
  datePickerPlaceholder: {
    color: colors.textMuted,
  },
});


