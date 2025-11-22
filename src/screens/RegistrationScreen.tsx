import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { AuthLayout } from '../components/AuthLayout';
import { AppTextInput } from '../components/AppTextInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { TextLink } from '../components/TextLink';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { AccountType, StoredUser, UserRole } from '../types/user';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

type FormState = {
  name: string;
  password: string;
  confirmPassword: string;
  dob?: string;
  father_name?: string;
  address?: string;
  account_type: AccountType;
  role: UserRole;
};

const roles: UserRole[] = ['USER', 'DONATION_MANAGER', 'HELPHER'];
const accountTypes: AccountType[] = ['COMMON', 'MANAGEMENT'];

export const RegistrationScreen = ({ navigation, route }: Props) => {
  const { loading, register } = useAuth();
  const { phone, otp } = route.params;
  const [form, setForm] = useState<FormState>({
    name: '',
    password: '',
    confirmPassword: '',
    dob: '',
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

  const handleSelect = (key: 'account_type' | 'role', value: string) => {
    setForm(prev => ({
      ...prev,
      [key]: value,
    }));
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
      dob: form.dob ? form.dob.trim() : undefined,
      father_name: form.father_name ? form.father_name.trim() : undefined,
      address: form.address ? form.address.trim() : undefined,
    };

    const success = await register(user, otp);
    if (success) {
      navigation.replace('MainTabs');
    }
  };

  return (
    <AuthLayout
      title="Complete signup"
      subtitle={`OTP ${otp} verified for ${phone}. Fill in your details to join the community.`}
      footer={
        <TextLink label="Need to edit OTP?" onPress={() => navigation.goBack()} />
      }>
      <View style={styles.form}>
        <AppTextInput
          label="Full name"
          placeholder="Your legal name"
          value={form.name}
          onChangeText={value => handleChange('name', value)}
        />
        <View style={styles.row}>
          <View style={styles.half}>
            <AppTextInput
              label="Date of birth"
              placeholder="YYYY-MM-DD"
              value={form.dob}
              onChangeText={value => handleChange('dob', value)}
            />
          </View>
          <View style={styles.half}>
            <AppTextInput
              label="Father's name"
              placeholder="Optional"
              value={form.father_name}
              onChangeText={value => handleChange('father_name', value)}
            />
          </View>
        </View>
        <AppTextInput
          label="Address"
          placeholder="Street, City, State"
          value={form.address}
          onChangeText={value => handleChange('address', value)}
        />
        <View style={styles.row}>
          <View style={styles.half}>
            <AppTextInput
              label="Password"
              placeholder="••••••••"
              secureTextEntry
              value={form.password}
              onChangeText={value => handleChange('password', value)}
            />
          </View>
          <View style={styles.half}>
            <AppTextInput
              label="Confirm password"
              placeholder="••••••••"
              secureTextEntry
              value={form.confirmPassword}
              onChangeText={value => handleChange('confirmPassword', value)}
            />
          </View>
        </View>
        <View style={styles.selectorBlock}>
          <Text style={styles.selectorLabel}>Account type</Text>
          <View style={styles.selectorRow}>
            {accountTypes.map(type => (
              <Pressable
                key={type}
                style={[
                  styles.chip,
                  form.account_type === type && styles.chipActive,
                ]}
                onPress={() => handleSelect('account_type', type)}>
                <Text
                  style={[
                    styles.chipText,
                    form.account_type === type && styles.chipTextActive,
                  ]}>
                  {type}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.selectorBlock}>
          <Text style={styles.selectorLabel}>Role</Text>
          <View style={styles.selectorRow}>
            {roles.map(role => (
              <Pressable
                key={role}
                style={[
                  styles.chipSmall,
                  form.role === role && styles.chipActive,
                ]}
                onPress={() => handleSelect('role', role)}>
                <Text
                  style={[
                    styles.chipTextSmall,
                    form.role === role && styles.chipTextActive,
                  ]}>
                  {role}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <PrimaryButton
          label="Create my account"
          onPress={handleSubmit}
          loading={loading}
          disabled={!isValid || loading}
        />
      </View>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  form: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  half: {
    flex: 1,
  },
  selectorBlock: {
    marginTop: 8,
  },
  selectorLabel: {
    fontFamily: fonts.heading,
    color: colors.text,
    marginBottom: 8,
  },
  selectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardMuted,
  },
  chipSmall: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardMuted,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDark,
  },
  chipText: {
    fontFamily: fonts.body,
    color: colors.textMuted,
  },
  chipTextSmall: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 12,
  },
  chipTextActive: {
    color: colors.text,
  },
});


