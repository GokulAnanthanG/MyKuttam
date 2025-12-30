import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  Pressable,
  Platform,
  Alert,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  launchImageLibrary,
  type ImagePickerResponse,
  type MediaType,
} from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/FontAwesome';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { useAuth } from '../context/AuthContext';
import { AppTextInput } from '../components/AppTextInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { RootStackParamList } from '../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const ProfileScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { currentUser, updateProfile, resetPassword, loading, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetPasswordData, setResetPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [formData, setFormData] = useState({
    name: currentUser?.name || '',
    dob: currentUser?.dob ? new Date(currentUser.dob) : undefined,
    father_name: currentUser?.father_name || '',
    address: currentUser?.address || '',
    avatar: currentUser?.avatar || '',
  });
  const [avatarFile, setAvatarFile] = useState<{
    uri: string;
    type: string;
    name: string;
  } | null>(null);

  // Update form data when currentUser changes
  useEffect(() => {
    if (currentUser && !isEditing) {
      setFormData({
        name: currentUser.name || '',
        dob: currentUser.dob ? new Date(currentUser.dob) : undefined,
        father_name: currentUser.father_name || '',
        address: currentUser.address || '',
        avatar: currentUser.avatar || '',
      });
      setAvatarFile(null); // Reset file when user data changes
    }
  }, [currentUser, isEditing]);

  const handleUpdate = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Name is required');
      return;
    }

    const updates: any = {
      name: formData.name.trim(),
      father_name: formData.father_name.trim() || undefined,
      address: formData.address.trim() || undefined,
    };

    if (formData.dob) {
      updates.dob = formData.dob.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    }

    // If avatar is a new file (local URI), include the file object for FormData
    // Otherwise, if it's already a URL, send it as a string
    if (avatarFile) {
      updates.avatarFile = avatarFile;
    } else if (formData.avatar && !formData.avatar.startsWith('file://')) {
      // Only send avatar URL if it's not a local file
      updates.avatar = formData.avatar;
    }

    const success = await updateProfile(updates);
    if (success) {
      setIsEditing(false);
      setAvatarFile(null); // Clear file after successful upload
    }
  };

  const handleImagePicker = () => {
    const options = {
      mediaType: 'photo' as MediaType,
      quality: 0.8 as const,
      maxWidth: 800,
      maxHeight: 800,
    };

    launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.didCancel) {
        return;
      }
      if (response.errorMessage) {
        Alert.alert('Error', response.errorMessage);
        return;
      }
      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        const uri = asset.uri || '';
        const fileName = asset.fileName || `avatar_${Date.now()}.jpg`;
        const type = asset.type || 'image/jpeg';

        // Store the file info for FormData upload
        setAvatarFile({
          uri,
          type,
          name: fileName,
        });

        // Update form data with URI for preview
        setFormData({ ...formData, avatar: uri });
      }
    });
  };

  const formatDate = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => setShowMenu(false),
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setShowMenu(false);
            await logout();
            navigation.replace('Login');
          },
        },
      ],
      { cancelable: true },
    );
  };

  const handleResetPassword = () => {
    setShowMenu(false);
    setShowResetPasswordModal(true);
  };

  const handleResetPasswordSubmit = async () => {
    if (!resetPasswordData.currentPassword.trim()) {
      Alert.alert('Validation Error', 'Current password is required');
      return;
    }
    if (!resetPasswordData.newPassword.trim() || resetPasswordData.newPassword.length < 6) {
      Alert.alert('Validation Error', 'New password must be at least 6 characters');
      return;
    }
    if (resetPasswordData.newPassword !== resetPasswordData.confirmPassword) {
      Alert.alert('Validation Error', 'New passwords do not match');
      return;
    }

    const success = await resetPassword(
      resetPasswordData.currentPassword.trim(),
      resetPasswordData.newPassword.trim(),
    );

    if (success) {
      setShowResetPasswordModal(false);
      setResetPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No user data available</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>My Profile</Text>
          <View style={styles.headerActions}>
            {!isEditing && (
              <Pressable
                onPress={() => {
                  setFormData({
                    name: currentUser.name || '',
                    dob: currentUser.dob ? new Date(currentUser.dob) : undefined,
                    father_name: currentUser.father_name || '',
                    address: currentUser.address || '',
                    avatar: currentUser.avatar || '',
                  });
                  setAvatarFile(null); // Reset file when entering edit mode
                  setIsEditing(true);
                }}
                style={styles.editButton}>
                <Icon name="edit" size={16} color={colors.primary} />
                <Text style={styles.editButtonText}>Edit</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => setShowMenu(true)}
              style={styles.menuButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="ellipsis-v" size={20} color={colors.text} />
            </Pressable>
          </View>
        </View>

        {/* About Link - Before Profile Content */}
        <Pressable
          onPress={() => {
            (navigation as any).navigate('About');
          }}
          style={styles.aboutLink}>
          <View style={styles.aboutLinkContent}>
            <Icon name="info-circle" size={18} color={colors.primary} />
            <Text style={styles.aboutLinkText}>About My Kuttam</Text>
            <Icon name="chevron-right" size={16} color={colors.textMuted} />
          </View>
        </Pressable>

        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            {formData.avatar ? (
              <Image source={{ uri: formData.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Icon name="user" size={50} color={colors.textMuted} />
              </View>
            )}
            {isEditing && (
              <Pressable
                style={styles.avatarEditButton}
                onPress={handleImagePicker}>
                <Icon name="camera" size={18} color="#fff" />
              </Pressable>
            )}
          </View>
          <Text style={styles.userName}>{currentUser.name}</Text>
          <Text style={styles.userRole}>{currentUser.role ? currentUser.role.join(', ') : 'USER'}</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          {/* Personal Information Card */}
          <View style={styles.infoCard}>
            <View style={styles.cardHeader}>
              <Icon name="user" size={18} color={colors.primary} />
              <Text style={styles.cardTitle}>Personal Information</Text>
            </View>

            <View style={styles.cardContent}>
              <AppTextInput
                label="Full Name"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                editable={isEditing}
                placeholder="Enter your full name"
              />

              <View style={styles.inputWrapper}>
                <View style={styles.labelContainer}>
                  <Icon name="calendar" size={14} color={colors.textMuted} />
                  <Text style={styles.label}>Date of Birth</Text>
                </View>
                {isEditing ? (
                  <>
                    <Pressable
                      style={styles.datePickerButton}
                      onPress={() => setShowDatePicker(true)}>
                      <Text
                        style={[
                          styles.datePickerText,
                          !formData.dob && styles.datePickerPlaceholder,
                        ]}>
                        {formData.dob ? formatDate(formData.dob) : 'Select date of birth'}
                      </Text>
                      <Icon name="chevron-down" size={16} color={colors.primary} />
                    </Pressable>
                    {showDatePicker && (
                      <DateTimePicker
                        value={formData.dob || new Date()}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                          setShowDatePicker(Platform.OS === 'ios');
                          if (selectedDate) {
                            setFormData({ ...formData, dob: selectedDate });
                          }
                        }}
                        maximumDate={new Date()}
                      />
                    )}
                  </>
                ) : (
                  <View style={styles.readOnlyFieldContainer}>
                    <Text style={styles.readOnlyText}>
                      {formData.dob ? formatDate(formData.dob) : 'Not set'}
                    </Text>
                  </View>
                )}
              </View>

              <AppTextInput
                label="Father's Name"
                value={formData.father_name}
                onChangeText={(text) =>
                  setFormData({ ...formData, father_name: text })
                }
                editable={isEditing}
                placeholder="Enter father's name"
              />
            </View>
          </View>

          {/* Address Card */}
          <View style={styles.infoCard}>
            <View style={styles.cardHeader}>
              <Icon name="map-marker" size={18} color={colors.primary} />
              <Text style={styles.cardTitle}>Address</Text>
            </View>
            <View style={styles.cardContent}>
              <AppTextInput
                label="Address"
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
                editable={isEditing}
                placeholder="Enter your address"
                multiline
                numberOfLines={3}
                style={styles.textArea}
              />
            </View>
          </View>

          {/* Account Information Card */}
          <View style={styles.infoCard}>
            <View style={styles.cardHeader}>
              <Icon name="info-circle" size={18} color={colors.primary} />
              <Text style={styles.cardTitle}>Account Information</Text>
            </View>
            <View style={styles.cardContent}>
              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Icon name="phone" size={16} color={colors.primary} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Phone Number</Text>
                  <Text style={styles.detailValue}>{currentUser.phone}</Text>
                </View>
              </View>

              <View style={styles.detailDivider} />

              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Icon name="briefcase" size={16} color={colors.primary} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Account Type</Text>
                  <Text style={styles.detailValue}>{currentUser.account_type}</Text>
                </View>
              </View>

              <View style={styles.detailDivider} />

              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Icon name="shield" size={16} color={colors.primary} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Role</Text>
                  <Text style={styles.detailValue}>{currentUser.role ? currentUser.role.join(', ') : 'USER'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          {isEditing && (
            <View style={styles.buttonContainer}>
              <PrimaryButton
                label="Cancel"
                onPress={() => {
                  setFormData({
                    name: currentUser.name || '',
                    dob: currentUser.dob ? new Date(currentUser.dob) : undefined,
                    father_name: currentUser.father_name || '',
                    address: currentUser.address || '',
                    avatar: currentUser.avatar || '',
                  });
                  setAvatarFile(null); // Reset file on cancel
                  setIsEditing(false);
                  setShowDatePicker(false);
                }}
                variant="secondary"
                style={styles.cancelButton}
              />
              <PrimaryButton
                label="Save Changes"
                onPress={handleUpdate}
                loading={loading}
                style={styles.saveButton}
              />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Menu Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}>
        <TouchableWithoutFeedback onPress={() => setShowMenu(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.menuContainer}>
                <Pressable
                  style={styles.menuItem}
                  onPress={handleResetPassword}>
                  <Icon name="key" size={18} color={colors.primary} />
                  <Text style={styles.menuItemText}>Reset Password</Text>
                  <Icon name="chevron-right" size={14} color={colors.textMuted} />
                </Pressable>
                <View style={styles.menuDivider} />
                <Pressable style={[styles.menuItem, styles.menuItemDanger]} onPress={handleLogout}>
                  <Icon name="sign-out" size={18} color={colors.danger} />
                  <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>Logout</Text>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        visible={showResetPasswordModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowResetPasswordModal(false)}>
        <View style={styles.resetPasswordModalOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowResetPasswordModal(false)}>
            <View style={styles.modalContent}>
              <TouchableWithoutFeedback>
                <View style={styles.resetPasswordContainer}>
                  <View style={styles.resetPasswordHeader}>
                    <Text style={styles.resetPasswordTitle}>Reset Password</Text>
                    <Pressable
                      onPress={() => setShowResetPasswordModal(false)}
                      style={styles.closeButton}>
                      <Icon name="times" size={20} color={colors.text} />
                    </Pressable>
                  </View>

                  <View style={styles.resetPasswordForm}>
                    <AppTextInput
                      label="Current Password"
                      placeholder="Enter current password"
                      secureTextEntry
                      value={resetPasswordData.currentPassword}
                      onChangeText={(text) =>
                        setResetPasswordData({ ...resetPasswordData, currentPassword: text })
                      }
                    />

                    <AppTextInput
                      label="New Password"
                      placeholder="Enter new password"
                      secureTextEntry
                      value={resetPasswordData.newPassword}
                      onChangeText={(text) =>
                        setResetPasswordData({ ...resetPasswordData, newPassword: text })
                      }
                    />

                    <AppTextInput
                      label="Confirm New Password"
                      placeholder="Confirm new password"
                      secureTextEntry
                      value={resetPasswordData.confirmPassword}
                      onChangeText={(text) =>
                        setResetPasswordData({ ...resetPasswordData, confirmPassword: text })
                      }
                    />

                    <View style={styles.resetPasswordButtons}>
                      <PrimaryButton
                        label="Cancel"
                        onPress={() => {
                          setShowResetPasswordModal(false);
                          setResetPasswordData({
                            currentPassword: '',
                            newPassword: '',
                            confirmPassword: '',
                          });
                        }}
                        variant="secondary"
                        style={styles.resetPasswordCancelButton}
                      />
                      <PrimaryButton
                        label="Reset Password"
                        onPress={handleResetPasswordSubmit}
                        loading={loading}
                        style={styles.resetPasswordSubmitButton}
                      />
                    </View>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
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
  aboutLink: {
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.primary + '20',
  },
  aboutLinkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aboutLinkText: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textMuted,
  },
  aboutLink: {
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.primary + '20',
  },
  aboutLinkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aboutLinkText: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 30,
    color: colors.text,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editButtonText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  menuButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.cardMuted,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 35,
    backgroundColor: colors.card,
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: colors.cardMuted,
    borderWidth: 4,
    borderColor: colors.card,
  },
  avatarPlaceholder: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: colors.cardMuted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.border,
  },
  avatarEditButton: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  userName: {
    fontFamily: fonts.heading,
    fontSize: 26,
    color: colors.text,
    marginTop: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  userRole: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.primary,
    marginTop: 8,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  formSection: {
    paddingHorizontal: 20,
    marginTop: 25,
    gap: 20,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.text,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cardContent: {
    gap: 4,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: colors.card,
    minHeight: 52,
  },
  datePickerText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
  datePickerPlaceholder: {
    color: colors.textMuted,
  },
  readOnlyFieldContainer: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: colors.cardMuted,
    minHeight: 52,
    justifyContent: 'center',
  },
  readOnlyText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  detailIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  detailValue: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1,
  },
  // Menu Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    width:"100%"
  },
  menuContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  menuItemDanger: {
    // Additional styling for danger items if needed
  },
  menuItemText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  menuItemTextDanger: {
    color: colors.danger,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 12,
  },
  // Reset Password Modal Styles
  resetPasswordModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'stretch', // Stretch to full width instead of center
    width: '100%',
  },
  modalContent: {
    flex: 1,
    justifyContent: 'flex-end',
    width: '100%', // Ensure full screen width
  },
  resetPasswordContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 30,
    height: 520, // Fixed height to prevent size variation
    width: '100%', // Full screen width
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  resetPasswordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resetPasswordTitle: {
    fontFamily: fonts.heading,
    fontSize: 24,
    color: colors.text,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  closeButton: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: colors.cardMuted,
  },
  resetPasswordForm: {
    paddingHorizontal: 20,
    paddingTop: 20,
    flex: 1,
    justifyContent: 'space-between',
  },
  resetPasswordButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  resetPasswordCancelButton: {
    flex: 1,
  },
  resetPasswordSubmitButton: {
    flex: 1,
  },
});
