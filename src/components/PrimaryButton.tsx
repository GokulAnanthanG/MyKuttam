import { ReactNode } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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
      activeOpacity={0.7}
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
          size="small"
        />
      ) : (
        <>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text
            style={[
              styles.label,
              variant === 'primary' && styles.labelPrimary,
              variant === 'secondary' && styles.labelSecondary,
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
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginVertical: 6,
    minHeight: 48,
    overflow: 'hidden',
    // Subtle shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primary: {
    backgroundColor: colors.primary,
    // No border for cleaner look
    borderWidth: 0,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.2,
  },
  secondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.08,
  },
  iconContainer: {
    marginRight: -2, // Adjust spacing when icon is present
  },
  label: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  labelPrimary: {
    color: '#ffffff',
    fontWeight: '600',
    // Subtle text shadow for readability
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  labelSecondary: {
    color: colors.text,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
    shadowOpacity: 0.03,
    elevation: 1,
  },
});

