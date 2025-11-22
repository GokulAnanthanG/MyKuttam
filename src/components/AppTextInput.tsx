import { ReactNode, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

type Props = TextInputProps & {
  label: string;
  accessory?: ReactNode;
  hint?: string;
};

export const AppTextInput = ({
  label,
  accessory,
  hint,
  secureTextEntry,
  ...rest
}: Props) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = secureTextEntry === true;

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {accessory}
      </View>
      <View style={styles.inputContainer}>
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={[styles.input, isPassword && styles.inputWithIcon]}
          secureTextEntry={isPassword && !showPassword}
          {...rest}
        />
        {isPassword && (
          <Pressable
            style={styles.eyeIcon}
            onPress={() => setShowPassword(!showPassword)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.eyeIconText}>
              {showPassword ? '👁' : '👁‍🗨'}
            </Text>
          </Pressable>
        )}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingVertical: 14,
    color: colors.text,
    fontFamily: fonts.body,
    backgroundColor: colors.card,
    fontSize: 16,
  },
  inputWithIcon: {
    paddingRight: 50,
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
  },
  eyeIconText: {
    fontSize: 18,
    color: colors.textMuted,
    fontFamily: fonts.body,
  },
  hint: {
    color: colors.textMuted,
    fontFamily: fonts.light,
    fontSize: 12,
    marginTop: 4,
  },
});

