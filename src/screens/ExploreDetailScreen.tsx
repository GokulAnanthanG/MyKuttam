import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MoreStackParamList } from '../navigation/MoreNavigator';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { normalizeImageUrl } from '../utils/imageLoader';
import FastImage from 'react-native-fast-image';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const WIKIPEDIA_SUMMARY_URL = 'https://ta.wikipedia.org/api/rest_v1/page/summary';
const WIKIPEDIA_PAGE_URL = 'https://ta.wikipedia.org/wiki';

interface ArticleData {
  type: string;
  title: string;
  displaytitle?: string;
  description?: string;
  extract: string;
  extract_html?: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  originalimage?: {
    source: string;
    width: number;
    height: number;
  };
  content_urls?: {
    desktop: {
      page: string;
      revisions?: string;
      edit?: string;
      talk?: string;
    };
    mobile: {
      page: string;
      revisions?: string;
      edit?: string;
      talk?: string;
    };
  };
  pageid?: number;
  lang?: string;
  dir?: string;
}

type ExploreDetailRouteProp = RouteProp<MoreStackParamList, 'ExploreDetail'>;
type ExploreDetailNavigationProp = NativeStackNavigationProp<MoreStackParamList, 'ExploreDetail'>;

export const ExploreDetailScreen = () => {
  const navigation = useNavigation<ExploreDetailNavigationProp>();
  const route = useRoute<ExploreDetailRouteProp>();
  const { title } = route.params;

  const [article, setArticle] = useState<ArticleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchArticle();
  }, [title]);

  const fetchArticle = async () => {
    try {
      setLoading(true);
      setError(null);

      const encodedTitle = encodeURIComponent(title);
      const url = `${WIKIPEDIA_SUMMARY_URL}/${encodedTitle}`;

      console.log('📄 Wikipedia Summary API URL:', url);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ReactNativeApp/1.0',
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch article: ${response.status}`);
      }

      // Get response text first to check if it's JSON
      const responseText = await response.text();
      
      // Check if response is valid JSON
      if (!responseText.trim().startsWith('{') && !responseText.trim().startsWith('[')) {
        throw new Error('Invalid response format from Wikipedia API');
      }

      const data: ArticleData = JSON.parse(responseText);
      console.log('📄 Article Detail Image URLs:', {
        title: data.title,
        thumbnail: data.thumbnail,
        originalimage: data.originalimage,
        thumbnailUrl: data.thumbnail?.source,
        originalimageUrl: data.originalimage?.source,
      });
      setArticle(data);
    } catch (err) {
      console.error('Article fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load article');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInBrowser = async () => {
    if (!article) return;

    const pageUrl = article.content_urls?.desktop?.page || article.content_urls?.mobile?.page;
    if (pageUrl) {
      try {
        await Linking.openURL(pageUrl);
      } catch (err) {
        console.error('Failed to open URL:', err);
      }
    } else {
      // Fallback to constructing URL
      const encodedTitle = encodeURIComponent(title);
      const url = `${WIKIPEDIA_PAGE_URL}/${encodedTitle}`;
      try {
        await Linking.openURL(url);
      } catch (err) {
        console.error('Failed to open URL:', err);
      }
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}>
            <Icon name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading article...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !article) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}>
            <Icon name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Icon name="exclamation-circle" size={48} color={colors.danger} />
          <Text style={styles.errorTitle}>Failed to load article</Text>
          <Text style={styles.errorText}>{error || 'Unknown error'}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchArticle}
            activeOpacity={0.7}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <Icon name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {article.title || title}
        </Text>
        <TouchableOpacity
          style={styles.externalButton}
          onPress={handleOpenInBrowser}
          activeOpacity={0.7}>
          <Icon name="external-link" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {(article.thumbnail || article.originalimage) && (() => {
          const thumbnailSource = article.thumbnail?.source;
          const originalSource = article.originalimage?.source;
          const imageUrl = normalizeImageUrl(thumbnailSource || originalSource);

          console.log('🖼️ Detail View Image:', {
            title: article.title,
            thumbnailSource: thumbnailSource,
            originalSource: originalSource,
            processedUrl: imageUrl,
            willRender: !!imageUrl,
          });

          return imageUrl ? (
            <FastImage
              source={{
                uri: imageUrl,
                headers: {
                  'User-Agent': 'ReactNativeApp/1.0',
                  'Accept': 'image/*',
                },
                priority: FastImage.priority.high,
              }}
              style={styles.thumbnail}
              resizeMode={FastImage.resizeMode.cover}
              onError={() => {
                console.error('❌ Image load error:', {
                  thumbnailUrl: article.thumbnail?.source,
                  originalimageUrl: article.originalimage?.source,
                  usedUrl: imageUrl,
                });
              }}
              onLoad={() => {
                console.log('✅ Image loaded successfully:', {
                  url: imageUrl,
                  isThumbnail: !!article.thumbnail?.source,
                  isOriginalImage: !!article.originalimage?.source,
                  thumbnail: article.thumbnail,
                  originalimage: article.originalimage,
                });
              }}
            />
          ) : null;
        })()}

        {article.description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.description}>{article.description}</Text>
          </View>
        )}

        <View style={styles.contentContainer}>
          <Text style={styles.content}>{article.extract}</Text>
        </View>

        <TouchableOpacity
          style={styles.readMoreButton}
          onPress={handleOpenInBrowser}
          activeOpacity={0.7}>
          <Icon name="external-link" size={16} color={colors.primary} />
          <Text style={styles.readMoreText}>Read full article on Wikipedia</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  headerSpacer: {
    width: 36,
  },
  externalButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  thumbnail: {
    width: SCREEN_WIDTH,
    height: 200,
    backgroundColor: colors.cardMuted,
  },
  descriptionContainer: {
    padding: 20,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textMuted,
    fontStyle: 'italic',
    lineHeight: 24,
  },
  contentContainer: {
    padding: 20,
  },
  content: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    lineHeight: 26,
  },
  readMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 8,
  },
  readMoreText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  errorTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  retryButtonText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
});

