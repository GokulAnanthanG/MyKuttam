import { GestureResponderEvent, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

type Props = {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
};

export const TextLink = ({ label, onPress }: Props) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
    <Text style={styles.text}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  text: {
    fontFamily: fonts.heading,
    color: colors.primary,
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 8,
  },
});

