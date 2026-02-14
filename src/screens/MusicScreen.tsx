import { useCallback, useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome';
import Toast from 'react-native-toast-message';
import SoundPlayer from 'react-native-sound-player';
import Slider from '@react-native-community/slider';
import { pick, types, errorCodes, isErrorWithCode } from '@react-native-documents/picker';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { AudioService, type Audio, type MusicCategory } from '../services/audio';
import { BASE_URL } from '../config/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const MusicScreen = () => {
  const { currentUser } = useAuth();
  const [audios, setAudios] = useState<Audio[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [currentAudioId, setCurrentAudioId] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPosition, setAudioPosition] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const audioProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFetchingRef = useRef(false);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadCategoryId, setUploadCategoryId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedAudioUri, setSelectedAudioUri] = useState<string | null>(null);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAudio, setEditingAudio] = useState<Audio | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // Category state
  const [categories, setCategories] = useState<MusicCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showUploadCategoryDropdown, setShowUploadCategoryDropdown] = useState(false);
  const [showEditCategoryDropdown, setShowEditCategoryDropdown] = useState(false);
  const [showCategoryManageModal, setShowCategoryManageModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const categoriesScrollRef = useRef<ScrollView>(null);

  // Animation refs for playing state
  const animationRefs = useRef<Record<string, Animated.Value>>({});

  // Accordion state for expanding title/description separately
  const [expandedTitles, setExpandedTitles] = useState<Set<string>>(new Set());
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

  const isAdmin = currentUser?.role && currentUser.role.some(r => ['ADMIN', 'SUB_ADMIN'].includes(r));

  const toggleTitleExpanded = useCallback((itemId: string) => {
    setExpandedTitles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  const toggleDescriptionExpanded = useCallback((itemId: string) => {
    setExpandedDescriptions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  // Initialize animation values for each audio
  useEffect(() => {
    audios.forEach((audio) => {
      if (!animationRefs.current[audio.id]) {
        animationRefs.current[audio.id] = new Animated.Value(0);
      }
    });
  }, [audios]);

  // Start animation when audio is playing
  useEffect(() => {
    if (currentAudioId && isAudioPlaying) {
      const animValue = animationRefs.current[currentAudioId];
      if (animValue) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(animValue, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
        ).start();
      }
    } else {
      // Stop all animations
      Object.values(animationRefs.current).forEach((animValue) => {
        animValue.stopAnimation();
        animValue.setValue(0);
      });
    }
  }, [currentAudioId, isAudioPlaying]);

  const startAudioProgressTracking = useCallback(() => {
    if (audioProgressIntervalRef.current) {
      clearInterval(audioProgressIntervalRef.current);
    }

    audioProgressIntervalRef.current = setInterval(async () => {
      if (isSeeking) return; // Don't update position while user is seeking
      
      try {
        const info = await SoundPlayer.getInfo();
        if (typeof info?.currentTime === 'number' && !Number.isNaN(info.currentTime)) {
          setAudioPosition(info.currentTime);
          setSeekValue(info.currentTime);
        }
        if (typeof info?.duration === 'number' && !Number.isNaN(info.duration)) {
          setAudioDuration(info.duration);
        }
      } catch (error) {
        // Ignore errors during progress tracking
      }
    }, 500);
  }, [isSeeking]);

  const stopAudioProgressInterval = useCallback(() => {
    if (audioProgressIntervalRef.current) {
      clearInterval(audioProgressIntervalRef.current);
      audioProgressIntervalRef.current = null;
    }
  }, []);

  const resetAudioProgress = useCallback(() => {
    setAudioDuration(0);
    setAudioPosition(0);
    setSeekValue(0);
  }, []);

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
        }
        setAudioPosition(newPosition);
        setSeekValue(newPosition);
      }
    } catch (error) {
      // If seek fails, at least update the UI state
      const info = await SoundPlayer.getInfo().catch(() => null);
      if (info && typeof info.currentTime === 'number') {
        setAudioPosition(info.currentTime);
        setSeekValue(info.currentTime);
      }
    }
  }, [currentAudioId]);

  const handleSeekToPosition = useCallback(async (position: number) => {
    if (!currentAudioId) return;

    try {
      const newPosition = Math.max(0, Math.min(audioDuration || 0, position));
      // Try to seek using the seek method if available
      if (typeof (SoundPlayer as any).seek === 'function') {
        (SoundPlayer as any).seek(newPosition);
      } else if (typeof (SoundPlayer as any).setCurrentTime === 'function') {
        (SoundPlayer as any).setCurrentTime(newPosition);
      } else {
        // If seek is not available, we'll update the position state but can't actually seek
      }
      setAudioPosition(newPosition);
      setSeekValue(newPosition);
    } catch (error) {
      // If seek fails, at least update the UI state
      const info = await SoundPlayer.getInfo().catch(() => null);
      if (info && typeof info.currentTime === 'number') {
        setAudioPosition(info.currentTime);
        setSeekValue(info.currentTime);
      }
    }
  }, [currentAudioId, audioDuration]);

  const handleAudioForward = useCallback(() => {
    handleAudioSeek(10);
  }, [handleAudioSeek]);

  const handleAudioBackward = useCallback(() => {
    handleAudioSeek(-10);
  }, [handleAudioSeek]);

  useEffect(() => {
    const finishedSub = SoundPlayer.addEventListener('FinishedPlaying', () => {
      stopAudioProgressInterval();
      resetAudioProgress();
      setIsAudioPlaying(false);
      setCurrentAudioId(null);
    });

    return () => {
      finishedSub.remove();
      stopAudioProgressInterval();
      try {
        SoundPlayer.stop();
      } catch (stopError) {
        // Ignore stop errors
      }
    };
  }, [stopAudioProgressInterval, resetAudioProgress]);

  const fetchAudios = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      if (isFetchingRef.current) {
        return;
      }

      const netInfo = await NetInfo.fetch();
      const isConnected = netInfo.isConnected ?? false;

      if (!isConnected) {
        if (pageNum === 1) {
          setLoading(false);
          setAudios([]);
        }
        setLoadingMore(false);
        setRefreshing(false);
        Toast.show({
          type: 'error',
          text1: 'Offline',
          text2: 'Please check your connection.',
          visibilityTime: 3000,
        });
        return;
      }

      isFetchingRef.current = true;

      try {
        if (pageNum === 1) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }

        // Pass selected category (null means "All" - no filter)
        const response = await AudioService.getAudios(pageNum, 10, selectedCategoryId);

        if (response.success && response.data) {
          const newAudios = response.data.audios || [];
          const pagination = response.data.pagination || {};

          if (append) {
            setAudios((prev) => [...prev, ...newAudios]);
          } else {
            setAudios(newAudios);
          }

          setHasMore(pagination.page < pagination.totalPages);
          setPage(pageNum);
        } else {
          if (pageNum === 1) {
            setAudios([]);
          }
        }
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: error instanceof Error ? error.message : 'Failed to fetch audios',
          visibilityTime: 3000,
        });
        if (pageNum === 1) {
          setAudios([]);
        }
      } finally {
        if (pageNum === 1) {
          setLoading(false);
        }
        setLoadingMore(false);
        setRefreshing(false);
        isFetchingRef.current = false;
      }
    },
    [selectedCategoryId],
  );

  useEffect(() => {
    fetchAudios(1, false);
    fetchCategories();
  }, [fetchAudios]);

  // Refetch audios when category filter changes
  useEffect(() => {
    setAudios([]);
    fetchAudios(1, false);
  }, [selectedCategoryId, fetchAudios]);

  const fetchCategories = useCallback(async () => {
    try {
      setLoadingCategories(true);
      const response = await AudioService.getMusicCategories();
      if (response.success && response.data) {
        setCategories(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch music categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  // Set "My Kuttam" as default category when categories are loaded
  useEffect(() => {
    if (categories.length > 0 && selectedCategoryId === null) {
      const myKuttamCategory = categories.find(
        (cat) => cat.name.toLowerCase() === 'my kuttam'
      );
      if (myKuttamCategory) {
        setSelectedCategoryId(myKuttamCategory.id);
      }
    }
  }, [categories, selectedCategoryId]);

  const handleCategorySelection = (categoryId: string | null) => {
    if (showUploadModal) {
      setUploadCategoryId(categoryId);
      setShowUploadCategoryDropdown(false);
    } else if (showEditModal) {
      setEditCategoryId(categoryId);
      setShowEditCategoryDropdown(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || creatingCategory) {
      return;
    }

    try {
      setCreatingCategory(true);
      const response = await AudioService.createMusicCategory(newCategoryName.trim());
      
      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Category created successfully',
          visibilityTime: 2000,
        });
        setNewCategoryName('');
        // Refresh categories list
        await fetchCategories();
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error instanceof Error ? error.message : 'Failed to create category',
        visibilityTime: 3000,
      });
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleDeleteCategory = (categoryId: string, categoryName: string) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${categoryName}"? This action cannot be undone.`,
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
              setDeletingCategoryId(categoryId);
              const response = await AudioService.deleteMusicCategory(categoryId);
              
              if (response.success) {
                Toast.show({
                  type: 'success',
                  text1: 'Success',
                  text2: 'Category deleted successfully',
                  visibilityTime: 2000,
                });
                // Refresh categories list
                await fetchCategories();
                // If deleted category was selected in upload, reset it
                if (uploadCategoryId === categoryId) {
                  setUploadCategoryId(null);
                }
                // If deleted category was selected in edit, reset it
                if (editCategoryId === categoryId) {
                  setEditCategoryId(null);
                }
              }
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error instanceof Error ? error.message : 'Failed to delete category',
                visibilityTime: 3000,
              });
            } finally {
              setDeletingCategoryId(null);
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAudios(1, false);
  }, [fetchAudios]);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && !isFetchingRef.current) {
      fetchAudios(page + 1, true);
    }
  }, [loadingMore, hasMore, page, fetchAudios]);

  const handleAudioToggle = async (audio: Audio) => {
    if (!audio.audio_url) return;

    try {
      setAudioLoading(true);
      
      // Pause any currently playing audio
      if (currentAudioId && currentAudioId !== audio.id) {
        try {
          SoundPlayer.stop();
          setIsAudioPlaying(false);
          stopAudioProgressInterval();
          resetAudioProgress();
        } catch (stopError) {
          // Ignore stop errors
        }
      }

      if (currentAudioId === audio.id) {
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
            SoundPlayer.playUrl(audio.audio_url);
            setIsAudioPlaying(true);
            startAudioProgressTracking();
          }
        }
      } else {
        try {
          SoundPlayer.stop();
        } catch (stopError) {
          // Ignore stop errors
        }
        stopAudioProgressInterval();
        resetAudioProgress();
        setCurrentAudioId(audio.id);
        SoundPlayer.playUrl(audio.audio_url);
        setIsAudioPlaying(true);
        setSeekValue(0);
        startAudioProgressTracking();
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error instanceof Error ? error.message : 'Failed to play audio',
        visibilityTime: 3000,
      });
    } finally {
      setAudioLoading(false);
    }
  };

  const handleSelectAudio = async () => {
    try {
      const result = await pick({
        type: [types.audio],
      });

      if (result && result.length > 0) {
        const file = result[0];
        const maxSize = 10 * 1024 * 1024; // 10MB

        if (file.size && file.size > maxSize) {
          const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
          Toast.show({
            type: 'error',
            text1: 'File Too Large',
            text2: `File is ${fileSizeMB}MB. Audio size must be less than 10MB`,
            visibilityTime: 4000,
          });
          return;
        }

        setSelectedAudioUri(file.uri);
      }
    } catch (error) {
      if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
        // User canceled, do nothing
        return;
      }
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error instanceof Error ? error.message : 'Failed to select audio file',
        visibilityTime: 3000,
      });
    }
  };

  const handleUpload = async () => {
    if (!selectedAudioUri) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please select an audio file',
        visibilityTime: 3000,
      });
      return;
    }

    if (!uploadTitle.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Title is required',
        visibilityTime: 3000,
      });
      return;
    }

    try {
      setUploading(true);
      await AudioService.uploadAudio(
        selectedAudioUri,
        uploadTitle.trim(),
        uploadDescription.trim(),
        uploadCategoryId || undefined
      );
      
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Audio uploaded successfully',
        visibilityTime: 3000,
      });

      setShowUploadModal(false);
      setSelectedAudioUri(null);
      setUploadTitle('');
      setUploadDescription('');
      setUploadCategoryId(null);
      fetchAudios(1, false);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error instanceof Error ? error.message : 'Failed to upload audio',
        visibilityTime: 3000,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (audio: Audio) => {
    setEditingAudio(audio);
    setEditTitle(audio.title);
    setEditDescription(audio.description || '');
    setEditCategoryId(audio.category?.id || null);
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!editingAudio) return;

    if (!editTitle.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Title is required',
        visibilityTime: 3000,
      });
      return;
    }

    try {
      setUpdating(true);
      await AudioService.updateAudio(
        editingAudio.id,
        editTitle.trim(),
        editDescription.trim(),
        editCategoryId
      );
      
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Audio updated successfully',
        visibilityTime: 3000,
      });

      setShowEditModal(false);
      setEditingAudio(null);
      setEditTitle('');
      setEditDescription('');
      setEditCategoryId(null);
      fetchAudios(1, false);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error instanceof Error ? error.message : 'Failed to update audio',
        visibilityTime: 3000,
      });
    } finally {
      setUpdating(false);
    }
  };

  const generateAudioDeepLink = (audioId: string): string => {
    // Generate deep link for audio
    // Format: mykuttam://audio/:id
    return `mykuttam://audio/${audioId}`;
  };

  const generateAudioWebUrl = (audioId: string): string => {
    // Generate web URL for sharing (more compatible with messaging apps)
    // Backend serves HTML pages at GET /audio/:id (not /api/audio/:id)
    // This endpoint includes Open Graph tags for rich link previews
    // Always use BASE_URL from environment variable
    if (!BASE_URL) {
      return '';
    }
    
    // Remove /api from BASE_URL if present (web endpoint is at root level)
    let baseUrl = BASE_URL;
    if (baseUrl.endsWith('/api')) {
      baseUrl = baseUrl.slice(0, -4);
    }
    // Ensure no trailing slash
    baseUrl = baseUrl.replace(/\/$/, '');
    
    return `${baseUrl}/audio/${audioId}`;
  };

  const handleShareAudio = async (audio: Audio) => {
    try {
      const deepLink = generateAudioDeepLink(audio.id);
      const webUrl = generateAudioWebUrl(audio.id);
      
      // Format like Instagram - URL first, then description
      // This helps messaging apps recognize it as a link and show preview
      const description = audio.description || `Check out "${audio.title}" from the music gallery`;
      const message = `${webUrl}\n\n${description}`;
      
      // For iOS, use url property for better link preview support
      // For Android, put URL at the start of message for better recognition
      const shareContent = Platform.OS === 'ios' 
        ? {
            url: webUrl, // iOS: URL property helps with link preview
            message: description,
            title: 'Music Audio',
          }
        : {
            message: message, // Android: URL in message for better recognition
            title: 'Music Audio',
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
        text2: error instanceof Error ? error.message : 'Unable to share audio',
      });
    }
  };

  const handleDelete = (audio: Audio) => {
    Alert.alert(
      'Delete Audio',
      `Are you sure you want to delete "${audio.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await AudioService.deleteAudio(audio.id);
              
              // Stop playback if this audio is currently playing
              if (currentAudioId === audio.id) {
                try {
                  SoundPlayer.stop();
                  setIsAudioPlaying(false);
                  stopAudioProgressInterval();
                  resetAudioProgress();
                  setCurrentAudioId(null);
                } catch (stopError) {
                  // Ignore stop errors
                }
              }

              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Audio deleted successfully',
                visibilityTime: 3000,
              });

              fetchAudios(1, false);
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error instanceof Error ? error.message : 'Failed to delete audio',
                visibilityTime: 3000,
              });
            }
          },
        },
      ],
    );
  };

  const renderAudioItem = ({ item }: { item: Audio }) => {
    const isCurrentAudio = currentAudioId === item.id;
    const isPlaying = isCurrentAudio && isAudioPlaying;
    const isLoading = isCurrentAudio && audioLoading;
    const isTitleExpanded = expandedTitles.has(item.id);
    const isDescriptionExpanded = expandedDescriptions.has(item.id);

    const animValue = animationRefs.current[item.id] || new Animated.Value(0);
    const scale = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.1],
    });
    const opacity = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.7, 1],
    });

    const progress = audioDuration > 0 ? audioPosition / audioDuration : 0;

    return (
      <View style={styles.audioCard}>
        <View style={styles.audioHeader}>
          <Animated.View
            style={[
              styles.audioIconContainer,
              isPlaying && { transform: [{ scale }], opacity },
            ]}>
            <Icon
              name="music"
              size={24}
              color={isPlaying ? colors.primary : colors.textMuted}
            />
            {isPlaying && (
              <View style={styles.audioWaveContainer}>
                {[0, 1, 2].map((i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.audioWave,
                      {
                        transform: [
                          {
                            scaleY: animValue.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.5, 1.5],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                ))}
              </View>
            )}
          </Animated.View>

          <View style={styles.audioInfo}>
            {/* Description Accordion */}
            {item.description ? (
              <TouchableOpacity
                style={styles.accordionItem}
                onPress={() => toggleDescriptionExpanded(item.id)}
                activeOpacity={0.7}>
                <View style={styles.accordionContent}>
                  <Text style={styles.audioDescription} numberOfLines={isDescriptionExpanded ? undefined : 2}>
                    {item.description}
                  </Text>
                </View>
                <Icon
                  name={isDescriptionExpanded ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.textMuted}
                  style={styles.expandIcon}
                />
              </TouchableOpacity>
            ) : null}
            
            <Text style={styles.audioDate}>{formatDate(item.uploaded_date)}</Text>
          </View>

          <View style={styles.audioActions}>
            <TouchableOpacity
              onPress={() => handleShareAudio(item)}
              style={styles.actionButton}>
              <Icon name="share" size={16} color={colors.primary} />
            </TouchableOpacity>
            {isAdmin && (
              <>
                <TouchableOpacity
                  onPress={() => handleEdit(item)}
                  style={styles.actionButton}>
                  <Icon name="edit" size={16} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(item)}
                  style={styles.actionButton}>
                  <Icon name="trash" size={16} color={colors.danger} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Title Accordion - Separated from Header */}
        <TouchableOpacity
          style={styles.titleAccordionContainer}
          onPress={() => toggleTitleExpanded(item.id)}
          activeOpacity={0.7}>
          <View style={styles.accordionContent}>
            <Text style={styles.audioTitle} numberOfLines={isTitleExpanded ? undefined : 1}>
              {item.title}
            </Text>
          </View>
          <Icon
            name={isTitleExpanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.textMuted}
            style={styles.expandIcon}
          />
        </TouchableOpacity>

        {isCurrentAudio && (
          <View style={styles.audioProgressContainer}>
            <View style={styles.audioControlsRow}>
              <TouchableOpacity
                style={styles.audioSeekButton}
                onPress={handleAudioBackward}
                disabled={audioLoading || audioDuration === 0}>
                <Icon name="backward" size={14} color={audioDuration === 0 ? colors.textMuted : colors.text} />
                <Text style={[styles.audioSeekText, audioDuration === 0 && styles.audioSeekTextDisabled]}>10s</Text>
              </TouchableOpacity>
              
              <View style={styles.sliderContainer}>
                <Slider
                  style={styles.slider}
                  value={isSeeking ? seekValue : audioPosition}
                  minimumValue={0}
                  maximumValue={audioDuration || 1}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor={colors.border}
                  thumbTintColor={colors.primary}
                  onSlidingStart={() => setIsSeeking(true)}
                  onValueChange={(value) => setSeekValue(value)}
                  onSlidingComplete={(value) => {
                    setIsSeeking(false);
                    handleSeekToPosition(value);
                  }}
                  disabled={audioLoading || audioDuration === 0}
                />
                <View style={styles.audioTimeContainer}>
                  <Text style={styles.audioTime}>{formatTime(isSeeking ? seekValue : audioPosition)}</Text>
                  <Text style={styles.audioTime}>{formatTime(audioDuration)}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.audioSeekButton}
                onPress={handleAudioForward}
                disabled={audioLoading || audioDuration === 0}>
                <Icon name="forward" size={14} color={audioDuration === 0 ? colors.textMuted : colors.text} />
                <Text style={[styles.audioSeekText, audioDuration === 0 && styles.audioSeekTextDisabled]}>10s</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.playButton, isPlaying && styles.playButtonActive]}
          onPress={() => handleAudioToggle(item)}
          disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Icon
              name={isPlaying ? 'pause' : 'play'}
              size={20}
              color={isPlaying ? '#fff' : colors.primary}
            />
          )}
          <Text style={[styles.playButtonText, isPlaying && styles.playButtonTextActive]}>
            {isPlaying ? 'Pause' : 'Play'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Music</Text>
          {isAdmin && (
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => setShowUploadModal(true)}>
              <Icon name="plus" size={18} color={colors.primary} />
              <Text style={styles.uploadButtonText}>Upload</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Filter Chips */}
      {categories.length > 0 && (
        <View style={styles.categoriesContainer}>
          <ScrollView
            ref={categoriesScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScrollContent}
            style={styles.categoriesScroll}>
            {/* All Category Option */}
            <TouchableOpacity
              style={[
                styles.categoryChip,
                selectedCategoryId === null && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategoryId(null)}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategoryId === null && styles.categoryChipTextActive,
                ]}>
                All
              </Text>
            </TouchableOpacity>

            {/* Category Chips */}
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryChip,
                  selectedCategoryId === category.id && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategoryId(category.id)}
                activeOpacity={0.7}>
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedCategoryId === category.id && styles.categoryChipTextActive,
                  ]}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {/* Right fade gradient */}
          <View style={styles.categoriesFadeContainer} pointerEvents="none">
            <View style={styles.categoriesFadeRight} />
          </View>
        </View>
      )}

      {loading && audios.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={audios}
          renderItem={renderAudioItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="music" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No audio files available</Text>
            </View>
          }
        />
      )}

      {/* Upload Modal */}
      <Modal
        visible={showUploadModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowUploadModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upload Audio</Text>
              <TouchableOpacity onPress={() => setShowUploadModal(false)}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <TouchableOpacity
                style={styles.fileSelectButton}
                onPress={handleSelectAudio}>
                <Icon name="file-audio-o" size={24} color={colors.primary} />
                <Text style={styles.fileSelectText}>
                  {selectedAudioUri ? 'Audio Selected' : 'Select Audio File'}
                </Text>
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter audio title"
                placeholderTextColor={colors.textMuted}
                value={uploadTitle}
                onChangeText={setUploadTitle}
              />

              <Text style={styles.inputLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter audio description"
                placeholderTextColor={colors.textMuted}
                value={uploadDescription}
                onChangeText={setUploadDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <Text style={styles.inputLabel}>Category (Optional)</Text>
              {loadingCategories && categories.length === 0 ? (
                <View style={styles.categoryLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.categoryLoadingText}>Loading categories...</Text>
                </View>
              ) : categories.length === 0 ? (
                <View style={styles.categoryEmpty}>
                  <Text style={styles.categoryEmptyText}>No categories available</Text>
                </View>
              ) : (
                <View style={styles.selectBoxContainer}>
                  <Pressable
                    style={styles.selectBox}
                    onPress={() => setShowUploadCategoryDropdown(!showUploadCategoryDropdown)}
                    android_ripple={{ color: colors.primary + '20' }}>
                    <Text
                      style={[
                        styles.selectBoxText,
                        !uploadCategoryId && styles.selectBoxPlaceholder,
                      ]}>
                      {uploadCategoryId
                        ? categories.find((c) => c.id === uploadCategoryId)?.name || 'Select category'
                        : 'Choose category (Optional)'}
                    </Text>
                    <Icon
                      name={showUploadCategoryDropdown ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.textMuted}
                    />
                  </Pressable>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowUploadModal(false);
                  setSelectedAudioUri(null);
                  setUploadTitle('');
                  setUploadDescription('');
                  setUploadCategoryId(null);
                  setShowUploadCategoryDropdown(false);
                }}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton, uploading && styles.submitButtonDisabled]}
                onPress={handleUpload}
                disabled={uploading}>
                {uploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Upload</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Audio</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter audio title"
                placeholderTextColor={colors.textMuted}
                value={editTitle}
                onChangeText={setEditTitle}
              />

              <Text style={styles.inputLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter audio description"
                placeholderTextColor={colors.textMuted}
                value={editDescription}
                onChangeText={setEditDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <Text style={styles.inputLabel}>Category (Optional)</Text>
              {loadingCategories && categories.length === 0 ? (
                <View style={styles.categoryLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.categoryLoadingText}>Loading categories...</Text>
                </View>
              ) : categories.length === 0 ? (
                <View style={styles.categoryEmpty}>
                  <Text style={styles.categoryEmptyText}>No categories available</Text>
                </View>
              ) : (
                <View style={styles.selectBoxContainer}>
                  <Pressable
                    style={styles.selectBox}
                    onPress={() => setShowEditCategoryDropdown(!showEditCategoryDropdown)}
                    android_ripple={{ color: colors.primary + '20' }}>
                    <Text
                      style={[
                        styles.selectBoxText,
                        !editCategoryId && styles.selectBoxPlaceholder,
                      ]}>
                      {editCategoryId
                        ? categories.find((c) => c.id === editCategoryId)?.name || 'Select category'
                        : 'Choose category (Optional)'}
                    </Text>
                    <Icon
                      name={showEditCategoryDropdown ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.textMuted}
                    />
                  </Pressable>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowEditModal(false);
                  setEditingAudio(null);
                  setEditTitle('');
                  setEditDescription('');
                  setEditCategoryId(null);
                  setShowEditCategoryDropdown(false);
                }}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton, updating && styles.submitButtonDisabled]}
                onPress={handleUpdate}
                disabled={updating}>
                {updating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Category Dropdown Modal for Upload */}
      <Modal
        visible={showUploadCategoryDropdown && showUploadModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUploadCategoryDropdown(false)}>
        <Pressable
          style={styles.categoryDropdownModalOverlay}
          onPress={() => setShowUploadCategoryDropdown(false)}>
          <View style={styles.categoryDropdownModalContainer}>
            <View style={styles.categoryDropdownHeader}>
              <Text style={styles.categoryDropdownTitle}>Select Category</Text>
              <TouchableOpacity
                onPress={() => setShowUploadCategoryDropdown(false)}
                style={styles.categoryDropdownCloseButton}>
                <Icon name="times" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.categoryDropdownScrollView}
              contentContainerStyle={styles.categoryDropdownContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}>
              <Pressable
                style={[
                  styles.categoryDropdownOption,
                  !uploadCategoryId && styles.categoryDropdownOptionActive,
                ]}
                onPress={() => handleCategorySelection(null)}
                android_ripple={{ color: colors.primary + '20' }}>
                <Text
                  style={[
                    styles.categoryDropdownOptionText,
                    !uploadCategoryId && styles.categoryDropdownOptionTextActive,
                  ]}>
                  None
                </Text>
                {!uploadCategoryId && (
                  <Icon name="check" size={18} color={colors.primary} />
                )}
              </Pressable>
              {categories.map((category) => (
                <Pressable
                  key={category.id}
                  style={[
                    styles.categoryDropdownOption,
                    uploadCategoryId === category.id && styles.categoryDropdownOptionActive,
                  ]}
                  onPress={() => handleCategorySelection(category.id)}
                  android_ripple={{ color: colors.primary + '20' }}>
                  <Text
                    style={[
                      styles.categoryDropdownOptionText,
                      uploadCategoryId === category.id && styles.categoryDropdownOptionTextActive,
                    ]}>
                    {category.name}
                  </Text>
                  {uploadCategoryId === category.id && (
                    <Icon name="check" size={18} color={colors.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Category Dropdown Modal for Edit */}
      <Modal
        visible={showEditCategoryDropdown && showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditCategoryDropdown(false)}>
        <Pressable
          style={styles.categoryDropdownModalOverlay}
          onPress={() => setShowEditCategoryDropdown(false)}>
          <View style={styles.categoryDropdownModalContainer}>
            <View style={styles.categoryDropdownHeader}>
              <Text style={styles.categoryDropdownTitle}>Select Category</Text>
              <TouchableOpacity
                onPress={() => setShowEditCategoryDropdown(false)}
                style={styles.categoryDropdownCloseButton}>
                <Icon name="times" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.categoryDropdownScrollView}
              contentContainerStyle={styles.categoryDropdownContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}>
              <Pressable
                style={[
                  styles.categoryDropdownOption,
                  !editCategoryId && styles.categoryDropdownOptionActive,
                ]}
                onPress={() => handleCategorySelection(null)}
                android_ripple={{ color: colors.primary + '20' }}>
                <Text
                  style={[
                    styles.categoryDropdownOptionText,
                    !editCategoryId && styles.categoryDropdownOptionTextActive,
                  ]}>
                  None
                </Text>
                {!editCategoryId && (
                  <Icon name="check" size={18} color={colors.primary} />
                )}
              </Pressable>
              {categories.map((category) => (
                <Pressable
                  key={category.id}
                  style={[
                    styles.categoryDropdownOption,
                    editCategoryId === category.id && styles.categoryDropdownOptionActive,
                  ]}
                  onPress={() => handleCategorySelection(category.id)}
                  android_ripple={{ color: colors.primary + '20' }}>
                  <Text
                    style={[
                      styles.categoryDropdownOptionText,
                      editCategoryId === category.id && styles.categoryDropdownOptionTextActive,
                    ]}>
                    {category.name}
                  </Text>
                  {editCategoryId === category.id && (
                    <Icon name="check" size={18} color={colors.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Floating Manage Categories Button (Admin/Sub-Admin only) */}
      {isAdmin && (
        <TouchableOpacity
          style={styles.floatingManageButton}
          onPress={async () => {
            setShowCategoryManageModal(true);
            // Refresh categories when opening modal
            await fetchCategories();
          }}
          activeOpacity={0.8}>
          <Icon name="tags" size={20} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Category Management Modal */}
      <Modal
        visible={showCategoryManageModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowCategoryManageModal(false);
          setNewCategoryName('');
        }}>
        <View style={styles.categoryManageModalOverlay}>
          <View style={styles.categoryManageModalContainer}>
            <View style={styles.categoryManageModalHeader}>
              <Text style={styles.categoryManageModalTitle}>Manage Categories</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCategoryManageModal(false);
                  setNewCategoryName('');
                }}>
                <Icon name="times" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.categoryManageModalContent}>
              {/* Add Category Section */}
              <View style={styles.addCategorySection}>
                <View style={styles.addCategoryRow}>
                  <TextInput
                    style={styles.addCategoryInput}
                    placeholder="Enter category name"
                    placeholderTextColor={colors.textMuted}
                    value={newCategoryName}
                    onChangeText={setNewCategoryName}
                    maxLength={50}
                  />
                  <TouchableOpacity
                    style={[
                      styles.addCategoryButton,
                      (!newCategoryName.trim() || creatingCategory) && styles.addCategoryButtonDisabled,
                    ]}
                    onPress={handleCreateCategory}
                    disabled={!newCategoryName.trim() || creatingCategory}
                    activeOpacity={0.7}>
                    {creatingCategory ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.addCategoryButtonText}>Add</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Categories List */}
              <View style={styles.categoriesListSection}>
                <Text style={styles.categoriesListTitle}>Categories</Text>
                {loadingCategories && categories.length === 0 ? (
                  <View style={styles.categoriesListLoading}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : categories.length === 0 ? (
                  <View style={styles.categoriesListEmpty}>
                    <Text style={styles.categoriesListEmptyText}>No categories yet</Text>
                  </View>
                ) : (
                  categories.map((category) => (
                    <View key={category.id} style={styles.categoryListItem}>
                      <Text style={styles.categoryListItemName}>{category.name}</Text>
                      <TouchableOpacity
                        style={styles.categoryDeleteButton}
                        onPress={() => handleDeleteCategory(category.id, category.name)}
                        disabled={deletingCategoryId === category.id}
                        activeOpacity={0.7}>
                        {deletingCategoryId === category.id ? (
                          <ActivityIndicator size="small" color={colors.danger} />
                        ) : (
                          <Icon name="trash" size={18} color={colors.danger} />
                        )}
                      </TouchableOpacity>
                    </View>
                  ))
                )}
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 28,
    color: colors.text,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.cardMuted,
  },
  uploadButtonText: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.primary,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  audioCard: {
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
  audioHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  audioIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.cardMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  audioWaveContainer: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  audioWave: {
    width: 3,
    height: 12,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  audioInfo: {
    flex: 1,
  },
  accordionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  accordionContent: {
    flex: 1,
    marginRight: 8,
  },
  audioTitle: {
    fontSize: 16,
    fontFamily: fonts.heading,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'left',
  },
  audioDescription: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.textMuted,
    textAlign: 'left',
  },
  expandIcon: {
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  audioDate: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.textMuted,
    textAlign: 'left',
    marginTop: 4,
  },
  titleAccordionContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  audioActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
  actionButton: {
    padding: 8,
  },
  audioProgressContainer: {
    marginBottom: 12,
  },
  audioControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  audioSeekButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.cardMuted,
    minWidth: 60,
  },
  audioSeekText: {
    fontSize: 11,
    fontFamily: fonts.body,
    color: colors.text,
    fontWeight: '600',
  },
  audioSeekTextDisabled: {
    color: colors.textMuted,
  },
  sliderContainer: {
    flex: 1,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  audioTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  audioTime: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.textMuted,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  playButtonActive: {
    backgroundColor: colors.primary,
  },
  playButtonText: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.primary,
    fontWeight: '600',
  },
  playButtonTextActive: {
    color: '#fff',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  categoriesContainer: {
    position: 'relative',
    paddingVertical: 12,
    paddingLeft: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  categoriesScroll: {
    flexGrow: 0,
  },
  categoriesScrollContent: {
    paddingRight: 20,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  categoriesFadeContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 30,
    flexDirection: 'row',
  },
  categoriesFadeRight: {
    flex: 1,
    backgroundColor: colors.background,
    opacity: 0.98,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.textMuted,
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: fonts.heading,
    color: colors.text,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 20,
  },
  fileSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
    borderRadius: 12,
    backgroundColor: colors.cardMuted,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  fileSelectText: {
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.text,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.text,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.cardMuted,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.text,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors.cardMuted,
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.text,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: colors.primary,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: fonts.body,
    color: '#fff',
    fontWeight: '600',
  },
  categoryLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  categoryLoadingText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
  categoryEmpty: {
    paddingVertical: 12,
  },
  categoryEmptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  selectBoxContainer: {
    position: 'relative',
    zIndex: 10,
    marginBottom: 4,
  },
  selectBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.cardMuted,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
  },
  selectBoxText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  selectBoxPlaceholder: {
    color: colors.textMuted,
  },
  categoryDropdownModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryDropdownModalContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 24,
  },
  categoryDropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryDropdownTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.text,
    fontWeight: '600',
  },
  categoryDropdownCloseButton: {
    padding: 4,
  },
  categoryDropdownScrollView: {
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  categoryDropdownContent: {
    paddingBottom: 16,
  },
  categoryDropdownOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryDropdownOptionActive: {
    backgroundColor: colors.cardMuted,
  },
  categoryDropdownOptionText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  categoryDropdownOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  floatingManageButton: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  categoryManageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  categoryManageModalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  categoryManageModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryManageModalTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: colors.text,
    fontWeight: '600',
  },
  categoryManageModalContent: {
    padding: 20,
  },
  addCategorySection: {
    marginBottom: 24,
  },
  addCategoryRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  addCategoryInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.cardMuted,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addCategoryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  addCategoryButtonDisabled: {
    backgroundColor: colors.textMuted,
    opacity: 0.5,
  },
  addCategoryButtonText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  categoriesListSection: {
    marginTop: 8,
  },
  categoriesListTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
    marginBottom: 12,
  },
  categoriesListLoading: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  categoriesListEmpty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  categoriesListEmptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
  categoryListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.cardMuted,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryListItemName: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  categoryDeleteButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

