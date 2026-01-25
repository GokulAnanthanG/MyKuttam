import { useCallback, useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
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
import { pick, types, errorCodes, isErrorWithCode } from '@react-native-documents/picker';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { AudioService, type Audio } from '../services/audio';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const audioProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFetchingRef = useRef(false);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedAudioUri, setSelectedAudioUri] = useState<string | null>(null);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAudio, setEditingAudio] = useState<Audio | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [updating, setUpdating] = useState(false);

  // Animation refs for playing state
  const animationRefs = useRef<Record<string, Animated.Value>>({});

  const isAdmin = currentUser?.role && currentUser.role.some(r => ['ADMIN', 'SUB_ADMIN'].includes(r));

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
      try {
        const info = await SoundPlayer.getInfo();
        if (typeof info?.currentTime === 'number' && !Number.isNaN(info.currentTime)) {
          setAudioPosition(info.currentTime);
        }
        if (typeof info?.duration === 'number' && !Number.isNaN(info.duration)) {
          setAudioDuration(info.duration);
        }
      } catch (error) {
        // Ignore errors during progress tracking
      }
    }, 500);
  }, []);

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

        const response = await AudioService.getAudios(pageNum, 10);

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
    [],
  );

  useEffect(() => {
    fetchAudios(1, false);
  }, [fetchAudios]);

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
      await AudioService.uploadAudio(selectedAudioUri, uploadTitle.trim(), uploadDescription.trim());
      
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
      await AudioService.updateAudio(editingAudio.id, editTitle.trim(), editDescription.trim());
      
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
            <Text style={styles.audioTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.description ? (
              <Text style={styles.audioDescription} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
            <Text style={styles.audioDate}>{formatDate(item.uploaded_date)}</Text>
          </View>

          {isAdmin && (
            <View style={styles.audioActions}>
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
            </View>
          )}
        </View>

        {isCurrentAudio && (
          <View style={styles.audioProgressContainer}>
            <View style={styles.audioProgressBar}>
              <View style={[styles.audioProgressFill, { width: `${progress * 100}%` }]} />
            </View>
            <View style={styles.audioTimeContainer}>
              <Text style={styles.audioTime}>{formatTime(audioPosition)}</Text>
              <Text style={styles.audioTime}>{formatTime(audioDuration)}</Text>
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
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowUploadModal(false);
                  setSelectedAudioUri(null);
                  setUploadTitle('');
                  setUploadDescription('');
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
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowEditModal(false);
                  setEditingAudio(null);
                  setEditTitle('');
                  setEditDescription('');
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
  audioTitle: {
    fontSize: 16,
    fontFamily: fonts.heading,
    color: colors.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  audioDescription: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.textMuted,
    marginBottom: 4,
  },
  audioDate: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.textMuted,
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
  audioProgressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  audioProgressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  audioTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
});

