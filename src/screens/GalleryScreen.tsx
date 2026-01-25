import { useCallback, useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
import { useNavigation } from '@react-navigation/native';
import { ImageZoom } from '@likashefqet/react-native-image-zoom';
import { gestureHandlerRootHOC } from 'react-native-gesture-handler';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { BASE_URL } from '../config/api';
import { GalleryService, type GalleryImage, type GalleryStatus, type GalleryCategory } from '../services/gallery';
import {
  getStoredGalleryImages,
  saveGalleryImagesToRealm,
} from '../storage/galleryRealm';
import { GallerySkeleton } from '../components/GallerySkeleton';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Wrapped component for Android modal support
const ZoomableImageModal = gestureHandlerRootHOC(({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) => (
  <View style={styles.fullscreenOverlay}>
    <TouchableOpacity
      style={styles.fullscreenCloseButton}
      onPress={onClose}
      activeOpacity={0.7}>
      <Icon name="times" size={24} color="#fff" />
    </TouchableOpacity>
    <View style={styles.fullscreenImageContainer}>
      <ImageZoom
        uri={imageUrl}
        minScale={1}
        maxScale={5}
        doubleTapScale={3}
        isPanEnabled={true}
        isPinchEnabled={true}
        isSingleTapEnabled={true}
        isDoubleTapEnabled={true}
        onSingleTap={onClose}
        style={styles.fullscreenImage}
        resizeMode="contain"
        onError={() => {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Failed to load image',
          });
        }}
      />
    </View>
  </View>
));

