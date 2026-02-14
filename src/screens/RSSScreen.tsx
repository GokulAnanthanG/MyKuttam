import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Linking,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome';
import { XMLParser } from 'fast-xml-parser';
import Toast from 'react-native-toast-message';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

const RSS_URL = 'https://tamil.oneindia.com/rss/feeds/oneindia-tamil-fb.xml';
const SOURCE_URL = 'https://tamil.oneindia.com/';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
  category?: string;
  'media:content'?: {
    '@_url': string;
  };
}

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  } catch (error) {
    return dateString;
  }
};

const stripHtmlTags = (html: string): string => {
  return html.replace(/<[^>]*>/g, '').trim();
};

export const RSSScreen = () => {
  const [articles, setArticles] = useState<RSSItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

  const fetchRSS = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await fetch(RSS_URL);
      const text = await response.text();

      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        textNodeName: '#text',
      });

      const json = parser.parse(text);
      const items = json.rss?.channel?.item || [];

      // Ensure items is an array
      const itemsArray = Array.isArray(items) ? items : [items];
      setArticles(itemsArray);
    } catch (error) {
      console.error('RSS fetch error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load RSS feed. Please try again.',
        visibilityTime: 3000,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRSS();
  }, [fetchRSS]);

  const onRefresh = useCallback(() => {
    fetchRSS(true);
  }, [fetchRSS]);

  const toggleDescription = (guid: string) => {
    setExpandedDescriptions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(guid)) {
        newSet.delete(guid);
      } else {
        newSet.add(guid);
      }
      return newSet;
    });
  };

  const handleOpenLink = async (link: string) => {
    try {
      const canOpen = await Linking.canOpenURL(link);
      if (canOpen) {
        await Linking.openURL(link);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Cannot open this link.',
          visibilityTime: 3000,
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to open link.',
        visibilityTime: 3000,
      });
    }
  };

  const renderItem = ({ item }: { item: RSSItem }) => {
    const isExpanded = expandedDescriptions.has(item.guid);
    const description = stripHtmlTags(item.description || '');
    const shouldShowReadMore = description.length > 150;
    const showDescription = isExpanded
      ? description
      : description.substring(0, 150);

    const imageUrl = item['media:content']?.['@_url'] || 
                     (item.description?.match(/<img[^>]+src="([^"]+)"/)?.[1]);

    return (
      <TouchableOpacity
        style={styles.articleCard}
        onPress={() => handleOpenLink(item.link)}
        activeOpacity={0.9}>
        <View style={styles.articleHeader}>
          <View style={styles.articleHeaderContent}>
            <Text style={styles.articleTitle}>{item.title}</Text>
            <View style={styles.articleMeta}>
              <Text style={styles.articleDate}>{formatDate(item.pubDate)}</Text>
              {item.category && (
                <>
                  <Text style={styles.metaSeparator}>•</Text>
                  <Text style={styles.articleCategory}>{item.category}</Text>
                </>
              )}
            </View>
          </View>
        </View>

        {imageUrl && (
          <Image
            source={{ uri: imageUrl }}
            style={styles.articleImage}
            resizeMode="cover"
          />
        )}

        {description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.articleDescription}>
              {showDescription}
              {shouldShowReadMore && !isExpanded && '...'}
            </Text>
            {shouldShowReadMore && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  toggleDescription(item.guid);
                }}>
                <Text style={styles.readMoreText}>
                  {isExpanded ? 'Read less' : 'Read more'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.articleFooter}>
          <TouchableOpacity
            style={styles.sourceButton}
            onPress={(e) => {
              e.stopPropagation();
              handleOpenLink(SOURCE_URL);
            }}
            activeOpacity={0.7}>
            <Icon name="link" size={14} color={colors.primary} />
            <Text style={styles.sourceText}>{SOURCE_URL}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.openButton}
            onPress={(e) => {
              e.stopPropagation();
              handleOpenLink(item.link);
            }}
            activeOpacity={0.7}>
            <Text style={styles.openButtonText}>Read Full Article</Text>
            <Icon name="external-link" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && articles.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>News Bites</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading news...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>News Bites</Text>
      </View>

      <FlatList
        data={articles}
        keyExtractor={(item, index) => item.guid || index.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="newspaper-o" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No articles found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 28,
    color: colors.text,
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
  listContent: {
    padding: 16,
    paddingBottom: 20,
  },
  articleCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  articleHeader: {
    marginBottom: 12,
  },
  articleHeaderContent: {
    flex: 1,
  },
  articleTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    lineHeight: 24,
  },
  articleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  articleDate: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  metaSeparator: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  articleCategory: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  articleImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: colors.cardMuted,
  },
  descriptionContainer: {
    marginBottom: 12,
  },
  articleDescription: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  readMoreText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
    marginTop: 4,
  },
  articleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  sourceText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    flex: 1,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.cardMuted,
  },
  openButtonText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textMuted,
  },
});

