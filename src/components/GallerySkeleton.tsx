import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  count?: number;
};

export const GallerySkeleton = ({ count = 6 }: Props) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fadeAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.easeInOut,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 1200,
          easing: Easing.easeInOut,
          useNativeDriver: true,
        }),
      ]),
    );
    fadeAnimation.start();
    return () => fadeAnimation.stop();
  }, [fadeAnim]);

  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <Animated.View
          key={index}
          style={[
            styles.skeletonItem,
            {
              opacity: fadeAnim,
            },
          ]}>
          <View style={styles.skeletonImage} />
        </Animated.View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 10,
  },
  skeletonItem: {
    width: '48%',
    aspectRatio: 1,
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  skeletonImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.cardMuted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

