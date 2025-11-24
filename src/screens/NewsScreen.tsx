import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RBSheet from 'react-native-raw-bottom-sheet';
import Video from 'react-native-video';
import SoundPlayer from 'react-native-sound-player';
import Icon from 'react-native-vector-icons/FontAwesome';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import {
  NewsService,
  type News,
  type Comment,
} from '../services/news';

const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
};

const formatAudioTime = (seconds: number): string => {
  if (!seconds || Number.isNaN(seconds) || seconds < 0) {
    return '00:00';
  }
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const paddedSecs = secs < 10 ? `0${secs}` : secs;
  const paddedMins = minutes < 10 ? `0${minutes}` : minutes;
  return `${paddedMins}:${paddedSecs}`;
};

export const NewsScreen = () => {
  const { currentUser } = useAuth();
  const [highlightedNews, setHighlightedNews] = useState<News[]>([]);
  const [featuredNews, setFeaturedNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  // Comments bottom sheet
  const bottomSheetRef = useRef<any>(null);
  const [selectedNews, setSelectedNews] = useState<News | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentsPage, setCommentsPage] = useState(1);
  const [hasMoreComments, setHasMoreComments] = useState(true);

  // Read more/less state
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

  // Like state
  const [likedNews, setLikedNews] = useState<Set<string>>(new Set());
  const [likingNews, setLikingNews] = useState<Set<string>>(new Set());

  // Audio playback state
  const [currentAudioId, setCurrentAudioId] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPosition, setAudioPosition] = useState(0);
  const audioProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAudioProgressInterval = useCallback(() => {
    if (audioProgressIntervalRef.current) {
      clearInterval(audioProgressIntervalRef.current);
      audioProgressIntervalRef.current = null;
    }
  }, []);

  const resetAudioProgress = useCallback(() => {
    setAudioDuration(0);
    setAudioPosition(0);
  }, []);

  const startAudioProgressTracking = useCallback(() => {
    stopAudioProgressInterval();

    const updateProgress = async () => {
      try {
        const info = await SoundPlayer.getInfo();
        if (typeof info?.duration === 'number' && !Number.isNaN(info.duration)) {
          setAudioDuration(info.duration);
        }
        if (typeof info?.currentTime === 'number' && !Number.isNaN(info.currentTime)) {
          setAudioPosition(info.currentTime);
        }
      } catch (error) {
        console.warn('Audio progress error:', error);
      }
    };

    updateProgress();
    audioProgressIntervalRef.current = setInterval(updateProgress, 1000);
  }, [stopAudioProgressInterval]);

  // Edit/Delete modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingNews, setEditingNews] = useState<News | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editExternalUrl, setEditExternalUrl] = useState('');
  const [editIsHighlighted, setEditIsHighlighted] = useState(false);
  const [updatingNews, setUpdatingNews] = useState(false);
  const [deletingNews, setDeletingNews] = useState(false);
  const [showMenuForNews, setShowMenuForNews] = useState<string | null>(null);

  // Highlight news detail modal state
  const [showHighlightModal, setShowHighlightModal] = useState(false);
  const [selectedHighlightNews, setSelectedHighlightNews] = useState<News | null>(null);

  useEffect(() => {
    const finishedSub = SoundPlayer.addEventListener('FinishedPlaying', () => {
      stopAudioProgressInterval();
      resetAudioProgress();
      setIsAudioPlaying(false);
      setCurrentAudioId(null);
    });

    return () => {
      finishedSub.remove();
      try {
        SoundPlayer.stop();
      } catch (stopError) {
        console.warn('Failed to stop audio on cleanup:', stopError);
      }
      stopAudioProgressInterval();
      resetAudioProgress();
    };
  }, [resetAudioProgress, stopAudioProgressInterval]);

  // Check if user can edit/delete
  const canEditDelete = (news: News) => {
    if (!currentUser) return false;
    const userRole = currentUser.role;
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUB_ADMIN';
    const isHelper = userRole === 'HELPHER' && currentUser.account_type === 'MANAGEMENT';
    return isAdmin || isHelper;
  };

  // Check like status for all news items
  const checkLikeStatuses = useCallback(async (newsItems: News[]) => {
    if (!currentUser) return;
    
    try {
      const statusPromises = newsItems.map(async (news) => {
        try {
          const response = await NewsService.getLikeStatus(news.id);
          if (response.success && response.data?.isLiked) {
            return news.id;
          }
          return null;
        } catch (error) {
          console.error(`Error checking like status for news ${news.id}:`, error);
          return null;
        }
      });

      const likedIds = (await Promise.all(statusPromises)).filter((id): id is string => id !== null);
      setLikedNews((prev) => {
        const newSet = new Set(prev);
        likedIds.forEach((id) => newSet.add(id));
        return newSet;
      });
    } catch (error) {
      console.error('Error checking like statuses:', error);
    }
  }, [currentUser]);

  const fetchHighlightedNews = useCallback(async () => {
    try {
      const response = await NewsService.getHighlightedNews({
        limit: 10,
        page: 1,
        sortBy: 'created_date',
        sortOrder: 'desc',
      });
      if (response.success && response.data.news) {
        setHighlightedNews(response.data.news);
        // Check like status for highlighted news
        if (currentUser) {
          checkLikeStatuses(response.data.news);
        }
      }
    } catch (error) {
      console.error('Error fetching highlighted news:', error);
    }
  }, [currentUser, checkLikeStatuses]);

  const fetchFeaturedNews = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      try {
        if (pageNum === 1) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }

        const response = await NewsService.getNewsList({
          limit: 10,
          page: pageNum,
          sortBy: 'created_date',
          sortOrder: 'desc',
        });

        if (response.success && response.data.news) {
          if (append) {
            setFeaturedNews((prev) => [...prev, ...response.data.news!]);
            // Check like status for new items
            if (currentUser) {
              checkLikeStatuses(response.data.news);
            }
          } else {
            setFeaturedNews(response.data.news);
            // Check like status for all items
            if (currentUser) {
              checkLikeStatuses(response.data.news);
            }
          }

          const totalPages = response.data.pagination?.totalPages || 0;
          setHasMore(pageNum < totalPages);
          setPage(pageNum);
        }
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: error instanceof Error ? error.message : 'Failed to load news',
          visibilityTime: 3000,
        });
      } finally {
        if (pageNum === 1) {
          setLoading(false);
        }
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [currentUser, checkLikeStatuses],
  );

  useEffect(() => {
    fetchHighlightedNews();
    fetchFeaturedNews(1, false);
  }, [fetchHighlightedNews, fetchFeaturedNews]);

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    fetchHighlightedNews();
    fetchFeaturedNews(1, false);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchFeaturedNews(page + 1, true);
    }
  };

  const openComments = async (news: News) => {
    setSelectedNews(news);
    setComments([]);
    setCommentsPage(1);
    setHasMoreComments(true);
    // Open bottom sheet
    if (bottomSheetRef.current) {
      bottomSheetRef.current.open();
    }
    await fetchComments(news.id, 1, false);
  };

  const fetchComments = async (newsId: string, pageNum: number = 1, append: boolean = false) => {
    try {
      setLoadingComments(true);
      const response = await NewsService.getCommentsByNews(newsId, {
        page: pageNum,
        limit: 10,
      });

      if (response.success && response.data.comments) {
        if (append) {
          setComments((prev) => [...prev, ...response.data.comments!]);
        } else {
          setComments(response.data.comments);
        }

        const totalPages = response.data.pagination?.totalPages || 0;
        setHasMoreComments(pageNum < totalPages);
        setCommentsPage(pageNum);
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error instanceof Error ? error.message : 'Failed to load comments',
        visibilityTime: 3000,
      });
    } finally {
      setLoadingComments(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!selectedNews || !commentText.trim() || submittingComment) {
      return;
    }

    try {
      setSubmittingComment(true);
      const response = await NewsService.addComment(selectedNews.id, commentText.trim());

      if (response.success && response.data.id) {
        setCommentText('');
        // Refresh comments
        await fetchComments(selectedNews.id, 1, false);
        // Refresh news to update comment count
        await fetchFeaturedNews(1, false);
        await fetchHighlightedNews();
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Comment added successfully',
          visibilityTime: 2000,
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error instanceof Error ? error.message : 'Failed to add comment',
        visibilityTime: 3000,
      });
    } finally {
      setSubmittingComment(false);
    }
  };

  const toggleDescription = (newsId: string) => {
    setExpandedDescriptions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(newsId)) {
        newSet.delete(newsId);
      } else {
        newSet.add(newsId);
      }
      return newSet;
    });
  };

  const handleOpenExternalUrl = async (url: string) => {
    try {
      // Normalize URL - ensure it has a protocol
      let normalizedUrl = url.trim();
      
      // Remove any leading/trailing whitespace
      normalizedUrl = normalizedUrl.replace(/^\s+|\s+$/g, '');
      
      // If URL doesn't start with http:// or https://, add https://
      if (!normalizedUrl.match(/^https?:\/\//i)) {
        normalizedUrl = `https://${normalizedUrl}`;
      }

      // Validate URL format
      try {
        new URL(normalizedUrl);
      } catch (urlError) {
        Toast.show({
          type: 'error',
          text1: 'Invalid URL',
          text2: 'The URL format is not valid. Please check the URL.',
          visibilityTime: 3000,
        });
        return;
      }

      // Try to open the URL directly
      // canOpenURL can be unreliable on some platforms, so we try opening directly
      await Linking.openURL(normalizedUrl);
    } catch (error) {
      console.error('Error opening URL:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if it's a specific linking error
      if (errorMessage.includes('No Activity found') || errorMessage.includes('No app')) {
        Toast.show({
          type: 'error',
          text1: 'Cannot Open URL',
          text2: 'No app found to open this URL. Please check if the URL is valid.',
          visibilityTime: 3000,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: `Failed to open URL: ${errorMessage}`,
          visibilityTime: 3000,
        });
      }
    }
  };

  const stopAudioPlayback = useCallback(() => {
    try {
      SoundPlayer.stop();
    } catch (error) {
      console.warn('Audio stop error:', error);
    } finally {
      stopAudioProgressInterval();
      resetAudioProgress();
      setIsAudioPlaying(false);
      setCurrentAudioId(null);
      setAudioLoading(false);
    }
  }, [resetAudioProgress, stopAudioProgressInterval]);

  const handleAudioToggle = async (news: News) => {
    if (!news.media_src) return;

    try {
      setAudioLoading(true);
      if (currentAudioId === news.id) {
        if (isAudioPlaying) {
          SoundPlayer.pause();
          setIsAudioPlaying(false);
          stopAudioProgressInterval();
        } else {
          try {
            SoundPlayer.resume();
            setIsAudioPlaying(true);
            startAudioProgressTracking();
          } catch (resumeError) {
            console.warn('Resume failed, replaying audio:', resumeError);
            SoundPlayer.playUrl(news.media_src);
            setIsAudioPlaying(true);
            startAudioProgressTracking();
          }
        }
      } else {
        try {
          SoundPlayer.stop();
        } catch (stopError) {
          console.warn('Audio stop before play error:', stopError);
        }
        stopAudioProgressInterval();
        resetAudioProgress();
        setCurrentAudioId(news.id);
        SoundPlayer.playUrl(news.media_src);
        setIsAudioPlaying(true);
        startAudioProgressTracking();
      }
    } catch (error) {
      console.error('Audio playback error:', error);
      Toast.show({
        type: 'error',
        text1: 'Audio Playback Error',
        text2: 'Unable to play this audio file.',
        visibilityTime: 3000,
      });
      stopAudioPlayback();
    } finally {
      setAudioLoading(false);
    }
  };

  const handleMediaError = (context: string, error: unknown) => {
    console.error(context, error);
    Toast.show({
      type: 'error',
      text1: 'Media Playback Error',
      text2: context,
      visibilityTime: 3000,
    });
  };

  const getAudioStatusText = (newsId: string) => {
    const hasProgress = audioDuration > 0;
    const progressText = hasProgress
      ? `${formatAudioTime(audioPosition)} / ${formatAudioTime(audioDuration)}`
      : null;

    if (audioLoading && currentAudioId === newsId) {
      return 'Loading...';
    }
    if (currentAudioId === newsId) {
      if (isAudioPlaying) {
        return progressText ? `Playing • ${progressText}` : 'Playing...';
      }
      return progressText ? `Paused • ${progressText}` : 'Paused';
    }
    return 'Tap to play';
  };

  const handleCloseHighlightModal = useCallback(() => {
    if (selectedHighlightNews && currentAudioId === selectedHighlightNews.id) {
      stopAudioPlayback();
    }
    setShowHighlightModal(false);
    setSelectedHighlightNews(null);
  }, [currentAudioId, selectedHighlightNews, stopAudioPlayback]);

  const handleOpenHighlightComments = () => {
    if (!selectedHighlightNews) {
      return;
    }
    const news = selectedHighlightNews;
    handleCloseHighlightModal();
    setTimeout(() => {
      openComments(news);
    }, 300);
  };

  const handleEditNews = (news: News) => {
    setEditingNews(news);
    setEditTitle(news.title || '');
    setEditDescription(news.description || '');
    setEditExternalUrl(news.external_url || '');
    setEditIsHighlighted(news.is_highlighted || false);
    setShowMenuForNews(null);
    setShowEditModal(true);
  };

  const handleUpdateNews = async () => {
    if (!editingNews || updatingNews) return;

    try {
      setUpdatingNews(true);
      const updates: {
        title?: string;
        description?: string;
        external_url?: string;
        is_highlighted?: boolean;
      } = {};

      if (editTitle.trim() !== editingNews.title) {
        updates.title = editTitle.trim();
      }
      if (editDescription.trim() !== editingNews.description) {
        updates.description = editDescription.trim();
      }
      if (editExternalUrl.trim() !== editingNews.external_url) {
        updates.external_url = editExternalUrl.trim() || undefined;
      }
      if (editIsHighlighted !== editingNews.is_highlighted) {
        updates.is_highlighted = editIsHighlighted;
      }

      if (Object.keys(updates).length === 0) {
        setShowEditModal(false);
        return;
      }

      const response = await NewsService.updateNews(editingNews.id, updates);

      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'News updated successfully',
          visibilityTime: 2000,
        });
        setShowEditModal(false);
        // Refresh news
        await fetchFeaturedNews(1, false);
        await fetchHighlightedNews();
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error instanceof Error ? error.message : 'Failed to update news',
        visibilityTime: 3000,
      });
    } finally {
      setUpdatingNews(false);
    }
  };

  const handleToggleLike = async (news: News) => {
    if (!currentUser || likingNews.has(news.id)) return;

    try {
      setLikingNews((prev) => new Set(prev).add(news.id));
      const response = await NewsService.toggleLike(news.id);

      if (response.success) {
        const isLiked = response.data?.id !== undefined;
        
        // Update liked state
        setLikedNews((prev) => {
          const newSet = new Set(prev);
          if (isLiked) {
            newSet.add(news.id);
          } else {
            newSet.delete(news.id);
          }
          return newSet;
        });

        // Update like count in local state
        const updateLikeCount = (items: News[]) =>
          items.map((item) =>
            item.id === news.id
              ? { ...item, noOfLikes: isLiked ? (item.noOfLikes || 0) + 1 : Math.max(0, (item.noOfLikes || 0) - 1) }
              : item,
          );

        setFeaturedNews(updateLikeCount);
        setHighlightedNews(updateLikeCount);
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error instanceof Error ? error.message : 'Failed to toggle like',
        visibilityTime: 3000,
      });
    } finally {
      setLikingNews((prev) => {
        const newSet = new Set(prev);
        newSet.delete(news.id);
        return newSet;
      });
    }
  };

  const handleDeleteNews = (news: News) => {
    Alert.alert(
      'Delete News',
      'Are you sure you want to delete this news? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingNews(true);
              const response = await NewsService.deleteNews(news.id);

              if (response.success) {
                Toast.show({
                  type: 'success',
                  text1: 'Success',
                  text2: 'News deleted successfully',
                  visibilityTime: 2000,
                });
                setShowMenuForNews(null);
                // Refresh news
                await fetchFeaturedNews(1, false);
                await fetchHighlightedNews();
              }
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error instanceof Error ? error.message : 'Failed to delete news',
                visibilityTime: 3000,
              });
            } finally {
              setDeletingNews(false);
            }
          },
        },
      ],
    );
  };

  const renderHighlightCard = ({ item }: { item: News }) => {
    const canEdit = canEditDelete(item);

    return (
      <View style={styles.highlightCardWrapper}>
        <Pressable
          style={styles.highlightCard}
          onPress={() => {
            setSelectedHighlightNews(item);
            setShowHighlightModal(true);
          }}
          android_ripple={{ color: colors.primary + '20' }}>
          <View style={styles.highlightCardInner}>
            {/* Background image/content */}
            {item.media_type === 'IMAGE' && item.media_src ? (
              <Image source={{ uri: item.media_src }} style={styles.highlightBackgroundImage} resizeMode="cover" />
            ) : item.media_type === 'VIDEO' ? (
              <View style={[styles.highlightBackgroundImage, styles.highlightVideoPlaceholder]}>
                <Icon name="play" size={40} color="#fff" />
                <Text style={styles.highlightVideoText}>Video</Text>
              </View>
            ) : item.media_type === 'AUDIO' ? (
              <View style={[styles.highlightBackgroundImage, styles.highlightAudioPlaceholder]}>
                <Icon name="music" size={36} color="#fff" />
                <Text style={styles.highlightAudioPlaceholderText}>Audio</Text>
              </View>
            ) : (
              <View style={[styles.highlightBackgroundImage, styles.highlightImagePlaceholder]}>
                <Icon name="image" size={50} color={colors.textMuted} />
              </View>
            )}
            
            {/* Circular profile/avatar at top */}
            <View style={styles.highlightProfileContainer}>
              {item.created_by?.avatar ? (
                <Image source={{ uri: item.created_by.avatar }} style={styles.highlightProfileImage} />
              ) : item.created_by?.name ? (
                <View style={styles.highlightProfileAvatar}>
                  <Text style={styles.highlightProfileAvatarText}>
                    {item.created_by.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              ) : (
                <View style={styles.highlightProfileAvatar}>
                  <Icon name="user" size={24} color="#fff" />
                </View>
              )}
            </View>

            {canEdit && (
              <TouchableOpacity
                style={styles.highlightMenuButton}
                onPress={(e) => {
                  e.stopPropagation();
                  setShowMenuForNews(showMenuForNews === item.id ? null : item.id);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="ellipsis-v" size={16} color="#fff" />
              </TouchableOpacity>
            )}

            {/* Gradient overlay for text readability */}
            <View style={styles.highlightGradientOverlay} />
            
            {/* Title overlay at bottom */}
            <View style={styles.highlightContent}>
              <Text style={styles.highlightTitle} numberOfLines={1}>
                {item.title}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Menu Modal for highlight card */}
        {showMenuForNews === item.id && (
          <Modal
            visible={true}
            transparent
            animationType="fade"
            onRequestClose={() => setShowMenuForNews(null)}>
            <Pressable
              style={styles.menuOverlay}
              onPress={() => setShowMenuForNews(null)}>
              <View style={styles.menuContainer}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    handleEditNews(item);
                  }}>
                  <Icon name="edit" size={18} color={colors.text} />
                  <Text style={styles.menuItemText}>Edit</Text>
                </TouchableOpacity>
                <View style={styles.menuDivider} />
                <TouchableOpacity
                  style={[styles.menuItem, styles.menuItemDanger]}
                  onPress={() => {
                    handleDeleteNews(item);
                  }}>
                  <Icon name="trash" size={18} color={colors.danger} />
                  <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>
        )}
      </View>
    );
  };

  const renderFeaturedItem = ({ item }: { item: News }) => {
    const isExpanded = expandedDescriptions.has(item.id);
    const shouldShowReadMore = item.description && item.description.length > 150;
    const showDescription = item.description
      ? isExpanded
        ? item.description
        : item.description.substring(0, 150)
      : '';
    const canEdit = canEditDelete(item);

    return (
      <View style={styles.featuredCard}>
        <View style={styles.featuredHeader}>
          {item.created_by && (
            <View style={styles.avatarContainer}>
              {item.created_by.avatar ? (
                <Image source={{ uri: item.created_by.avatar }} style={styles.avatarImage} />
              ) : item.created_by.name ? (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.created_by.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              ) : (
                <Icon name="user" size={20} color={colors.textMuted} />
              )}
            </View>
          )}
          <View style={styles.featuredHeaderText}>
            <Text style={styles.featuredTitle}>{item.title}</Text>
            <Text style={styles.featuredTime}>{formatTimeAgo(item.created_date)}</Text>
          </View>
          {canEdit && (
            <TouchableOpacity
              style={styles.menuButton}
              onPress={(e) => {
                e.stopPropagation();
                setShowMenuForNews(showMenuForNews === item.id ? null : item.id);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="ellipsis-v" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {item.description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.featuredDescription}>
              {showDescription}
              {shouldShowReadMore && !isExpanded && '...'}
            </Text>
            {shouldShowReadMore && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  toggleDescription(item.id);
                }}>
                <Text style={styles.readMoreText}>
                  {isExpanded ? 'Read less' : 'Read more'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {item.media_src && item.media_type === 'IMAGE' && (
          <Image source={{ uri: item.media_src }} style={styles.featuredImage} resizeMode="cover" />
        )}

        {item.media_src && item.media_type === 'VIDEO' && (
          <View style={styles.videoContainer}>
            <Video
              source={{ uri: item.media_src }}
              style={styles.videoPlayer}
              controls
              resizeMode="contain"
              poster={item.media_src}
              onError={(error) => handleMediaError('Unable to play this video.', error)}
            />
          </View>
        )}

        {item.media_src && item.media_type === 'AUDIO' && (
          <View style={styles.audioContainer}>
            <View style={styles.audioHeader}>
              <Icon name="music" size={16} color={colors.primary} />
              <Text style={styles.audioLabel}>Audio message</Text>
            </View>
            <View style={styles.audioControls}>
              <TouchableOpacity
                style={[
                  styles.audioControlButton,
                  currentAudioId === item.id && isAudioPlaying && styles.audioControlButtonActive,
                ]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleAudioToggle(item);
                }}
                disabled={audioLoading && currentAudioId === item.id}>
                {audioLoading && currentAudioId === item.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Icon
                    name={currentAudioId === item.id && isAudioPlaying ? 'pause' : 'play'}
                    size={14}
                    color="#fff"
                  />
                )}
              </TouchableOpacity>
              <Text style={styles.audioStatusText}>{getAudioStatusText(item.id)}</Text>
            </View>
          </View>
        )}

        {item.external_url && (
          <TouchableOpacity
            style={styles.externalLinkButton}
            onPress={(e) => {
              e.stopPropagation();
              handleOpenExternalUrl(item.external_url!);
            }}>
            <Icon name="external-link" size={16} color={colors.primary} />
            <Text style={styles.externalLinkText}>View</Text>
          </TouchableOpacity>
        )}

        <View style={styles.featuredActions}>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={(e) => {
              e.stopPropagation();
              handleToggleLike(item);
            }}
            disabled={likingNews.has(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            {likingNews.has(item.id) ? (
              <ActivityIndicator size={16} color={colors.primary} />
            ) : (
              <Icon
                name={likedNews.has(item.id) ? 'heart' : 'heart-o'}
                size={16}
                color={likedNews.has(item.id) ? colors.danger : colors.textMuted}
              />
            )}
            <Text
              style={[
                styles.actionText,
                likedNews.has(item.id) && styles.actionTextLiked,
              ]}>
              {item.noOfLikes || 0}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => openComments(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="comment" size={16} color={colors.textMuted} />
            <Text style={styles.actionText}>{item.noOfComments || 0}</Text>
          </TouchableOpacity>
          <View style={styles.actionItem}>
            <Icon name="share" size={16} color={colors.textMuted} />
            <Text style={styles.actionText}>0</Text>
          </View>
        </View>

        {/* Menu Modal */}
        {showMenuForNews === item.id && (
          <Modal
            visible={true}
            transparent
            animationType="fade"
            onRequestClose={() => setShowMenuForNews(null)}>
            <Pressable
              style={styles.menuOverlay}
              onPress={() => setShowMenuForNews(null)}>
              <View style={styles.menuContainer}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    handleEditNews(item);
                  }}>
                  <Icon name="edit" size={18} color={colors.text} />
                  <Text style={styles.menuItemText}>Edit</Text>
                </TouchableOpacity>
                <View style={styles.menuDivider} />
                <TouchableOpacity
                  style={[styles.menuItem, styles.menuItemDanger]}
                  onPress={() => {
                    handleDeleteNews(item);
                  }}>
                  <Icon name="trash" size={18} color={colors.danger} />
                  <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>
        )}
      </View>
    );
  };

  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.commentItem}>
      <View style={styles.commentHeader}>
        {item.user_id.avatar ? (
          <Image source={{ uri: item.user_id.avatar }} style={styles.commentAvatar} />
        ) : (
          <View style={styles.commentAvatar}>
            <Text style={styles.commentAvatarText}>
              {item.user_id.name?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
        )}
        <View style={styles.commentContent}>
          <Text style={styles.commentAuthor}>{item.user_id.name || 'Anonymous'}</Text>
          <Text style={styles.commentText}>{item.comment}</Text>
          <Text style={styles.commentTime}>{formatTimeAgo(item.createdAt)}</Text>
        </View>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  if (loading && featuredNews.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={featuredNews}
        keyExtractor={(item) => item.id}
        renderItem={renderFeaturedItem}
        ListHeaderComponent={
          <View>
            {highlightedNews.length > 0 && (
              <View style={styles.highlightsSection}>
                <Text style={styles.sectionTitle}>Highlights</Text>
                <FlatList
                  data={highlightedNews}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item) => item.id}
                  renderItem={renderHighlightCard}
                  contentContainerStyle={styles.highlightsList}
                />
              </View>
            )}
            <View style={styles.featuredSection}>
              <Text style={styles.sectionTitle}>Featured</Text>
            </View>
          </View>
        }
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.listContent}
      />

      <RBSheet
        ref={bottomSheetRef}
        height={600}
        openDuration={250}
        customStyles={{
          container: {
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            backgroundColor: colors.card,
          },
          wrapper: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          },
        }}
        onClose={() => setSelectedNews(null)}>
        <View style={styles.bottomSheetContent}>
          <View style={styles.bottomSheetHeader}>
            <Text style={styles.bottomSheetTitle}>
              Comments ({selectedNews?.noOfComments || 0})
            </Text>
          </View>

          {loadingComments && comments.length === 0 ? (
            <View style={styles.commentsLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item: Comment) => item.id}
              renderItem={renderComment}
              contentContainerStyle={styles.commentsList}
              style={styles.commentsFlatList}
              onEndReached={() => {
                if (!loadingComments && hasMoreComments && selectedNews) {
                  fetchComments(selectedNews.id, commentsPage + 1, true);
                }
              }}
              ListFooterComponent={
                loadingComments && comments.length > 0 ? (
                  <View style={styles.commentsLoading}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyComments}>
                  <Text style={styles.emptyCommentsText}>No comments yet</Text>
                  <Text style={styles.emptyCommentsSubtext}>Be the first to comment!</Text>
                </View>
              }
            />
          )}

          <View style={styles.commentInputContainer}>
            <View style={styles.commentInputWrapper}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor={colors.textMuted}
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!commentText.trim() || submittingComment) && styles.sendButtonDisabled,
                ]}
                onPress={handleSubmitComment}
                disabled={!commentText.trim() || submittingComment}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                {submittingComment ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Icon name="send" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </RBSheet>

      {/* Edit News Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowEditModal(false);
          setEditingNews(null);
          setEditTitle('');
          setEditDescription('');
          setEditExternalUrl('');
          setEditIsHighlighted(false);
        }}>
        <View style={styles.editModalOverlay}>
          <View style={styles.editModalContainer}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit News</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowEditModal(false);
                  setEditingNews(null);
                  setEditTitle('');
                  setEditDescription('');
                  setEditExternalUrl('');
                  setEditIsHighlighted(false);
                }}>
                <Icon name="times" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.editModalContent}>
              <View style={styles.editFormGroup}>
                <Text style={styles.editLabel}>Title</Text>
                <TextInput
                  style={[styles.editTextInput, styles.editTitleInput]}
                  placeholder="Enter title..."
                  placeholderTextColor={colors.textMuted}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  maxLength={200}
                />
              </View>

              <View style={styles.editFormGroup}>
                <Text style={styles.editLabel}>Description</Text>
                <TextInput
                  style={styles.editTextInput}
                  placeholder="Enter description..."
                  placeholderTextColor={colors.textMuted}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.editFormGroup}>
                <Text style={styles.editLabel}>External URL (Optional)</Text>
                <TextInput
                  style={[styles.editTextInput, styles.editTitleInput]}
                  placeholder="https://example.com"
                  placeholderTextColor={colors.textMuted}
                  value={editExternalUrl}
                  onChangeText={setEditExternalUrl}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.editFormGroup}>
                <View style={styles.switchContainer}>
                  <Text style={styles.editLabel}>Highlighted News</Text>
                  <Switch
                    value={editIsHighlighted}
                    onValueChange={setEditIsHighlighted}
                    trackColor={{ false: colors.border, true: colors.primary + '80' }}
                    thumbColor={editIsHighlighted ? colors.primary : colors.textMuted}
                  />
                </View>
                <Text style={styles.switchDescription}>
                  Highlighted news will appear in the highlights section at the top
                </Text>
              </View>
            </ScrollView>

            <View style={styles.editModalFooter}>
              <TouchableOpacity
                style={[styles.editButton, styles.editButtonCancel]}
                onPress={() => {
                  setShowEditModal(false);
                  setEditingNews(null);
                  setEditTitle('');
                  setEditDescription('');
                  setEditExternalUrl('');
                  setEditIsHighlighted(false);
                }}>
                <Text style={styles.editButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editButton, styles.editButtonSave]}
                onPress={handleUpdateNews}
                disabled={updatingNews}>
                {updatingNews ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.editButtonSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Highlight News Detail Modal */}
      <Modal
        visible={showHighlightModal}
        transparent
        animationType="slide"
        onRequestClose={handleCloseHighlightModal}>
        <View style={styles.highlightModalOverlay}>
          <View style={styles.highlightModalContainer}>
            <View style={styles.highlightModalHeader}>
              <Text style={styles.highlightModalTitle} numberOfLines={2}>
                {selectedHighlightNews?.title}
              </Text>
              <TouchableOpacity
                onPress={handleCloseHighlightModal}>
                <Icon name="times" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.highlightModalContent}>
              {selectedHighlightNews?.media_src && selectedHighlightNews.media_type === 'IMAGE' && (
                <Image
                  source={{ uri: selectedHighlightNews.media_src }}
                  style={styles.highlightModalImage}
                  resizeMode="cover"
                />
              )}

              {selectedHighlightNews?.media_src && selectedHighlightNews.media_type === 'VIDEO' && (
                <View style={styles.modalVideoContainer}>
                  <Video
                    source={{ uri: selectedHighlightNews.media_src }}
                    style={styles.modalVideoPlayer}
                    controls
                    resizeMode="contain"
                    onError={(error) => handleMediaError('Unable to play this highlight video.', error)}
                  />
                </View>
              )}

              {selectedHighlightNews?.media_src && selectedHighlightNews.media_type === 'AUDIO' && (
                <View style={styles.modalAudioContainer}>
                  <View style={styles.audioHeader}>
                    <Icon name="music" size={18} color={colors.primary} />
                    <Text style={styles.audioLabel}>Audio message</Text>
                  </View>
                  <View style={styles.audioControls}>
                    <TouchableOpacity
                      style={[
                        styles.audioControlButton,
                        currentAudioId === selectedHighlightNews.id &&
                          isAudioPlaying &&
                          styles.audioControlButtonActive,
                      ]}
                      onPress={() => {
                        if (selectedHighlightNews) {
                          handleAudioToggle(selectedHighlightNews);
                        }
                      }}
                      disabled={audioLoading && currentAudioId === selectedHighlightNews.id}>
                      {audioLoading && currentAudioId === selectedHighlightNews.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Icon
                          name={
                            currentAudioId === selectedHighlightNews.id && isAudioPlaying ? 'pause' : 'play'
                          }
                          size={14}
                          color="#fff"
                        />
                      )}
                    </TouchableOpacity>
                    <Text style={styles.audioStatusText}>
                      {getAudioStatusText(selectedHighlightNews.id)}
                    </Text>
                  </View>
                </View>
              )}

              {selectedHighlightNews?.description && (
                <View style={styles.highlightModalDescription}>
                  <Text style={styles.highlightModalDescriptionText}>
                    {selectedHighlightNews.description}
                  </Text>
                </View>
              )}

              {selectedHighlightNews?.external_url && (
                <TouchableOpacity
                  style={styles.highlightModalLinkButton}
                  onPress={() => {
                    handleOpenExternalUrl(selectedHighlightNews.external_url!);
                  }}>
                  <Icon name="external-link" size={20} color={colors.primary} />
                  <Text style={styles.highlightModalLinkText}>Open Link</Text>
                </TouchableOpacity>
              )}

              {selectedHighlightNews && (
                <TouchableOpacity
                  style={styles.highlightModalCommentsButton}
                  onPress={handleOpenHighlightComments}>
                  <Icon name="comment" size={18} color={colors.primary} />
                  <Text style={styles.highlightModalCommentsText}>View comments</Text>
                </TouchableOpacity>
              )}

              <View style={styles.highlightModalFooter}>
                <Text style={styles.highlightModalTime}>
                  {selectedHighlightNews && formatTimeAgo(selectedHighlightNews.created_date)}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 20,
  },
  highlightsSection: {
    marginTop: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  highlightsList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  highlightCardWrapper: {
    position: 'relative',
  },
  highlightCard: {
    width: 120,
    height: 200,
    marginRight: 12,
  },
  highlightCardInner: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  highlightBackgroundImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  highlightImagePlaceholder: {
    backgroundColor: colors.cardMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlightVideoPlaceholder: {
    backgroundColor: '#1f1f1f',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  highlightVideoText: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: '#fff',
    letterSpacing: 0.5,
  },
  highlightAudioPlaceholder: {
    backgroundColor: '#0f3d4c',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  highlightAudioPlaceholderText: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: '#fff',
    letterSpacing: 0.5,
  },
  highlightProfileContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 2,
  },
  highlightProfileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: '#25D366', // WhatsApp green color
  },
  highlightProfileAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: '#25D366', // WhatsApp green color
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlightProfileAvatarText: {
    fontFamily: fonts.heading,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  highlightMenuButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  highlightGradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  highlightContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingBottom: 12,
    paddingTop: 30,
  },
  highlightTitle: {
    fontFamily: fonts.heading,
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'left',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  featuredSection: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  featuredCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  featuredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: fonts.heading,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  featuredHeaderText: {
    flex: 1,
  },
  featuredTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  featuredTime: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  featuredDescription: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginBottom: 12,
  },
  featuredImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: colors.cardMuted,
  },
  videoContainer: {
    width: '100%',
    height: 220,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#000',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  audioContainer: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: colors.cardMuted,
  },
  audioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  audioLabel: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.text,
  },
  audioControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  audioControlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioControlButtonActive: {
    backgroundColor: colors.danger,
  },
  audioStatusText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  featuredActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
  actionTextLiked: {
    color: colors.danger,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  // Bottom Sheet Styles
  bottomSheetContent: {
    flex: 1,
  },
  bottomSheetHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bottomSheetTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  commentsList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  commentsFlatList: {
    flex: 1,
  },
  commentsLoading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  commentItem: {
    marginBottom: 16,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  commentAvatarText: {
    fontFamily: fonts.heading,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  commentContent: {
    flex: 1,
  },
  commentAuthor: {
    fontFamily: fonts.heading,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  commentText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginBottom: 4,
  },
  commentTime: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyComments: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyCommentsText: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.text,
    marginBottom: 4,
  },
  emptyCommentsSubtext: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
  commentInputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  commentInputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  commentInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  // Avatar Image
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  // Menu Button
  menuButton: {
    padding: 8,
  },
  // Description Container
  descriptionContainer: {
    marginBottom: 12,
  },
  readMoreText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  // External Link
  externalLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.primary + '10',
    borderRadius: 8,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  externalLinkText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  // Menu Modal
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  menuItemDanger: {
    // Additional styling if needed
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  menuItemText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  menuItemTextDanger: {
    color: colors.danger,
  },
  // Edit Modal
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  editModalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  editModalTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  editModalContent: {
    padding: 16,
  },
  editFormGroup: {
    marginBottom: 20,
  },
  editLabel: {
    fontFamily: fonts.heading,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  editTextInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 100,
  },
  editTitleInput: {
    minHeight: 50,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  switchDescription: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  editModalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  editButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonCancel: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editButtonSave: {
    backgroundColor: colors.primary,
  },
  editButtonCancelText: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.text,
  },
  editButtonSaveText: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: '#fff',
  },
  // Highlight News Detail Modal
  highlightModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  highlightModalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  highlightModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  highlightModalTitle: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginRight: 12,
  },
  highlightModalContent: {
    padding: 16,
  },
  highlightModalImage: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: colors.cardMuted,
  },
  modalVideoContainer: {
    width: '100%',
    height: 260,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#000',
  },
  modalVideoPlayer: {
    width: '100%',
    height: '100%',
  },
  modalAudioContainer: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    backgroundColor: colors.cardMuted,
  },
  highlightModalDescription: {
    marginBottom: 16,
  },
  highlightModalDescriptionText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
  },
  highlightModalLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: colors.primary,
    borderRadius: 12,
    marginBottom: 16,
  },
  highlightModalLinkText: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  highlightModalCommentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + '40',
    marginBottom: 16,
    backgroundColor: colors.primary + '10',
  },
  highlightModalCommentsText: {
    fontFamily: fonts.heading,
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },
  highlightModalFooter: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  highlightModalTime: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

