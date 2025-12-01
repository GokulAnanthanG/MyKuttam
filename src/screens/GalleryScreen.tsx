import { useCallback, useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  launchImageLibrary,
  type ImagePickerResponse,
  type MediaType,
} from 'react-native-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { GalleryService, type GalleryImage, type GalleryStatus } from '../services/gallery';
import {
  getStoredGalleryImages,
  saveGalleryImagesToRealm,
} from '../storage/galleryRealm';
import { GallerySkeleton } from '../components/GallerySkeleton';

export const GalleryScreen = () => {
  const { currentUser } = useAuth();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [status, setStatus] = useState<GalleryStatus>('approved');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const isFetchingRef = useRef(false);
  const hasShownOfflineToastRef = useRef(false);

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUB_ADMIN';

  const fetchImages = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      // Prevent multiple simultaneous calls
      if (isFetchingRef.current) {
        console.log('Gallery: Already fetching, skipping duplicate call');
        return;
      }

      // Check network status before making API call
      const netInfo = await NetInfo.fetch();
      const isConnected = netInfo.isConnected ?? false;
      setIsOnline(isConnected);

      if (!isConnected) {
        console.log('Gallery: Offline, loading from cache');
        // Load from Realm cache when offline
        try {
          const storedImages = await getStoredGalleryImages();
          if (storedImages.length > 0) {
            setImages(storedImages);
            if (!hasShownOfflineToastRef.current) {
              Toast.show({
                type: 'error',
                text1: 'Offline Mode',
                text2: 'Showing cached images. Please check your connection.',
                visibilityTime: 3000,
              });
              hasShownOfflineToastRef.current = true;
            }
          } else {
            if (pageNum === 1) {
              setImages([]);
            }
            if (!hasShownOfflineToastRef.current) {
              Toast.show({
                type: 'error',
                text1: 'Offline',
                text2: 'No cached images available. Please check your connection.',
                visibilityTime: 3000,
              });
              hasShownOfflineToastRef.current = true;
            }
          }
        } catch (realmError) {
          console.error('Error loading from Realm:', realmError);
          if (pageNum === 1) {
            setImages([]);
          }
        } finally {
          if (pageNum === 1) {
            setLoading(false);
          }
          setLoadingMore(false);
          setRefreshing(false);
        }
        return; // Exit early when offline
      }

      // Reset offline toast flag when online
      hasShownOfflineToastRef.current = false;

      isFetchingRef.current = true;

      try {
        if (pageNum === 1) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }

        // For regular users, always use 'approved' (which maps to 'permitted' in API)
        // For admins, use the selected status
        const apiStatus = isAdmin ? status : 'approved';
        const response = await GalleryService.getGalleryImages(pageNum, 10, apiStatus);

        // Ensure we have valid response data
        const imagesData = response?.data?.images || [];
        
        console.log('Gallery fetch result:', {
          requestedStatus: apiStatus,
          imagesCount: imagesData.length,
          imageStatuses: imagesData.map(img => ({ id: img.id, status: img.status })),
          responseSuccess: response?.success,
        });
        
        if (append) {
          setImages((prev) => [...prev, ...imagesData]);
        } else {
          // Always set images, even if empty
          setImages(imagesData);
          // Store last 10 images for offline
          if (imagesData.length > 0) {
            await saveGalleryImagesToRealm(imagesData);
          }
        }

        setHasMore(pageNum < (response?.data?.pagination?.totalPages || 0));
        setPage(pageNum);
      } catch (error) {
        console.error('Gallery fetch error:', error);
        
        // Check if error is due to network
        const isNetworkError = 
          error instanceof Error && (
            error.message.includes('Network') ||
            error.message.includes('fetch') ||
            error.message.includes('timeout') ||
            error.message.includes('Failed to fetch')
          );

        // Try to load from Realm on network error
        if (isNetworkError) {
          try {
            const storedImages = await getStoredGalleryImages();
            if (storedImages.length > 0) {
              setImages(storedImages);
              if (!hasShownOfflineToastRef.current) {
                Toast.show({
                  type: 'error',
                  text1: 'Offline Mode',
                  text2: 'Showing cached images. Please check your connection.',
                  visibilityTime: 3000,
                });
                hasShownOfflineToastRef.current = true;
              }
            } else {
              // No cached images, ensure empty state
              if (pageNum === 1) {
                setImages([]);
              }
              if (!hasShownOfflineToastRef.current) {
                Toast.show({
                  type: 'error',
                  text1: 'Network Error',
                  text2: 'Unable to load gallery. Please check your connection.',
                  visibilityTime: 3000,
                });
                hasShownOfflineToastRef.current = true;
              }
            }
          } catch (realmError) {
            console.error('Error loading from Realm:', realmError);
            // No cached images, ensure empty state
            if (pageNum === 1) {
              setImages([]);
            }
            if (!hasShownOfflineToastRef.current) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to load gallery',
                visibilityTime: 3000,
              });
              hasShownOfflineToastRef.current = true;
            }
          }
        } else {
          // Non-network error, show error message
          if (pageNum === 1) {
            setImages([]);
          }
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: error instanceof Error ? error.message : 'Failed to load gallery',
            visibilityTime: 3000,
          });
        }
      } finally {
        // Always stop loading states and reset fetching flag
        isFetchingRef.current = false;
        if (pageNum === 1) {
          setLoading(false);
        }
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [isAdmin, status],
  );

  // Monitor network status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isConnected = state.isConnected ?? false;
      setIsOnline(isConnected);
      
      // Reset offline toast flag when coming back online
      if (isConnected) {
        hasShownOfflineToastRef.current = false;
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Reset when status changes and fetch new images
    setPage(1);
    setHasMore(true);
    setImages([]);
    hasShownOfflineToastRef.current = false; // Reset toast flag on status change
    fetchImages(1, false);
  }, [status, fetchImages]);

  const handleRefresh = async () => {
    // Check network before refresh
    const netInfo = await NetInfo.fetch();
    const isConnected = netInfo.isConnected ?? false;
    
    if (!isConnected) {
      // Just load from cache when offline
      try {
        const storedImages = await getStoredGalleryImages();
        setImages(storedImages);
        Toast.show({
          type: 'error',
          text1: 'Offline',
          text2: 'Showing cached images. Please check your connection.',
          visibilityTime: 2000,
        });
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Offline',
          text2: 'No cached images available.',
          visibilityTime: 2000,
        });
      }
      setRefreshing(false);
      return;
    }

    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    hasShownOfflineToastRef.current = false; // Reset toast flag on refresh
    fetchImages(1, false);
  };

  const handleLoadMore = async () => {
    // Don't load more when offline or already fetching
    if (!isOnline || isFetchingRef.current || loadingMore || !hasMore) {
      return;
    }
    fetchImages(page + 1, true);
  };

  const handleApprove = async (imageId: string) => {
    // Check network before showing alert
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      Toast.show({
        type: 'error',
        text1: 'Offline',
        text2: 'Cannot approve image while offline. Please check your connection.',
        visibilityTime: 3000,
      });
      return;
    }

    Alert.alert(
      'Approve Image',
      'Are you sure you want to approve this image?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            try {
              await GalleryService.updateImageStatus(imageId, 'permitted');
              Toast.show({
                type: 'success',
                text1: 'Image Approved',
                text2: 'The image has been approved and will now appear in the gallery.',
                visibilityTime: 3000,
              });
              // Remove from review list and refresh
              setImages((prev) => prev.filter((img) => img.id !== imageId));
              // Refresh to update pagination (only if online)
              if (isOnline) {
                fetchImages(1, false);
              }
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Approval Failed',
                text2: error instanceof Error ? error.message : 'Failed to approve image',
                visibilityTime: 3000,
              });
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const handleDelete = async (imageId: string) => {
    // Check network before showing alert
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      Toast.show({
        type: 'error',
        text1: 'Offline',
        text2: 'Cannot delete image while offline. Please check your connection.',
        visibilityTime: 3000,
      });
      return;
    }

    Alert.alert(
      'Delete Image',
      'Are you sure you want to delete this image? This action cannot be undone.',
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
              await GalleryService.deleteImage(imageId);
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Image deleted successfully',
                visibilityTime: 2000,
              });
              // Remove from local state
              setImages((prev) => prev.filter((img) => img.id !== imageId));
              // Refresh to update pagination (only if online)
              if (isOnline) {
                fetchImages(1, false);
              }
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error instanceof Error ? error.message : 'Failed to delete image',
                visibilityTime: 3000,
              });
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleImagePicker = () => {
    const options = {
      mediaType: 'photo' as MediaType,
      quality: 0.8 as const,
      maxWidth: 1920,
      maxHeight: 1920,
    };

    launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.didCancel) {
        return;
      }
      if (response.errorMessage) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.errorMessage,
        });
        return;
      }
      if (response.assets && response.assets[0]) {
        setSelectedImageUri(response.assets[0].uri || null);
        setShowUploadModal(true);
      }
    });
  };

  const handleUpload = async () => {
    if (!selectedImageUri) return;

    // Check network before upload
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      Toast.show({
        type: 'error',
        text1: 'Offline',
        text2: 'Cannot upload image while offline. Please check your connection.',
        visibilityTime: 3000,
      });
      return;
    }

    setShowConfirmModal(false);
    setShowUploadModal(false);
    setUploading(true);

    try {
      await GalleryService.uploadImage(selectedImageUri, uploadDescription);
      Toast.show({
        type: 'success',
        text1: 'Image Uploaded',
        text2: 'Your image has been uploaded successfully. It will appear in the gallery once approved by admin.',
        visibilityTime: 4000,
      });
      // Reset form
      setSelectedImageUri(null);
      setUploadDescription('');
      // Refresh images only if viewing review status (for admin) and online
      if (isAdmin && status === 'review' && isOnline) {
        fetchImages(1, false);
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Upload Failed',
        text2: error instanceof Error ? error.message : 'Failed to upload image',
        visibilityTime: 3000,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmUpload = () => {
    if (!selectedImageUri) return;
    setShowUploadModal(false);
    setShowConfirmModal(true);
  };

  const isImageOwner = (image: GalleryImage) => {
    return currentUser?.id === image.user_id._id;
  };

  const renderImageItem = ({ item }: { item: GalleryImage }) => (
    <Pressable
      style={styles.imageContainer}
      onPress={() => {
        console.log('Image selected:', item.id, item.image_url);
        setSelectedImage(item);
      }}
      android_ripple={{ color: colors.primary + '20' }}>
      <Image source={{ uri: item.image_url }} style={styles.image} resizeMode="cover" />
      {isAdmin && item.status === 'review' && (
        <View style={styles.adminActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => handleApprove(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="check" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDelete(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="trash" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
      {item.status === 'review' && (
        <View style={styles.reviewBadge}>
          <Text style={styles.reviewBadgeText}>Review</Text>
        </View>
      )}
    </Pressable>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  if (loading && images.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Gallery</Text>
          {isAdmin && (
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[styles.toggleButton, status === 'review' && styles.toggleButtonActive]}
                onPress={() => setStatus('review')}>
                <Text
                  style={[
                    styles.toggleButtonText,
                    status === 'review' && styles.toggleButtonTextActive,
                  ]}>
                  Review
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, status === 'approved' && styles.toggleButtonActive]}
                onPress={() => setStatus('approved')}>
                <Text
                  style={[
                    styles.toggleButtonText,
                    status === 'approved' && styles.toggleButtonTextActive,
                  ]}>
                  Approved
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <GallerySkeleton count={6} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gallery</Text>
        {isAdmin && (
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, status === 'review' && styles.toggleButtonActive]}
              onPress={() => setStatus('review')}>
              <Text
                style={[
                  styles.toggleButtonText,
                  status === 'review' && styles.toggleButtonTextActive,
                ]}>
                Review
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, status === 'approved' && styles.toggleButtonActive]}
              onPress={() => setStatus('approved')}>
              <Text
                style={[
                  styles.toggleButtonText,
                  status === 'approved' && styles.toggleButtonTextActive,
                ]}>
                Approved
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <FlatList
        data={images}
        renderItem={renderImageItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.row}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="image" size={64} color={colors.textMuted} />
            <Text style={styles.emptyText}>No images found</Text>
          </View>
        }
      />

      {/* Image Modal */}
      {selectedImage && (
        <Modal
          visible={selectedImage !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedImage(null)}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setSelectedImage(null)}>
            <View
              style={styles.modalImageContainer}
              onStartShouldSetResponder={() => true}
              onResponderTerminationRequest={() => false}>
              {/* Modal Header with Date */}
              <View style={styles.modalHeaderContainer}>
                <View style={styles.modalHeaderLeft}>
                  <Icon name="calendar" size={14} color={colors.textMuted} />
                  <Text style={styles.modalHeaderDate}>
                    {formatDate(selectedImage.uploaded_date)}
                  </Text>
                </View>
                <View style={styles.modalHeaderRight}>
                  {selectedImage && isImageOwner(selectedImage) && (
                    <TouchableOpacity
                      style={styles.deleteButtonModal}
                      onPress={() => {
                        setSelectedImage(null);
                        handleDelete(selectedImage.id);
                      }}
                      activeOpacity={0.7}>
                      <Icon name="trash" size={16} color="#fff" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setSelectedImage(null)}
                    activeOpacity={0.7}>
                    <Icon name="times" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
                bounces={false}>
                <Image
                  source={{ uri: selectedImage.image_url }}
                  style={styles.modalImage}
                  resizeMode="contain"
                  onError={(error) => {
                    console.log('Image load error:', error);
                    Toast.show({
                      type: 'error',
                      text1: 'Error',
                      text2: 'Failed to load image',
                    });
                  }}
                  onLoad={() => {
                    console.log('Image loaded successfully:', selectedImage.image_url);
                  }}
                />
                <View style={styles.modalInfo}>
                  {/* Description Section */}
                  <View style={styles.modalDescriptionSection}>
                    <View style={styles.modalDescriptionHeader}>
                      <Icon name="file-text" size={16} color={colors.primary} />
                      <Text style={styles.modalInfoLabel}>Description</Text>
                    </View>
                    {selectedImage.description ? (
                      <Text style={styles.modalDescription}>
                        {selectedImage.description}
                      </Text>
                    ) : (
                      <Text style={styles.modalDescriptionEmpty}>
                        No description provided
                      </Text>
                    )}
                  </View>

                  {/* Uploaded By Section */}
                  <View style={styles.modalUserSection}>
                    <View style={styles.modalUserHeader}>
                      <Icon name="user" size={16} color={colors.primary} />
                      <Text style={styles.modalInfoLabel}>Uploaded By</Text>
                    </View>
                    {isAdmin ? (
                      <View style={styles.modalUserInfo}>
                        <Text style={styles.modalUserName}>{selectedImage.user_id.name}</Text>
                        <Text style={styles.modalUserPhone}>{selectedImage.user_id.phone}</Text>
                      </View>
                    ) : (
                      <Text style={styles.modalUser}>
                        {selectedImage.user_id.name}
                      </Text>
                    )}
                  </View>
                </View>
                </ScrollView>
            </View>
          </Pressable>
        </Modal>
      )}

      {/* Upload Modal */}
      <Modal
        visible={showUploadModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowUploadModal(false);
          setSelectedImageUri(null);
          setUploadDescription('');
        }}>
        <View style={styles.uploadModalOverlay}>
          <View style={styles.uploadModalContainer}>
            <View style={styles.uploadModalHeader}>
              <Text style={styles.uploadModalTitle}>Upload Image</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowUploadModal(false);
                  setSelectedImageUri(null);
                  setUploadDescription('');
                }}>
                <Icon name="times" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.uploadModalContent}>
              {selectedImageUri ? (
                <Image source={{ uri: selectedImageUri }} style={styles.uploadPreviewImage} />
              ) : (
                <Pressable style={styles.uploadPlaceholder} onPress={handleImagePicker}>
                  <Icon name="camera" size={48} color={colors.textMuted} />
                  <Text style={styles.uploadPlaceholderText}>Tap to select image</Text>
                </Pressable>
              )}

              <View style={styles.uploadForm}>
                <Text style={styles.uploadLabel}>Description (Optional)</Text>
                <TextInput
                  style={styles.uploadDescriptionInput}
                  placeholder="Enter image description..."
                  placeholderTextColor={colors.textMuted}
                  value={uploadDescription}
                  onChangeText={setUploadDescription}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            <View style={styles.uploadModalFooter}>
              {!selectedImageUri && (
                <TouchableOpacity
                  style={styles.uploadSelectButton}
                  onPress={handleImagePicker}
                  activeOpacity={0.7}>
                  <Icon name="image" size={18} color="#fff" />
                  <Text style={styles.uploadSelectButtonText}>Select Image</Text>
                </TouchableOpacity>
              )}
              {selectedImageUri && (
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={handleConfirmUpload}
                  activeOpacity={0.7}
                  disabled={uploading}>
                  {uploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Icon name="cloud-upload" size={18} color="#fff" />
                      <Text style={styles.uploadButtonText}>Upload</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}>
        <View style={styles.confirmModalOverlay}>
          <View style={styles.confirmModalContainer}>
            <Text style={styles.confirmModalTitle}>Confirm Upload</Text>
            <Text style={styles.confirmModalText}>
              Are you sure you want to upload this image?
            </Text>
            <View style={styles.confirmModalButtons}>
              <TouchableOpacity
                style={[styles.confirmModalButton, styles.confirmModalButtonCancel]}
                onPress={() => {
                  setShowConfirmModal(false);
                  setShowUploadModal(true);
                }}
                activeOpacity={0.7}>
                <Text style={styles.confirmModalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmModalButton, styles.confirmModalButtonConfirm]}
                onPress={handleUpload}
                activeOpacity={0.7}
                disabled={uploading}>
                {uploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmModalButtonTextConfirm}>Upload</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Floating Upload Button */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={handleImagePicker}
        activeOpacity={0.8}>
        <Icon name="plus" size={24} color="#fff" />
      </TouchableOpacity>
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
    marginBottom: 12,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.cardMuted,
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
  },
  toggleButtonText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  toggleButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    padding: 10,
  },
  row: {
    justifyContent: 'space-between',
  },
  imageContainer: {
    width: '48%',
    aspectRatio: 1,
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  adminActions: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: colors.success + 'CC',
  },
  deleteButton: {
    backgroundColor: colors.danger + 'CC',
  },
  reviewBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.warning + 'CC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  reviewBadgeText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
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
    marginTop: 16,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImageContainer: {
    width: '90%',
    maxWidth: 500,
    height: '90%',
    maxHeight: '90%',
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 10,
    display: 'flex',
    flexDirection: 'column',
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  modalImage: {
    width: '100%',
    height: 350,
    backgroundColor: '#1a1a1a',
  },
  modalHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  modalHeaderDate: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  modalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonModal: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(139, 69, 19, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalInfo: {
    padding: 20,
    flex: 1,
  },
  modalDescriptionSection: {
    marginBottom: 20,
  },
  modalDescriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  modalInfoLabel: {
    fontFamily: fonts.heading,
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  modalDescription: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    padding: 12,
    backgroundColor: colors.cardMuted,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  modalDescriptionEmpty: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
    padding: 12,
    backgroundColor: colors.cardMuted,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.border,
  },
  modalUserSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalUserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  modalUserInfo: {
    flexDirection: 'column',
    gap: 4,
  },
  modalUserName: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  modalUserPhone: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
  modalUser: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  floatingButton: {
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
    shadowRadius: 8,
    elevation: 8,
  },
  uploadModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  uploadModalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  uploadModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  uploadModalTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: colors.text,
  },
  uploadModalContent: {
    padding: 20,
  },
  uploadPreviewImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: colors.cardMuted,
  },
  uploadPlaceholder: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    backgroundColor: colors.cardMuted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  uploadPlaceholderText: {
    marginTop: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
  uploadForm: {
    marginTop: 10,
  },
  uploadLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
    fontWeight: '500',
  },
  uploadDescriptionInput: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.cardMuted,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  uploadModalFooter: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  uploadSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  uploadSelectButtonText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  uploadButtonText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmModalContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  confirmModalTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: colors.text,
    marginBottom: 12,
  },
  confirmModalText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 24,
    lineHeight: 22,
  },
  confirmModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmModalButtonCancel: {
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmModalButtonConfirm: {
    backgroundColor: colors.primary,
  },
  confirmModalButtonTextCancel: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  confirmModalButtonTextConfirm: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
