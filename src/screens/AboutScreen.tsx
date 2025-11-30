import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

export const AboutScreen = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Header with back button */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}>
            <Icon name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* App Name - Fancy Font */}
        <View style={styles.titleContainer}>
          <Text style={styles.appName}>My Kuttam</Text>
          <View style={styles.titleUnderline} />
        </View>

        {/* App Icon - Circular */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Image
              source={require('../../assets/AppIcon.png')}
              style={styles.appIcon}
              resizeMode="contain"
            />
          </View>
          {/* <View style={styles.iconGlow} /> */}
        </View>

        {/* Content Container with Retro Letter Design */}
        <View style={styles.contentContainer}>
          {/* Decorative Top Border */}
          <View style={styles.decorativeBorder}>
            <View style={styles.borderCorner} />
            <View style={styles.borderLine} />
            <View style={[styles.borderCorner, styles.borderCornerRight]} />
          </View>

          {/* Letter Content */}
          <View style={styles.letterContent}>
            <Text style={styles.paragraph}>
              App Kuttam is created to share important news, announcements, and useful information
              related to our village. The goal of this app is to keep our people connected, updated,
              and united wherever they are.
            </Text>

            <Text style={styles.paragraph}>
              Kuttam App also includes a transparent donation system for our village needs—such as
              temple works, school requirements, welfare programs, and community development
              activities. Anyone who wants to raise funds for a cause can contact us. We will create
              a donation category for you and assign you as the manager. You can manage expenses,
              add offline donations, and maintain clarity for the people. After the fundraising is
              completed, the collected amount will be transferred to your account within a specific
              time.
            </Text>

            <Text style={styles.paragraph}>
              The app also includes a gallery section to showcase our village's rare, valuable, and
              memorable photos. These moments help preserve our culture, heritage, and unity.
            </Text>

            <Text style={styles.paragraph}>
              This app is developed with the support of Kuttam youngsters and our village people.
              Due to limited resources and infrastructure, the app currently has only essential
              features. With the love and support of our people, we will continuously improve it.
            </Text>

            {/* Quote Section */}
            <View style={styles.quoteContainer}>
              <View style={styles.quoteMarkLeft}>
                <Text style={styles.quoteMark}>"</Text>
              </View>
              <Text style={styles.quoteText}>Unity is Strength. Together, we grow.</Text>
              <View style={styles.quoteMarkRight}>
                <Text style={styles.quoteMark}>"</Text>
              </View>
            </View>
          </View>

          {/* Decorative Bottom Border */}
          <View style={[styles.decorativeBorder, styles.decorativeBorderBottom]}>
            <View style={styles.borderCorner} />
            <View style={styles.borderLine} />
            <View style={[styles.borderCorner, styles.borderCornerRight]} />
          </View>
        </View>

        {/* Bottom Link Section */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => {
              // You can add navigation or action here
              Linking.openURL('mailto:gokulananthan230@gmail.com').catch(() => {});
            }}
            activeOpacity={0.8}>
            <Icon name="envelope" size={16} color={colors.primary} />
            <Text style={styles.contactButtonText}>Contact Us</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  titleContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  appName: {
    fontSize: 42,
    fontFamily: fonts.heading,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 2,
    textShadowColor: 'rgba(139, 111, 71, 0.3)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
    marginBottom: 8,
  },
  titleUnderline: {
    width: 120,
    height: 4,
    backgroundColor: colors.primary,
    borderRadius: 2,
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 40,
    position: 'relative',
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 4,
    borderColor: colors.primary,
    overflow: 'hidden',
  },
 
  appIcon: {
    width: 120,
    height: 120,
  },
  contentContainer: {
    marginHorizontal: 20,
    marginBottom: 30,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 2,
    borderColor: colors.primary + '20',
  },
  decorativeBorder: {
    flexDirection: 'row',
    marginBottom: 20,
    height: 3,
  },
  decorativeBorderBottom: {
    marginTop: 20,
    marginBottom: 0,
  },
  borderCorner: {
    width: 20,
    height: 20,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: colors.primary,
    borderTopLeftRadius: 4,
  },
  borderCornerRight: {
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 0,
  },
  borderLine: {
    flex: 1,
    borderTopWidth: 3,
    borderColor: colors.primary,
    marginHorizontal: 8,
  },
  letterContent: {
    paddingVertical: 10,
  },
  paragraph: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 26,
    color: colors.text,
    marginBottom: 20,
    textAlign: 'justify',
    letterSpacing: 0.3,
  },
  quoteContainer: {
    marginTop: 30,
    padding: 20,
    backgroundColor: colors.primary + '10',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    position: 'relative',
  },
  quoteMarkLeft: {
    position: 'absolute',
    top: -5,
    left: 10,
  },
  quoteMarkRight: {
    position: 'absolute',
    bottom: -5,
    right: 10,
  },
  quoteMark: {
    fontSize: 48,
    fontFamily: fonts.heading,
    color: colors.primary,
    opacity: 0.3,
    lineHeight: 48,
  },
  quoteText: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.primary,
    fontStyle: 'italic',
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
  },
  bottomSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    alignItems: 'center',
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  contactButtonText: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
});

