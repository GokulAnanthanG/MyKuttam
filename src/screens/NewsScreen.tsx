import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
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
import {
  launchImageLibrary,
  launchCamera,
  type ImagePickerResponse,
  type MediaType as PickerMediaType,
} from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';
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
import { BASE_URL } from '../config/api';

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
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  
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

  // Video reveal state to lazy load players
  const [revealedVideos, setRevealedVideos] = useState<Set<string>>(new Set());

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

  // Create news modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createMediaType, setCreateMediaType] = useState<'IMAGE' | 'VIDEO' | 'AUDIO'>('IMAGE');
  const [createIsHighlighted, setCreateIsHighlighted] = useState(false);
  const [createExternalUrl, setCreateExternalUrl] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<{ uri: string; type: string; name: string; fileSize?: number } | null>(null);
  const [creatingNews, setCreatingNews] = useState(false);

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

  // Deep link handling - open news when deep link is clicked
  useEffect(() => {
    // Handle deep link when app is already open
    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      // Parse deep link: mykuttam://news/:id
      const deepLinkMatch = url.match(/mykuttam:\/\/news\/(.+)/);
      if (deepLinkMatch && deepLinkMatch[1]) {
        const newsId = deepLinkMatch[1];
        // Find the news item and open it
        const news = [...highlightedNews, ...featuredNews].find((n) => n.id === newsId);
        if (news) {
          setSelectedHighlightNews(news);
          setShowHighlightModal(true);
        } else {
          // If news not loaded yet, fetch it
          fetchNewsById(newsId);
        }
        return;
      }

      // Parse web URL: https://domain.com/news/:id
      const webUrlMatch = url.match(/https?:\/\/[^\/]+\/news\/(.+)/);
      if (webUrlMatch && webUrlMatch[1]) {
        const newsId = webUrlMatch[1];
        // Find the news item and open it
        const news = [...highlightedNews, ...featuredNews].find((n) => n.id === newsId);
        if (news) {
          setSelectedHighlightNews(news);
          setShowHighlightModal(true);
        } else {
          // If news not loaded yet, fetch it
          fetchNewsById(newsId);
        }
      }
    };

    // Handle deep link when app opens from closed state
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    // Listen for deep links when app is open
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, [highlightedNews, featuredNews]);

  const fetchNewsById = async (newsId: string) => {
    try {
      const response = await NewsService.getNewsById(newsId);
      if (response.success && response.data) {
        // Check if data is a News object (has id property)
        const newsData = response.data as any;
        if (newsData.id) {
          setSelectedHighlightNews(newsData as News);
          setShowHighlightModal(true);
        } else {
          Toast.show({
            type: 'error',
            text1: 'News not found',
            text2: 'The news item you are trying to view does not exist.',
          });
        }
      } else {
        Toast.show({
          type: 'error',
          text1: 'News not found',
          text2: 'The news item you are trying to view does not exist.',
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load news item.',
      });
    }
  };

  // Check if user can edit/delete
  const canEditDelete = (news: News) => {
    if (!currentUser) return false;
    const userRole = currentUser.role;
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUB_ADMIN';
    const isHelper = userRole === 'HELPHER' && currentUser.account_type === 'MANAGEMENT';
    return isAdmin || isHelper;
  };

  // Check if user can create news
  const canCreateNews = () => {
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
      if (response.success) {
        // Check if data exists and has news array
        if (response.data && response.data.news && Array.isArray(response.data.news)) {
          setHighlightedNews(response.data.news);
          // Check like status for highlighted news
          if (currentUser) {
            checkLikeStatuses(response.data.news);
          }
        } else {
          // Backend returned success but no news data
          console.warn('No news data in highlighted response:', response);
          setHighlightedNews([]);
        }
      } else {
        // Handle case where response is not successful
        console.warn('Failed to fetch highlighted news:', response.message);
        setHighlightedNews([]);
      }
    } catch (error) {
      console.error('Error fetching highlighted news:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load highlighted news';
      Toast.show({
        type: 'error',
        text1: 'Error fetching news',
        text2: errorMessage,
        visibilityTime: 3000,
      });
      setHighlightedNews([]);
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

        if (response.success) {
          // Check if data exists and has news array
          if (response.data && response.data.news && Array.isArray(response.data.news)) {
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
          } else {
            // Backend returned success but no news data (empty or different format)
            if (!append) {
              setFeaturedNews([]);
            }
            setHasMore(false);
            // Don't show error if it's just empty data
            if (pageNum === 1 && response.data && !response.data.news) {
              console.log('No news data in response:', response);
            }
          }
        } else {
          // Handle case where response is not successful
          const errorMsg = response.message || 'Failed to load news';
          Toast.show({
            type: 'error',
            text1: 'Error fetching news',
            text2: errorMsg,
            visibilityTime: 3000,
          });
          if (!append) {
            setFeaturedNews([]);
          }
          setHasMore(false);
        }
      } catch (error) {
        console.error('Error fetching featured news:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load news';
        
        // Only show error toast on first page load, not on pagination
        if (pageNum === 1) {
          Toast.show({
            type: 'error',
            text1: 'Error fetching news',
            text2: errorMessage.includes('Network') || errorMessage.includes('fetch') 
              ? 'Network error. Please check your connection.' 
              : errorMessage,
            visibilityTime: 3000,
          });
        }
        
        if (!append) {
          setFeaturedNews([]);
        }
        setHasMore(false); // Stop pagination on error
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
    // Only fetch on mount, not when functions change
    let isMounted = true;
    
    const loadNews = async () => {
      if (isMounted) {
        await fetchHighlightedNews();
        await fetchFeaturedNews(1, false);
      }
    };
    
    loadNews();
    
    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array - only run once on mount

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

  const handleAudioSeek = useCallback(async (seconds: number) => {
    if (!currentAudioId) return;

    try {
      const info = await SoundPlayer.getInfo();
      if (typeof info?.currentTime === 'number' && !Number.isNaN(info.currentTime)) {
        const newPosition = Math.max(0, Math.min(info.duration || 0, info.currentTime + seconds));
        // Try to seek using the seek method if available
        if (typeof (SoundPlayer as any).seek === 'function') {
          (SoundPlayer as any).seek(newPosition);
        } else if (typeof (SoundPlayer as any).setCurrentTime === 'function') {
          (SoundPlayer as any).setCurrentTime(newPosition);
        } else {
          // If seek is not available, we'll update the position state but can't actually seek
          console.warn('Seek functionality not available in this version of react-native-sound-player');
        }
        setAudioPosition(newPosition);
      }
    } catch (error) {
      console.warn('Audio seek error:', error);
      // If seek fails, at least update the UI state
      const info = await SoundPlayer.getInfo().catch(() => null);
      if (info && typeof info.currentTime === 'number') {
        setAudioPosition(info.currentTime);
      }
    }
  }, [currentAudioId]);

  const handleAudioRestart = useCallback(async () => {
    if (!currentAudioId) return;

    try {
      // Try to seek to 0 using available methods
      if (typeof (SoundPlayer as any).seek === 'function') {
        (SoundPlayer as any).seek(0);
      } else if (typeof (SoundPlayer as any).setCurrentTime === 'function') {
        (SoundPlayer as any).setCurrentTime(0);
      } else {
        // If seek is not available, stop and replay
        SoundPlayer.stop();
        // Find the news item and replay
        const news = [...highlightedNews, ...featuredNews].find((n) => n.id === currentAudioId);
        if (news && news.media_src) {
          SoundPlayer.playUrl(news.media_src);
        }
      }
      setAudioPosition(0);
    } catch (error) {
      console.warn('Audio restart error:', error);
      // If restart fails, try to stop and replay
      try {
        SoundPlayer.stop();
        const news = [...highlightedNews, ...featuredNews].find((n) => n.id === currentAudioId);
        if (news && news.media_src) {
          SoundPlayer.playUrl(news.media_src);
        }
        setAudioPosition(0);
      } catch (replayError) {
        console.warn('Audio replay error:', replayError);
      }
    }
  }, [currentAudioId, highlightedNews, featuredNews]);

  const handleAudioForward = useCallback(() => {
    handleAudioSeek(10);
  }, [handleAudioSeek]);

  const handleAudioBackward = useCallback(() => {
    handleAudioSeek(-10);
  }, [handleAudioSeek]);

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

  const handleSelectMedia = async () => {
    // For audio files, use document picker
    if (createMediaType === 'AUDIO') {
      try {
        const result = await DocumentPicker.pick({
          type: [DocumentPicker.types.audio],
          copyTo: 'cachesDirectory',
        });

        const file = Array.isArray(result) ? result[0] : result;
        
        if (!file) {
          return;
        }

        // Check file size (10MB = 10 * 1024 * 1024 bytes)
        const maxSize = 10 * 1024 * 1024;
        if (file.size && file.size > maxSize) {
          Toast.show({
            type: 'error',
            text1: 'File Too Large',
            text2: 'File size must be less than 10MB',
            visibilityTime: 3000,
          });
          return;
        }

        const fileName = file.name || `audio_${Date.now()}.${file.type?.split('/')[1] || 'mp3'}`;
        const mimeType = file.type || 'audio/mpeg';

        setSelectedMedia({
          uri: file.uri,
          type: mimeType,
          name: fileName,
          fileSize: file.size || undefined,
        });
      } catch (error: any) {
        if (DocumentPicker.isCancel(error)) {
          // User cancelled
          return;
        }
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: error?.message || 'Failed to select audio file',
          visibilityTime: 3000,
        });
      }
      return;
    }

    // For image and video, use image picker
    let options: any = {
      includeBase64: false,
    };

    if (createMediaType === 'IMAGE') {
      options.mediaType = 'photo';
      options.quality = 0.8;
      options.maxWidth = 1920;
      options.maxHeight = 1920;
    } else if (createMediaType === 'VIDEO') {
      options.mediaType = 'video';
      options.videoQuality = 'high';
    }

    launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.didCancel) {
        return;
      }

      if (response.errorCode) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.errorMessage || 'Failed to select media',
          visibilityTime: 3000,
        });
        return;
      }

      const asset = response.assets?.[0];
      if (!asset) {
        return;
      }

      // Check file size (10MB = 10 * 1024 * 1024 bytes)
      const maxSize = 10 * 1024 * 1024;
      if (asset.fileSize && asset.fileSize > maxSize) {
        Toast.show({
          type: 'error',
          text1: 'File Too Large',
          text2: 'File size must be less than 10MB',
          visibilityTime: 3000,
        });
        return;
      }

      if (asset.uri) {
        const fileExtension = asset.uri.split('.').pop() || '';
        const fileName = `media_${Date.now()}.${fileExtension}`;
        const mimeType = asset.type || `application/octet-stream`;

        setSelectedMedia({
          uri: asset.uri,
          type: mimeType,
          name: fileName,
          fileSize: asset.fileSize,
        });
      }
    });
  };

  const handleCreateNews = async () => {
    if (!createTitle.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Title is required',
        visibilityTime: 3000,
      });
      return;
    }

    if (!selectedMedia) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please select a media file',
        visibilityTime: 3000,
      });
      return;
    }

    try {
      setCreatingNews(true);

      // Prepare FormData
      const formData = new FormData();
      formData.append('title', createTitle.trim());
      formData.append('media_type', createMediaType);
      
      if (createDescription.trim()) {
        formData.append('description', createDescription.trim());
      }
      
      formData.append('is_highlighted', String(createIsHighlighted));
      
      if (createExternalUrl.trim()) {
        formData.append('external_url', createExternalUrl.trim());
      }

      // Append media file
      formData.append('media', {
        uri: selectedMedia.uri,
        type: selectedMedia.type,
        name: selectedMedia.name,
      } as any);

      const response = await NewsService.createNews({
        title: createTitle.trim(),
        media_type: createMediaType,
        description: createDescription.trim() || undefined,
        is_highlighted: createIsHighlighted,
        external_url: createExternalUrl.trim() || undefined,
        media: {
          uri: selectedMedia.uri,
          type: selectedMedia.type,
          name: selectedMedia.name,
        },
      });

      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'News created successfully',
          visibilityTime: 2000,
        });
        
        // Reset form
        setCreateTitle('');
        setCreateDescription('');
        setCreateMediaType('IMAGE');
        setCreateIsHighlighted(false);
        setCreateExternalUrl('');
        setSelectedMedia(null);
        setShowCreateModal(false);

        // Refresh news
        await fetchFeaturedNews(1, false);
        await fetchHighlightedNews();
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error instanceof Error ? error.message : 'Failed to create news',
        visibilityTime: 3000,
      });
    } finally {
      setCreatingNews(false);
    }
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

  const handleRevealVideo = useCallback((newsId?: string) => {
    if (!newsId) {
      return;
    }
    setRevealedVideos((prev) => {
      if (prev.has(newsId)) {
        return prev;
      }
      const newSet = new Set(prev);
      newSet.add(newsId);
      return newSet;
    });
  }, []);

  const handleCloseHighlightModal = useCallback(() => {
    if (selectedHighlightNews && currentAudioId === selectedHighlightNews.id) {
      stopAudioPlayback();
    }
    setShowHighlightModal(false);
    setSelectedHighlightNews(null);
  }, [currentAudioId, selectedHighlightNews, stopAudioPlayback]);

  const generateNewsDeepLink = (newsId: string): string => {
    // Generate deep link for news item
    // Format: mykuttam://news/:id
    return `mykuttam://news/${newsId}`;
  };

  const generateNewsWebUrl = (newsId: string): string => {
    // Generate web URL for sharing (more compatible with messaging apps)
    // Backend serves HTML pages at GET /news/:id (not /api/news/:id)
    // This endpoint includes Open Graph tags for rich link previews
    // Always use BASE_URL from environment variable
    if (!BASE_URL) {
      console.error('BASE_URL is not configured. Please set API_BASE_URL in .env file');
      return '';
    }
    
    // Remove /api from BASE_URL if present (web endpoint is at root level)
    let baseUrl = BASE_URL;
    
    if (baseUrl.endsWith('/api')) {
      baseUrl = baseUrl.slice(0, -4);
    } else if (baseUrl.includes('/api/')) {
      baseUrl = baseUrl.replace('/api', '');
    }
    
    // Ensure no trailing slash
    baseUrl = baseUrl.replace(/\/$/, '');
    
    return `${baseUrl}/news/${newsId}`;
  };

  const handleShareNews = async (news: News) => {
    try {
      const deepLink = generateNewsDeepLink(news.id);
      const webUrl = generateNewsWebUrl(news.id);
      
      // Format like Instagram - URL first, then description
      // This helps messaging apps recognize it as a link and show preview
      const message = `${webUrl}\n\n${news.title}${news.description ? `\n\n${news.description}` : ''}`;
      
      // For iOS, use url property for better link preview support
      // For Android, put URL at the start of message for better recognition
      const shareContent = Platform.OS === 'ios' 
        ? {
            url: webUrl, // iOS: URL property helps with link preview
            message: news.title + (news.description ? `\n\n${news.description}` : ''),
            title: news.title,
          }
        : {
            message: message, // Android: URL in message for better recognition
            title: news.title,
          };

      const result = await Share.share(shareContent);
      if (result.action === Share.sharedAction) {
        // Share was successful
      } else if (result.action === Share.dismissedAction) {
        // Share was dismissed
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Share failed',
        text2: error instanceof Error ? error.message : 'Unable to share news',
      });
    }
  };

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
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={(e) => {
                  e.stopPropagation();
                  setSelectedImageUri(item.media_src || null);
                  setImageModalVisible(true);
                }}>
                <Image source={{ uri: item.media_src }} style={styles.highlightBackgroundImage} resizeMode="cover" />
              </TouchableOpacity>
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
    const isVideoRevealed = revealedVideos.has(item.id);

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
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={(e) => {
              e.stopPropagation();
                  setSelectedImageUri(item.media_src || null);
              setImageModalVisible(true);
            }}>
            <Image source={{ uri: item.media_src }} style={styles.featuredImage} resizeMode="cover" />
          </TouchableOpacity>
        )}

        {item.media_src && item.media_type === 'VIDEO' && (
          <View style={styles.videoContainer}>
            {isVideoRevealed ? (
              <Video
                source={{ uri: item.media_src }}
                style={styles.videoPlayer}
                controls
                resizeMode="contain"
                poster={item.media_src}
                onError={(error) => handleMediaError('Unable to play this video.', error)}
              />
            ) : (
              <TouchableOpacity
                style={styles.videoPlaceholder}
                activeOpacity={0.9}
                onPress={(e) => {
                  e.stopPropagation();
                  handleRevealVideo(item.id);
                }}>
                <View style={styles.videoPlayButton}>
                  <Icon name="play" size={18} color="#fff" />
                </View>
                <Text style={styles.videoPlayText}>Watch video</Text>
                <Text style={styles.videoPlaySubText}>Tap to stream when you're ready</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {item.media_src && item.media_type === 'AUDIO' && (
          <View style={styles.audioContainer}>
            <View style={styles.audioHeader}>
              <Icon name="music" size={16} color={colors.primary} />
              <Text style={styles.audioLabel}>Audio message</Text>
            </View>
            <View style={styles.audioControlsRow}>
              {currentAudioId === item.id ? (
                <>
                  <TouchableOpacity
                    style={styles.audioSeekButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleAudioBackward();
                    }}
                    disabled={audioLoading}>
                    <Icon name="backward" size={14} color={colors.text} />
                    <Text style={styles.audioSeekText}>10s</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.audioSeekButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleAudioRestart();
                    }}
                    disabled={audioLoading}>
                    <Icon name="refresh" size={14} color={colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.audioControlButton,
                      isAudioPlaying && styles.audioControlButtonActive,
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleAudioToggle(item);
                    }}
                    disabled={audioLoading}>
                    {audioLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Icon
                        name={isAudioPlaying ? 'pause' : 'play'}
                        size={14}
                        color="#fff"
                      />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.audioSeekButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleAudioForward();
                    }}
                    disabled={audioLoading}>
                    <Icon name="forward" size={14} color={colors.text} />
                    <Text style={styles.audioSeekText}>10s</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.audioControlButton}
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
              )}
            </View>
            <Text style={styles.audioStatusText}>{getAudioStatusText(item.id)}</Text>
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
          <TouchableOpacity
            style={styles.actionItem}
            onPress={(e) => {
              e.stopPropagation();
              handleShareNews(item);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="share" size={16} color={colors.textMuted} />
          </TouchableOpacity>
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
                  {selectedHighlightNews.id && revealedVideos.has(selectedHighlightNews.id) ? (
                    <Video
                      source={{ uri: selectedHighlightNews.media_src }}
                      style={styles.modalVideoPlayer}
                      controls
                      resizeMode="contain"
                      onError={(error) => handleMediaError('Unable to play this highlight video.', error)}
                    />
                  ) : (
                    <TouchableOpacity
                      style={[styles.videoPlaceholder, styles.modalVideoPlaceholder]}
                      activeOpacity={0.9}
                      onPress={() => handleRevealVideo(selectedHighlightNews?.id)}>
                      <View style={styles.videoPlayButton}>
                        <Icon name="play" size={18} color="#fff" />
                      </View>
                      <Text style={styles.videoPlayText}>Play highlight</Text>
                      <Text style={styles.videoPlaySubText}>Video loads only after you tap</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {selectedHighlightNews?.media_src && selectedHighlightNews.media_type === 'AUDIO' && (
                <View style={styles.modalAudioContainer}>
                  <View style={styles.audioHeader}>
                    <Icon name="music" size={18} color={colors.primary} />
                    <Text style={styles.audioLabel}>Audio message</Text>
                  </View>
                  <View style={styles.audioControlsRow}>
                    {currentAudioId === selectedHighlightNews.id ? (
                      <>
                        <TouchableOpacity
                          style={styles.audioSeekButton}
                          onPress={() => {
                            if (selectedHighlightNews) {
                              handleAudioBackward();
                            }
                          }}
                          disabled={audioLoading}>
                          <Icon name="backward" size={14} color={colors.text} />
                          <Text style={styles.audioSeekText}>10s</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.audioSeekButton}
                          onPress={() => {
                            if (selectedHighlightNews) {
                              handleAudioRestart();
                            }
                          }}
                          disabled={audioLoading}>
                          <Icon name="refresh" size={14} color={colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.audioControlButton,
                            isAudioPlaying && styles.audioControlButtonActive,
                          ]}
                          onPress={() => {
                            if (selectedHighlightNews) {
                              handleAudioToggle(selectedHighlightNews);
                            }
                          }}
                          disabled={audioLoading}>
                          {audioLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Icon
                              name={isAudioPlaying ? 'pause' : 'play'}
                              size={14}
                              color="#fff"
                            />
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.audioSeekButton}
                          onPress={() => {
                            if (selectedHighlightNews) {
                              handleAudioForward();
                            }
                          }}
                          disabled={audioLoading}>
                          <Icon name="forward" size={14} color={colors.text} />
                          <Text style={styles.audioSeekText}>10s</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity
                        style={styles.audioControlButton}
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
                    )}
                  </View>
                  <Text style={styles.audioStatusText}>
                    {getAudioStatusText(selectedHighlightNews.id)}
                  </Text>
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
                <>
                  <TouchableOpacity
                    style={styles.highlightModalCommentsButton}
                    onPress={handleOpenHighlightComments}>
                    <Icon name="comment" size={18} color={colors.primary} />
                    <Text style={styles.highlightModalCommentsText}>View comments</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.highlightModalCommentsButton, styles.highlightModalShareButton]}
                    onPress={() => {
                      if (selectedHighlightNews) {
                        handleShareNews(selectedHighlightNews);
                      }
                    }}>
                    <Icon name="share" size={18} color={colors.primary} />
                    <Text style={styles.highlightModalCommentsText}>Share</Text>
                  </TouchableOpacity>
                </>
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

      {/* Floating Action Button */}
      {canCreateNews() && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowCreateModal(true)}
          activeOpacity={0.8}>
          <Icon name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Create News Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.createModalOverlay}>
          <View style={styles.createModalContainer}>
            <View style={styles.createModalHeader}>
              <Text style={styles.createModalTitle}>Create News</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCreateModal(false);
                  setCreateTitle('');
                  setCreateDescription('');
                  setCreateMediaType('IMAGE');
                  setCreateIsHighlighted(false);
                  setCreateExternalUrl('');
                  setSelectedMedia(null);
                }}>
                <Icon name="times" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.createModalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.createFormGroup}>
                <Text style={styles.createLabel}>Title *</Text>
                <TextInput
                  style={[styles.createTextInput, styles.createTitleInput]}
                  placeholder="Enter title..."
                  placeholderTextColor={colors.textMuted}
                  value={createTitle}
                  onChangeText={setCreateTitle}
                  maxLength={200}
                />
              </View>

              <View style={styles.createFormGroup}>
                <Text style={styles.createLabel}>Description</Text>
                <TextInput
                  style={styles.createTextInput}
                  placeholder="Enter description..."
                  placeholderTextColor={colors.textMuted}
                  value={createDescription}
                  onChangeText={setCreateDescription}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.createFormGroup}>
                <Text style={styles.createLabel}>Media Type *</Text>
                <View style={styles.mediaTypeContainer}>
                  {(['IMAGE', 'VIDEO', 'AUDIO'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.mediaTypeButton,
                        createMediaType === type && styles.mediaTypeButtonActive,
                      ]}
                      onPress={() => {
                        setCreateMediaType(type);
                        setSelectedMedia(null); // Reset media when type changes
                      }}>
                      <Text
                        style={[
                          styles.mediaTypeButtonText,
                          createMediaType === type && styles.mediaTypeButtonTextActive,
                        ]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.createFormGroup}>
                <Text style={styles.createLabel}>Media File * (Max 10MB)</Text>
                <TouchableOpacity
                  style={styles.mediaSelectButton}
                  onPress={handleSelectMedia}>
                  <Icon name="upload" size={20} color={colors.primary} />
                  <Text style={styles.mediaSelectButtonText}>
                    {selectedMedia ? 'Change Media' : 'Select Media'}
                  </Text>
                </TouchableOpacity>
                {selectedMedia && (
                  <View style={styles.selectedMediaContainer}>
                    <Icon
                      name={createMediaType === 'IMAGE' ? 'image' : createMediaType === 'VIDEO' ? 'video-camera' : 'music'}
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={styles.selectedMediaText} numberOfLines={1}>
                      {selectedMedia.name}
                    </Text>
                    {selectedMedia.fileSize && (
                      <Text style={styles.selectedMediaSize}>
                        ({(selectedMedia.fileSize / (1024 * 1024)).toFixed(2)} MB)
                      </Text>
                    )}
                    <TouchableOpacity
                      onPress={() => setSelectedMedia(null)}
                      style={styles.removeMediaButton}>
                      <Icon name="times" size={14} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                )}
                {selectedMedia && createMediaType === 'IMAGE' && (
                  <Image source={{ uri: selectedMedia.uri }} style={styles.selectedMediaPreview} />
                )}
              </View>

              <View style={styles.createFormGroup}>
                <Text style={styles.createLabel}>External URL (Optional)</Text>
                <TextInput
                  style={[styles.createTextInput, styles.createTitleInput]}
                  placeholder="https://example.com"
                  placeholderTextColor={colors.textMuted}
                  value={createExternalUrl}
                  onChangeText={setCreateExternalUrl}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.createFormGroup}>
                <View style={styles.switchContainer}>
                  <Text style={styles.createLabel}>Highlighted News</Text>
                  <Switch
                    value={createIsHighlighted}
                    onValueChange={setCreateIsHighlighted}
                    trackColor={{ false: colors.border, true: colors.primary + '80' }}
                    thumbColor={createIsHighlighted ? colors.primary : colors.textMuted}
                  />
                </View>
                <Text style={styles.switchDescription}>
                  Highlighted news will appear in the highlights section at the top
                </Text>
              </View>
            </ScrollView>

            <View style={styles.createModalFooter}>
              <TouchableOpacity
                style={[styles.createButton, styles.createButtonCancel]}
                onPress={() => {
                  setShowCreateModal(false);
                  setCreateTitle('');
                  setCreateDescription('');
                  setCreateMediaType('IMAGE');
                  setCreateIsHighlighted(false);
                  setCreateExternalUrl('');
                  setSelectedMedia(null);
                }}>
                <Text style={styles.createButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createButton, styles.createButtonSave]}
                onPress={handleCreateNews}
                disabled={creatingNews || !createTitle.trim() || !selectedMedia}>
                {creatingNews ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.createButtonSaveText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Modal - Full Size View */}
      <Modal
        visible={imageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}>
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity
            style={styles.imageModalCloseButton}
            onPress={() => setImageModalVisible(false)}
            activeOpacity={0.8}>
            <Icon name="times" size={24} color="#fff" />
          </TouchableOpacity>
          {selectedImageUri && (
            <Image
              source={{ uri: selectedImageUri }}
              style={styles.imageModalImage}
              resizeMode="contain"
            />
          )}
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
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#101828',
    paddingHorizontal: 24,
    gap: 10,
  },
  videoPlayButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  videoPlayText: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: '#fff',
  },
  videoPlaySubText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
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
  audioControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
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
  audioSeekButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 50,
  },
  audioSeekText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
  },
  audioStatusText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 10,
    textAlign: 'center',
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
  modalVideoPlaceholder: {
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
  highlightModalShareButton: {
    marginTop: 12,
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
  // Floating Action Button
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
    zIndex: 1000,
  },
  // Create News Modal
  createModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  createModalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  createModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  createModalTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  createModalContent: {
    padding: 16,
    maxHeight: 500,
  },
  createFormGroup: {
    marginBottom: 20,
  },
  createLabel: {
    fontFamily: fonts.heading,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  createTextInput: {
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
  createTitleInput: {
    minHeight: 50,
  },
  mediaTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  mediaTypeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  mediaTypeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  mediaTypeButtonText: {
    fontFamily: fonts.heading,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  mediaTypeButtonTextActive: {
    color: '#fff',
  },
  mediaSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    backgroundColor: colors.primary + '10',
  },
  mediaSelectButtonText: {
    fontFamily: fonts.heading,
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  selectedMediaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedMediaText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  selectedMediaSize: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  removeMediaButton: {
    padding: 4,
  },
  selectedMediaPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 12,
    backgroundColor: colors.cardMuted,
  },
  createModalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  createButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonCancel: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  createButtonSave: {
    backgroundColor: colors.primary,
  },
  createButtonCancelText: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.text,
  },
  createButtonSaveText: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: '#fff',
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalImage: {
    width: '100%',
    height: '100%',
  },
});