export const GalleryScreen = () => {
  const { currentUser } = useAuth();
  const navigation = useNavigation();
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
  const [uploadCategoryId, setUploadCategoryId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [showFullscreenImage, setShowFullscreenImage] = useState(false);
  const isFetchingRef = useRef(false);
  const hasShownOfflineToastRef = useRef(false);
  const [categories, setCategories] = useState<GalleryCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const categoriesScrollRef = useRef<ScrollView>(null);
  const [showCategoryManageModal, setShowCategoryManageModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [showCategoryUpdateModal, setShowCategoryUpdateModal] = useState(false);
  const [updatingImageCategory, setUpdatingImageCategory] = useState(false);
  const [showUploadCategoryDropdown, setShowUploadCategoryDropdown] = useState(false);
  const [showFriendsFamilyInfo, setShowFriendsFamilyInfo] = useState(false);

  const isAdmin = currentUser?.role && currentUser.role.some(r => ['ADMIN', 'SUB_ADMIN'].includes(r));

  const fetchImages = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      // Prevent multiple simultaneous calls
      if (isFetchingRef.current) {
        return;
      }

      // Check network status before making API call
      const netInfo = await NetInfo.fetch();
      const isConnected = netInfo.isConnected ?? false;
      setIsOnline(isConnected);

      if (!isConnected) {
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
        // Pass selected category (null means "All" - no filter)
        const response = await GalleryService.getGalleryImages(pageNum, 10, apiStatus, selectedCategoryId);

        // Ensure we have valid response data
        const imagesData = response?.data?.images || [];
        
        
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
    [isAdmin, status, selectedCategoryId],
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

  // Deep link handling - open gallery image when deep link is clicked
  useEffect(() => {
    // Handle deep link when app is already open
    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      // Parse deep link: mykuttam://gallery/:id
      const deepLinkMatch = url.match(/mykuttam:\/\/gallery\/(.+)/);
      if (deepLinkMatch && deepLinkMatch[1]) {
        const imageId = deepLinkMatch[1];
        // Navigate to Gallery tab if not already there
        (navigation as any).navigate('MainTabs', {
          screen: 'Gallery',
        });
        // Small delay to ensure navigation completes
        setTimeout(() => {
          // Find the image in current list
          const image = images.find((img) => img.id === imageId);
          if (image) {
            setSelectedImage(image);
            setShowFullscreenImage(true);
          } else {
            // If image not loaded yet, fetch it
            fetchGalleryImageById(imageId);
          }
        }, 300);
        return;
      }

      // Parse web URL: https://domain.com/gallery/:id
      const webUrlMatch = url.match(/https?:\/\/[^\/]+\/gallery\/(.+)/);
      if (webUrlMatch && webUrlMatch[1]) {
        const imageId = webUrlMatch[1];
        // Navigate to Gallery tab if not already there
        (navigation as any).navigate('MainTabs', {
          screen: 'Gallery',
        });
        // Small delay to ensure navigation completes
        setTimeout(() => {
          // Find the image in current list
          const image = images.find((img) => img.id === imageId);
          if (image) {
            setSelectedImage(image);
            setShowFullscreenImage(true);
          } else {
            // If image not loaded yet, fetch it
            fetchGalleryImageById(imageId);
          }
        }, 300);
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
  }, [images, navigation]);

  const fetchGalleryImageById = async (imageId: string) => {
    try {
      const response = await GalleryService.getGalleryImageById(imageId);
      if (response.success && response.data) {
        setSelectedImage(response.data);
        setShowFullscreenImage(true);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Image not found',
          text2: 'The gallery image you are trying to view does not exist.',
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load gallery image.',
      });
    }
  };

  const fetchCategories = useCallback(async () => {
    try {
      setLoadingCategories(true);
      const response = await GalleryService.getGalleryCategories();
      if (response.success && response.data) {
        setCategories(response.data);
      }
    } catch (error) {
      // Silently fail - categories are optional
      console.warn('Failed to fetch gallery categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || creatingCategory) {
      return;
    }

    try {
      setCreatingCategory(true);
      const response = await GalleryService.createCategory(newCategoryName.trim());
      
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
              const response = await GalleryService.deleteCategory(categoryId);
              
              if (response.success) {
                Toast.show({
                  type: 'success',
                  text1: 'Success',
                  text2: 'Category deleted successfully',
                  visibilityTime: 2000,
                });
                // Refresh categories list
                await fetchCategories();
                // If deleted category was selected, reset to "All"
                if (selectedCategoryId === categoryId) {
                  setSelectedCategoryId(null);
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

  const handleUpdateImageCategory = async (categoryId: string | null) => {
    if (!selectedImage) return;

    try {
      setUpdatingImageCategory(true);
      const response = await GalleryService.updateImageCategory(selectedImage.id, categoryId);
      
      if (response.success && response.data) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Image category updated successfully',
          visibilityTime: 2000,
        });
        // Update selected image with new category data
        setSelectedImage(response.data);
        // Refresh images list to reflect the change
        if (isOnline) {
          fetchImages(page, false);
        }
        setShowCategoryUpdateModal(false);
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error instanceof Error ? error.message : 'Failed to update image category',
        visibilityTime: 3000,
      });
    } finally {
      setUpdatingImageCategory(false);
    }
  };

  useEffect(() => {
    // Fetch categories on mount
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    // Reset when status or category changes and fetch new images
    setPage(1);
    setHasMore(true);
    setImages([]);
    hasShownOfflineToastRef.current = false; // Reset toast flag on status/category change
    fetchImages(1, false);
  }, [status, selectedCategoryId, fetchImages]);

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

  const generateGalleryDeepLink = (imageId: string): string => {
    // Generate deep link for gallery image
    // Format: mykuttam://gallery/:id
    return `mykuttam://gallery/${imageId}`;
  };

  const generateGalleryWebUrl = (imageId: string): string => {
    // Generate web URL for sharing (more compatible with messaging apps)
    // Backend serves HTML pages at GET /gallery/:id (not /api/gallery/:id)
    // This endpoint includes Open Graph tags for rich link previews
    // Always use BASE_URL from environment variable
    if (!BASE_URL) {
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
    
    return `${baseUrl}/gallery/${imageId}`;
  };

  const handleShareImage = async (image: GalleryImage) => {
    try {
      const deepLink = generateGalleryDeepLink(image.id);
      const webUrl = generateGalleryWebUrl(image.id);
      
      // Format like Instagram - URL first, then description
      // This helps messaging apps recognize it as a link and show preview
      const description = image.description || 'Check out this image from the gallery';
      const message = `${webUrl}\n\n${description}`;
      
      // For iOS, use url property for better link preview support
      // For Android, put URL at the start of message for better recognition
      const shareContent = Platform.OS === 'ios' 
        ? {
            url: webUrl, // iOS: URL property helps with link preview
            message: description,
            title: 'Gallery Image',
          }
        : {
            message: message, // Android: URL in message for better recognition
            title: 'Gallery Image',
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
        text2: error instanceof Error ? error.message : 'Unable to share image',
      });
    }
  };

  const handleCategorySelection = (categoryId: string) => {
    setUploadCategoryId(categoryId);
    setShowUploadCategoryDropdown(false);
    
    // Check if selected category is "Friends and Family" (case-insensitive, handles variations)
    const selectedCategory = categories.find((c) => c.id === categoryId);
    if (selectedCategory) {
      const categoryName = selectedCategory.name.toLowerCase().trim();
      // Check for various forms: "friends and family", "friends & family", "friendsandfamily", etc.
      const isFriendsAndFamily = 
        categoryName.includes('friends') && 
        (categoryName.includes('family') || categoryName.includes('famil'));
      
      if (isFriendsAndFamily) {
        setShowFriendsFamilyInfo(true);
        // Auto-hide after 10 seconds
        setTimeout(() => {
          setShowFriendsFamilyInfo(false);
        }, 10000);
      }
    }
  };

  const handleImagePicker = async () => {
    const options = {
      mediaType: 'photo' as MediaType,
      quality: 0.8 as const,
      maxWidth: 1920,
      maxHeight: 1920,
    };

    launchImageLibrary(options, async (response: ImagePickerResponse) => {
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
        // Fetch categories when opening upload modal
        await fetchCategories();
        setShowUploadModal(true);
      }
    });
  };

  const handleUpload = async () => {
    if (!selectedImageUri) return;

    // Validate category is selected
    if (!uploadCategoryId) {
      Toast.show({
        type: 'error',
        text1: 'Category Required',
        text2: 'Please select a category for the image',
        visibilityTime: 3000,
      });
      return;
    }

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
      await GalleryService.uploadImage(selectedImageUri, uploadCategoryId, uploadDescription);
      Toast.show({
        type: 'success',
        text1: 'Image Uploaded',
        text2: 'Your image has been uploaded successfully. It will appear in the gallery once approved by admin.',
        visibilityTime: 6000,
      });
      // Reset form
      setSelectedImageUri(null);
      setUploadDescription('');
      setUploadCategoryId(null);
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
    
    // Validate category is selected
    if (!uploadCategoryId) {
      Toast.show({
        type: 'error',
        text1: 'Category Required',
        text2: 'Please select a category for the image',
        visibilityTime: 3000,
      });
      return;
    }
    
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

      {/* Categories Row */}
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
                  <TouchableOpacity
                    style={styles.shareButtonModal}
                    onPress={() => {
                      if (selectedImage) {
                        handleShareImage(selectedImage);
                      }
                    }}
                    activeOpacity={0.7}>
                    <Icon name="share" size={16} color="#fff" />
                  </TouchableOpacity>
                  {selectedImage && isAdmin && (
                    <TouchableOpacity
                      style={styles.updateCategoryButtonModal}
                      onPress={() => {
                        setShowCategoryUpdateModal(true);
                        // Refresh categories when opening update modal
                        fetchCategories();
                      }}
                      activeOpacity={0.7}>
                      <Icon name="tags" size={16} color="#fff" />
                    </TouchableOpacity>
                  )}
                  {selectedImage && (isImageOwner(selectedImage) || isAdmin) && (
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
                <TouchableOpacity
                  onPress={() => setShowFullscreenImage(true)}
                  activeOpacity={0.9}>
                  <Image
                    source={{ uri: selectedImage.image_url }}
                    style={styles.modalImage}
                    resizeMode="contain"
                    onError={(error) => {
                      Toast.show({
                        type: 'error',
                        text1: 'Error',
                        text2: 'Failed to load image',
                      });
                    }}
                    onLoad={() => {
                    }}
                  />
                </TouchableOpacity>
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

                  {/* Category Section */}
                  {selectedImage.category && (
                    <View style={styles.modalCategorySection}>
                      <View style={styles.modalCategoryHeader}>
                        <Icon name="tags" size={16} color={colors.primary} />
                        <Text style={styles.modalInfoLabel}>Category</Text>
                      </View>
                      <Text style={styles.modalCategoryName}>{selectedImage.category.name}</Text>
                    </View>
                  )}

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
          setUploadCategoryId(null);
          setShowUploadCategoryDropdown(false);
          setShowFriendsFamilyInfo(false);
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
                  setUploadCategoryId(null);
                  setShowUploadCategoryDropdown(false);
                  setShowFriendsFamilyInfo(false);
                }}>
                <Icon name="times" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.uploadModalContent}
              contentContainerStyle={styles.uploadModalContentContainer}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}>
              {selectedImageUri ? (
                <Image source={{ uri: selectedImageUri }} style={styles.uploadPreviewImage} />
              ) : (
                <Pressable style={styles.uploadPlaceholder} onPress={handleImagePicker}>
                  <Icon name="camera" size={48} color={colors.textMuted} />
                  <Text style={styles.uploadPlaceholderText}>Tap to select image</Text>
                </Pressable>
              )}

              <View style={styles.uploadForm}>
                <Text style={styles.uploadLabel}>Category <Text style={styles.requiredAsterisk}>*</Text></Text>
                {loadingCategories && categories.length === 0 ? (
                  <View style={styles.uploadCategoryLoading}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.uploadCategoryLoadingText}>Loading categories...</Text>
                  </View>
                ) : categories.length === 0 ? (
                  <View style={styles.uploadCategoryEmpty}>
                    <Text style={styles.uploadCategoryEmptyText}>No categories available</Text>
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
                          : 'Choose category'}
                      </Text>
                      <Icon
                        name={showUploadCategoryDropdown ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={colors.textMuted}
                      />
                    </Pressable>
                    {showUploadCategoryDropdown && (
                      <View style={styles.selectBoxDropdown}>
                          <ScrollView
                            style={styles.selectBoxDropdownScroll}
                            nestedScrollEnabled={true}
                            showsVerticalScrollIndicator={true}>
                            {categories.map((category) => (
                              <Pressable
                                key={category.id}
                                style={[
                                  styles.selectBoxOption,
                                  uploadCategoryId === category.id && styles.selectBoxOptionActive,
                                ]}
                                onPress={() => handleCategorySelection(category.id)}
                                android_ripple={{ color: colors.primary + '20' }}>
                                <Text
                                  style={[
                                    styles.selectBoxOptionText,
                                    uploadCategoryId === category.id && styles.selectBoxOptionTextActive,
                                  ]}>
                                  {category.name}
                                </Text>
                                {uploadCategoryId === category.id && (
                                  <Icon name="check" size={16} color={colors.primary} />
                                )}
                              </Pressable>
                            ))}
                          </ScrollView>
                        </View>
                    )}
                  </View>
                )}
                {!uploadCategoryId && selectedImageUri && (
                  <Text style={styles.uploadCategoryError}>Please select a category</Text>
                )}
              </View>

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
                  style={[
                    styles.uploadButton,
                    (!uploadCategoryId || uploading) && styles.uploadButtonDisabled,
                  ]}
                  onPress={handleConfirmUpload}
                  activeOpacity={0.7}
                  disabled={!uploadCategoryId || uploading}>
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

      {/* Friends and Family Info Modal */}
      <Modal
        visible={showFriendsFamilyInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFriendsFamilyInfo(false)}>
        <Pressable
          style={styles.infoModalOverlay}
          onPress={() => setShowFriendsFamilyInfo(false)}>
          <View
            style={styles.infoModalContainer}
            onStartShouldSetResponder={() => true}
            onResponderTerminationRequest={() => false}>
            <View style={styles.infoModalHeader}>
              <Icon name="info-circle" size={24} color={colors.primary} />
              <Text style={styles.infoModalTitle}>அனுமதி தேவை</Text>
            </View>
            <View style={styles.infoModalContent}>
              <Text style={styles.infoModalText}>
                உங்கள் நண்பர்கள் மற்றும் குடும்பத்தினரின் புகைப்படங்களை பதிவேற்றும் போது, அவர்களின் அனுமதி பெற்ற பிறகே பதிவேற்றவும்.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.infoModalCloseButton}
              onPress={() => setShowFriendsFamilyInfo(false)}
              activeOpacity={0.7}>
              <Text style={styles.infoModalCloseButtonText}>புரிந்துகொண்டேன்</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowConfirmModal(false);
          setShowUploadModal(true);
        }}>
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

      {/* Fullscreen Image Modal */}
      {selectedImage && (
        <Modal
          visible={showFullscreenImage}
          transparent
          animationType="fade"
          onRequestClose={() => setShowFullscreenImage(false)}>
          <ZoomableImageModal
            imageUrl={selectedImage.image_url}
            onClose={() => setShowFullscreenImage(false)}
          />
        </Modal>
      )}

      {/* Category Update Modal */}
      <Modal
        visible={showCategoryUpdateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryUpdateModal(false)}>
        <View style={styles.categoryUpdateModalOverlay}>
          <View style={styles.categoryUpdateModalContainer}>
            <View style={styles.categoryUpdateModalHeader}>
              <Text style={styles.categoryUpdateModalTitle}>Update Category</Text>
              <TouchableOpacity
                onPress={() => setShowCategoryUpdateModal(false)}
                disabled={updatingImageCategory}>
                <Icon name="times" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.categoryUpdateModalContentContainer}>
              <Text style={styles.categoryUpdateModalSubtitle}>
                Select a category for this image
              </Text>

              {loadingCategories && categories.length === 0 ? (
                <View style={styles.categoryUpdateLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.categoryUpdateLoadingText}>Loading categories...</Text>
                </View>
              ) : (
                <View style={styles.categoryUpdateChipsContainer}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryUpdateChipsScrollContent}>
                    {/* Remove Category Option */}
                    <TouchableOpacity
                      style={[
                        styles.categoryUpdateChip,
                        !selectedImage?.category && styles.categoryUpdateChipActive,
                      ]}
                      onPress={() => handleUpdateImageCategory(null)}
                      disabled={updatingImageCategory}
                      activeOpacity={0.7}>
                      <Text
                        style={[
                          styles.categoryUpdateChipText,
                          !selectedImage?.category && styles.categoryUpdateChipTextActive,
                        ]}>
                        Remove
                      </Text>
                    </TouchableOpacity>

                    {/* Category Chips */}
                    {categories.map((category) => (
                      <TouchableOpacity
                        key={category.id}
                        style={[
                          styles.categoryUpdateChip,
                          selectedImage?.category?.id === category.id &&
                            styles.categoryUpdateChipActive,
                        ]}
                        onPress={() => handleUpdateImageCategory(category.id)}
                        disabled={updatingImageCategory}
                        activeOpacity={0.7}>
                        <Text
                          style={[
                            styles.categoryUpdateChipText,
                            selectedImage?.category?.id === category.id &&
                              styles.categoryUpdateChipTextActive,
                          ]}>
                          {category.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
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
  shareButtonModal: {
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
    flex: 1,
    flexDirection: 'column',
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
    flex: 1,
  },
  uploadModalContentContainer: {
    padding: 20,
    paddingBottom: 30,
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
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
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
  uploadButtonDisabled: {
    backgroundColor: colors.textMuted,
    opacity: 0.6,
  },
  requiredAsterisk: {
    color: colors.danger,
    fontSize: 14,
  },
  uploadCategoryLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  uploadCategoryLoadingText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
  uploadCategoryEmpty: {
    paddingVertical: 12,
  },
  uploadCategoryEmptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  uploadCategoryScroll: {
    maxHeight: 60,
  },
  uploadCategoryScrollContent: {
    gap: 8,
    paddingVertical: 4,
  },
  uploadCategoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  uploadCategoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  uploadCategoryChipText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  uploadCategoryChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  uploadCategoryError: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.danger,
    marginTop: 4,
    fontStyle: 'italic',
  },
  selectBoxContainer: {
    position: 'relative',
    zIndex: 10,
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
  selectBoxDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
    zIndex: 1000,
    overflow: 'visible',
  },
  selectBoxDropdownScroll: {
    maxHeight: 200,
  },
  selectBoxOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectBoxOptionActive: {
    backgroundColor: colors.cardMuted,
  },
  selectBoxOptionText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  selectBoxOptionTextActive: {
    color: colors.primary,
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
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImageContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  fullscreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  fullscreenCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
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
  updateCategoryButtonModal: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCategorySection: {
    marginBottom: 20,
  },
  modalCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  modalCategoryName: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
    padding: 12,
    backgroundColor: colors.cardMuted,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  categoryUpdateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  categoryUpdateModalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 20,
    overflow: 'visible',
  },
  categoryUpdateModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryUpdateModalTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: colors.text,
    fontWeight: '600',
  },
  categoryUpdateModalContent: {
    flex: 1,
  },
  categoryUpdateModalContentContainer: {
    padding: 20,
  },
  categoryUpdateModalSubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 16,
  },
  categoryUpdateLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
    justifyContent: 'center',
  },
  categoryUpdateLoadingText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
  categoryUpdateOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.cardMuted,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryUpdateOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryUpdateOptionText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  categoryUpdateOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  categoryUpdateChipsContainer: {
    marginTop: 12,
  },
  categoryUpdateChipsScrollContent: {
    paddingRight: 20,
    gap: 8,
  },
  categoryUpdateChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  categoryUpdateChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryUpdateChipText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  categoryUpdateChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  infoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoModalContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    overflow: 'hidden',
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardMuted,
  },
  infoModalTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
  },
  infoModalContent: {
    padding: 20,
  },
  infoModalText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
    textAlign: 'left',
  },
  infoModalCloseButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    margin: 20,
    marginTop: 0,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoModalCloseButtonText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
