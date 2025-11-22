import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { useAuth } from '../context/AuthContext';

export const ProfileScreen = () => {
  const { currentUser } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Profile</Text>
        {currentUser && (
          <View style={styles.userInfo}>
            <Text style={styles.name}>{currentUser.name}</Text>
            <Text style={styles.phone}>{currentUser.phone}</Text>
            <Text style={styles.role}>{currentUser.role}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 24,
    color: colors.text,
    marginBottom: 20,
  },
  userInfo: {
    alignItems: 'center',
    marginTop: 20,
  },
  name: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: colors.text,
    marginBottom: 8,
  },
  phone: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 4,
  },
  role: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.primary,
  },
});

