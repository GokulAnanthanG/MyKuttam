import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Keyboard,
  Dimensions,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MoreStackParamList } from '../navigation/MoreNavigator';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { normalizeImageUrl } from '../utils/imageLoader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const WIKIPEDIA_SEARCH_URL = 'https://api.wikimedia.org/core/v1/wikipedia/ta/search/page';
const WIKIPEDIA_SUMMARY_URL = 'https://ta.wikipedia.org/api/rest_v1/page/summary';

interface Thumbnail {
  mimetype: string;
  width: number;
  height: number;
  url: string;
}

interface SearchResult {
  id: number;
  key: string;
  title: string;
  excerpt: string;
  description?: string;
  thumbnail?: Thumbnail;
  matched_title?: string | null;
  anchor?: string | null;
}

interface SearchResponse {
  pages: SearchResult[];
}

type ExploreScreenNavigationProp = NativeStackNavigationProp<MoreStackParamList, 'Explore'>;

const stripHtmlTags = (html: string): string => {
  return html.replace(/<[^>]+>/g, '').trim();
};

export const ExploreScreen = () => {
  const navigation = useNavigation<ExploreScreenNavigationProp>();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalHits, setTotalHits] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback(
    async (query: string, limit: number = 20, append: boolean = false) => {
      if (!query.trim()) {
        setResults([]);
        setTotalHits(0);
        setHasSearched(false);
        return;
      }

      try {
        if (!append) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }

        const encodedQuery = encodeURIComponent(query);
        const url = `${WIKIPEDIA_SEARCH_URL}?q=${encodedQuery}&limit=${limit}`;

        console.log('🔍 Wikipedia Search API URL:', url);

        const response = await fetch(url, {
          headers: {
            'User-Agent': 'ReactNativeApp/1.0',
          },
        });
        
        // Check if response is OK
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Get response text first to check if it's JSON
        const responseText = await response.text();
        
        // Check if response starts with valid JSON (not HTML error page)
        if (!responseText.trim().startsWith('{') && !responseText.trim().startsWith('[')) {
          throw new Error('Invalid response format from Wikipedia API');
        }

        const data: SearchResponse = JSON.parse(responseText);

        if (data.pages && Array.isArray(data.pages)) {
          const searchResults = data.pages;
          const total = searchResults.length;

          if (append) {
            setResults((prev) => [...prev, ...searchResults]);
          } else {
            setResults(searchResults);
          }

          setTotalHits(total);
          setHasSearched(true);
          setOffset(searchResults.length);
          // Assume we have more if we got the full limit
          setHasMore(searchResults.length === limit);
        } else {
          // No results
          if (!append) {
            setResults([]);
            setTotalHits(0);
          }
          setHasSearched(true);
          setHasMore(false);
        }
      } catch (error) {
        console.error('Search error:', error);
        // Show error to user
        if (!append) {
          setResults([]);
          setTotalHits(0);
          setHasSearched(true);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  const handleSearch = useCallback(
    (text: string) => {
      setSearchQuery(text);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      if (text.trim()) {
        searchTimeoutRef.current = setTimeout(() => {
          performSearch(text, 20, false);
        }, 500);
      } else {
        setResults([]);
        setTotalHits(0);
        setHasSearched(false);
      }
    },
    [performSearch]
  );

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && searchQuery.trim()) {
      // Load more with current offset
      performSearch(searchQuery, 20, true);
    }
  }, [loadingMore, hasMore, searchQuery, performSearch]);

  const handleResultPress = useCallback(
    (key: string, title: string) => {
      // Use key for better URL encoding, fallback to title
      navigation.navigate('ExploreDetail', { title: key || title });
    },
    [navigation]
  );

  const renderResultItem = useCallback(
    ({ item }: { item: SearchResult }) => {
      const cleanExcerpt = stripHtmlTags(item.excerpt);
      const thumbnailUrl = normalizeImageUrl(item.thumbnail?.url);

      console.log('🖼️ Search Result Image:', {
        title: item.title,
        originalUrl: item.thumbnail?.url,
        processedUrl: thumbnailUrl,
        thumbnail: item.thumbnail,
        hasThumbnail: !!item.thumbnail,
      });

      return (
        <TouchableOpacity
          style={styles.resultCard}
          onPress={() => handleResultPress(item.key, item.title)}
          activeOpacity={0.7}>
          <View style={styles.resultContent}>
            {thumbnailUrl ? (
              <FastImage
                source={{
                  uri: thumbnailUrl,
                  headers: {
                    'User-Agent': 'ReactNativeApp/1.0',
                    'Accept': 'image/*',
                  },
                  priority: FastImage.priority.normal,
                }}
                style={styles.resultThumbnail}
                resizeMode={FastImage.resizeMode.cover}
                onError={() => {
                  console.error('❌ Search Result Image Error:', {
                    title: item.title,
                    thumbnailUrl: thumbnailUrl,
                    originalUrl: item.thumbnail?.url,
                  });
                }}
                onLoad={() => {
                  console.log('✅ Search Result Image Loaded:', {
                    title: item.title,
                    thumbnailUrl: thumbnailUrl,
                    originalUrl: item.thumbnail?.url,
                    dimensions: item.thumbnail?.width + 'x' + item.thumbnail?.height,
                  });
                }}
              />
            ) : (
              <View style={styles.resultThumbnailPlaceholder}>
                <Icon name="image" size={24} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.resultTextContainer}>
              <View style={styles.resultHeader}>
                <Icon name="file-text-o" size={18} color={colors.primary} />
                <Text style={styles.resultTitle} numberOfLines={2}>
                  {item.title}
                </Text>
              </View>
              {item.description && (
                <Text style={styles.resultDescription} numberOfLines={1}>
                  {item.description}
                </Text>
              )}
              {cleanExcerpt && (
                <Text style={styles.resultSnippet} numberOfLines={2}>
                  {cleanExcerpt}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.resultFooter}>
            <Icon name="chevron-right" size={14} color={colors.textMuted} />
          </View>
        </TouchableOpacity>
      );
    },
    [handleResultPress]
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    if (!hasSearched) {
      return (
        <View style={styles.emptyContainer}>
          <Icon name="search" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Search Tamil Wikipedia</Text>
          <Text style={styles.emptyText}>
            Type in Tamil to search for articles
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Icon name="file-text-o" size={64} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No results found</Text>
        <Text style={styles.emptyText}>
          Try a different search term
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Explore</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Icon name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Tamil Wikipedia..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => {
              Keyboard.dismiss();
              if (searchQuery.trim()) {
                performSearch(searchQuery, 20, false);
              }
            }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                setSearchQuery('');
                setResults([]);
                setTotalHits(0);
                setHasSearched(false);
                Keyboard.dismiss();
              }}
              activeOpacity={0.7}>
              <Icon name="times-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {hasSearched && totalHits > 0 && (
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            {totalHits.toLocaleString()} results found
          </Text>
        </View>
      )}

      {loading && results.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderResultItem}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          keyboardShouldPersistTaps="handled"
        />
      )}
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
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  resultsHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultsCount: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: 20,
  },
  resultCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultContent: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  resultThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.cardMuted,
    marginRight: 12,
    minWidth: 80,
    minHeight: 80,
  },
  resultThumbnailPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.cardMuted,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultTextContainer: {
    flex: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 10,
  },
  resultTitle: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 22,
  },
  resultDescription: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
    marginBottom: 6,
  },
  resultSnippet: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  resultFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

