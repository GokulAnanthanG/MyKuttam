import { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  headerAccessory?: ReactNode;
  contentStyle?: ViewStyle;
};

export const AuthSimpleLayout = ({
  title,
  subtitle,
  children,
  headerAccessory,
  contentStyle,
}: Props) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: 40 + insets.bottom },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={true}>
            <View style={styles.header}>
              <View style={styles.titles}>
                <Text style={styles.title}>{title}</Text>
                {subtitle ? (
                  <Text style={styles.subtitle}>{subtitle}</Text>
                ) : null}
              </View>
              {headerAccessory}
            </View>
            <View style={[styles.card, contentStyle]}>{children}</View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingTop: 8,
  },
  titles: {
    flex: 1,
    paddingRight: 16,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 28,
    color: colors.text,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});

