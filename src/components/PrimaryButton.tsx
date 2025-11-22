import { ReactNode } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary';
  style?: ViewStyle;
};

export const PrimaryButton = ({
  label,
  onPress,
  loading,
  disabled,
  icon,
  variant = 'primary',
  style,
}: Props) => {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        variant === 'secondary' ? styles.secondary : styles.primary,
        (disabled || loading) && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#ffffff' : colors.text}
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.label,
              variant === 'primary' && styles.labelPrimary,
            ]}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginVertical: 6,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.cardMuted,
  },
  label: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 16,
    letterSpacing: 0.7,
  },
  labelPrimary: {
    color: '#ffffff',
  },
  disabled: {
    opacity: 0.6,
  },
});

