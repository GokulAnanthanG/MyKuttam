import { useState, useEffect, useRef } from 'react';
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
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
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
import RBSheet from 'react-native-raw-bottom-sheet';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { useAuth } from '../context/AuthContext';
import { AppTextInput } from '../components/AppTextInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { RootStackParamList } from '../navigation/AppNavigator';
import { UserService, type User } from '../services/user';
import { UserRole, AccountStatus, AccountType } from '../types/user';

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
  const [showRoleUpdateModal, setShowRoleUpdateModal] = useState(false);
  const [roleUpdateData, setRoleUpdateData] = useState({
    phone: '',
    roles: [] as UserRole[],
  });
  const [updatingRole, setUpdatingRole] = useState(false);
  
  // Users list modal state
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [refreshingUsers, setRefreshingUsers] = useState(false);
  const [usersPage, setUsersPage] = useState(1);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [usersFilters, setUsersFilters] = useState<{
    status?: AccountStatus;
    account_type?: AccountType;
    role?: UserRole;
  }>({});
  const [expandedAddressUserId, setExpandedAddressUserId] = useState<string | null>(null);
  const usersSheetRef = useRef<any>(null);

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

  // Check if current user is ADMIN (not SUB_ADMIN)
  const isAdmin = () => {
    if (!currentUser) return false;
    return currentUser.role && currentUser.role.includes('ADMIN');
  };

  // Check if current user is ADMIN or SUB_ADMIN
  const isAdminOrSubAdmin = () => {
    if (!currentUser) return false;
    return currentUser.role && currentUser.role.some(r => ['ADMIN', 'SUB_ADMIN'].includes(r));
  };

  // Fetch users with pagination and filters
  const fetchUsers = async (page: number = 1, append: boolean = false) => {
    try {
      if (page === 1) {
        setLoadingUsers(true);
      } else {
        setRefreshingUsers(true);
      }

      const response = await UserService.getUsers({
        page,
        limit: 10,
        ...usersFilters,
      });

      if (response.success && response.data) {
        if (append) {
          setUsers((prev) => [...prev, ...response.data!.users]);
        } else {
          setUsers(response.data.users);
        }

        const totalPages = response.data.pagination?.totalPages || 0;
        const total = response.data.pagination?.total || 0;
        setHasMoreUsers(page < totalPages);
        setUsersPage(page);
        setTotalUsersCount(total);
      }
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to fetch users',
      );
      if (!append) {
        setUsers([]);
      }
      setHasMoreUsers(false);
    } finally {
      setLoadingUsers(false);
      setRefreshingUsers(false);
    }
  };

  // Handle users modal open
  const handleOpenUsersModal = () => {
    setUsersPage(1);
    setHasMoreUsers(true);
    setUsersFilters({});
    setExpandedAddressUserId(null);
    setTotalUsersCount(0);
    if (usersSheetRef.current) {
      usersSheetRef.current.open();
    }
    fetchUsers(1, false);
  };

  // Handle filter change
  const handleFilterChange = async (filterType: 'status' | 'account_type' | 'role', value?: string) => {
    const newFilters = { ...usersFilters };
    if (value) {
      newFilters[filterType] = value as any;
    } else {
      delete newFilters[filterType];
    }
    setUsersFilters(newFilters);
    setUsersPage(1);
    setHasMoreUsers(true);
    setLoadingUsers(true);

    try {
      const response = await UserService.getUsers({
        page: 1,
        limit: 10,
        ...newFilters,
      });

      if (response.success && response.data) {
        setUsers(response.data.users);
        const totalPages = response.data.pagination?.totalPages || 0;
        const total = response.data.pagination?.total || 0;
        setHasMoreUsers(1 < totalPages);
        setUsersPage(1);
        setTotalUsersCount(total);
      }
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to fetch users',
      );
      setUsers([]);
      setHasMoreUsers(false);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Load more users
  const handleLoadMoreUsers = () => {
    if (!loadingUsers && hasMoreUsers) {
      fetchUsers(usersPage + 1, true);
    }
  };

  // Refresh users
  const handleRefreshUsers = () => {
    setUsersPage(1);
    setHasMoreUsers(true);
    fetchUsers(1, false);
  };

  // Available roles for selection
  const availableRoles: UserRole[] = ['ADMIN', 'SUB_ADMIN', 'HELPER', 'DONATION_MANAGER', 'USER'];

  const handleRoleToggle = (role: UserRole) => {
    setRoleUpdateData((prev) => {
      const isSelected = prev.roles.includes(role);
      if (isSelected) {
        return {
          ...prev,
          roles: prev.roles.filter((r) => r !== role),
        };
      } else {
        return {
          ...prev,
          roles: [...prev.roles, role],
        };
      }
    });
  };

  const handleUpdateRole = async () => {
    if (!roleUpdateData.phone.trim()) {
      Alert.alert('Validation Error', 'Phone number is required');
      return;
    }

    if (roleUpdateData.phone.trim().length !== 10) {
      Alert.alert('Validation Error', 'Phone number must be exactly 10 digits');
      return;
    }

    if (roleUpdateData.roles.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one role');
      return;
    }

    try {
      setUpdatingRole(true);
      const response = await UserService.updateUserRole(
        roleUpdateData.phone.trim(),
        roleUpdateData.roles,
      );

      if (response.success) {
        Alert.alert('Success', 'User role updated successfully', [
          {
            text: 'OK',
            onPress: () => {
              setShowRoleUpdateModal(false);
              setRoleUpdateData({
                phone: '',
                roles: [],
              });
            },
          },
        ]);
      }
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to update user role',
      );
    } finally {
      setUpdatingRole(false);
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

      {/* Update User Role Modal */}
      <Modal
        visible={showRoleUpdateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRoleUpdateModal(false)}>
        <View style={styles.resetPasswordModalOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowRoleUpdateModal(false)}>
            <View style={styles.modalContent}>
              <TouchableWithoutFeedback>
                <View style={styles.roleUpdateContainer}>
                  <View style={styles.resetPasswordHeader}>
                    <Text style={styles.resetPasswordTitle}>Update User Role</Text>
                    <Pressable
                      onPress={() => {
                        setShowRoleUpdateModal(false);
                        setRoleUpdateData({
                          phone: '',
                          roles: [],
                        });
                      }}
                      style={styles.closeButton}>
                      <Icon name="times" size={20} color={colors.text} />
                    </Pressable>
                  </View>

                  <ScrollView
                    style={styles.roleUpdateScrollView}
                    contentContainerStyle={styles.roleUpdateForm}
                    showsVerticalScrollIndicator={true}>
                    <AppTextInput
                      label="Phone Number"
                      placeholder="Enter 10-digit phone number"
                      value={roleUpdateData.phone}
                      onChangeText={(text) => {
                        // Only allow numbers
                        const numericText = text.replace(/[^0-9]/g, '');
                        if (numericText.length <= 10) {
                          setRoleUpdateData({ ...roleUpdateData, phone: numericText });
                        }
                      }}
                      keyboardType="phone-pad"
                      maxLength={10}
                    />

                    <View style={styles.rolesSection}>
                      <Text style={styles.rolesSectionTitle}>Select Roles</Text>
                      <View style={styles.rolesList}>
                        {availableRoles.map((role) => {
                          const isSelected = roleUpdateData.roles.includes(role);
                          return (
                            <TouchableOpacity
                              key={role}
                              style={[
                                styles.roleCheckbox,
                                isSelected && styles.roleCheckboxSelected,
                              ]}
                              onPress={() => handleRoleToggle(role)}>
                              <View
                                style={[
                                  styles.roleCheckboxInner,
                                  isSelected && styles.roleCheckboxInnerSelected,
                                ]}>
                                {isSelected && (
                                  <Icon name="check" size={16} color={colors.primary} />
                                )}
                              </View>
                              <Text
                                style={[
                                  styles.roleCheckboxText,
                                  isSelected && styles.roleCheckboxTextSelected,
                                ]}>
                                {role}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    <View style={styles.resetPasswordButtons}>
                      <PrimaryButton
                        label="Cancel"
                        onPress={() => {
                          setShowRoleUpdateModal(false);
                          setRoleUpdateData({
                            phone: '',
                            roles: [],
                          });
                        }}
                        variant="secondary"
                        style={styles.resetPasswordCancelButton}
                      />
                      <PrimaryButton
                        label="Update Role"
                        onPress={handleUpdateRole}
                        loading={updatingRole}
                        style={styles.resetPasswordSubmitButton}
                      />
                    </View>
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </Modal>

      {/* Users List Bottom Sheet */}
      <RBSheet
        ref={usersSheetRef}
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
        onClose={() => {
          setExpandedAddressUserId(null);
        }}>
        <View style={styles.bottomSheetContent}>
          <View style={styles.bottomSheetHeader}>
            <Text style={styles.bottomSheetTitle}>
              All Users{totalUsersCount > 0 ? ` (${totalUsersCount})` : ''}
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (usersSheetRef.current) {
                  usersSheetRef.current.close();
                }
              }}
              style={styles.bottomSheetCloseButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="times" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Filters */}
          <View style={styles.filtersContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
                      <TouchableOpacity
                        style={[
                          styles.filterChip,
                          !usersFilters.status && styles.filterChipActive,
                        ]}
                        onPress={() => handleFilterChange('status')}>
                        <Text
                          style={[
                            styles.filterChipText,
                            !usersFilters.status && styles.filterChipTextActive,
                          ]}>
                          All Status
                        </Text>
                      </TouchableOpacity>
                      {(['ACTIVE', 'SUSPENDED', 'BLOCK'] as AccountStatus[]).map((status) => (
                        <TouchableOpacity
                          key={status}
                          style={[
                            styles.filterChip,
                            usersFilters.status === status && styles.filterChipActive,
                          ]}
                          onPress={() => handleFilterChange('status', status)}>
                          <Text
                            style={[
                              styles.filterChipText,
                              usersFilters.status === status && styles.filterChipTextActive,
                            ]}>
                            {status}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
                      <TouchableOpacity
                        style={[
                          styles.filterChip,
                          !usersFilters.account_type && styles.filterChipActive,
                        ]}
                        onPress={() => handleFilterChange('account_type')}>
                        <Text
                          style={[
                            styles.filterChipText,
                            !usersFilters.account_type && styles.filterChipTextActive,
                          ]}>
                          All Types
                        </Text>
                      </TouchableOpacity>
                      {(['COMMON', 'MANAGEMENT'] as AccountType[]).map((type) => (
                        <TouchableOpacity
                          key={type}
                          style={[
                            styles.filterChip,
                            usersFilters.account_type === type && styles.filterChipActive,
                          ]}
                          onPress={() => handleFilterChange('account_type', type)}>
                          <Text
                            style={[
                              styles.filterChipText,
                              usersFilters.account_type === type && styles.filterChipTextActive,
                            ]}>
                            {type}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
                      <TouchableOpacity
                        style={[
                          styles.filterChip,
                          !usersFilters.role && styles.filterChipActive,
                        ]}
                        onPress={() => handleFilterChange('role')}>
                        <Text
                          style={[
                            styles.filterChipText,
                            !usersFilters.role && styles.filterChipTextActive,
                          ]}>
                          All Roles
                        </Text>
                      </TouchableOpacity>
                      {availableRoles.map((role) => (
                        <TouchableOpacity
                          key={role}
                          style={[
                            styles.filterChip,
                            usersFilters.role === role && styles.filterChipActive,
                          ]}
                          onPress={() => handleFilterChange('role', role)}>
                          <Text
                            style={[
                              styles.filterChipText,
                              usersFilters.role === role && styles.filterChipTextActive,
                            ]}>
                            {role}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

          {/* Users List */}
          {loadingUsers && users.length === 0 ? (
            <View style={styles.usersLoadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <FlatList
                data={users}
                keyExtractor={(item) => item.id}
                style={styles.usersFlatList}
                renderItem={({ item }) => (
                        <View style={styles.userCard}>
                          <View style={styles.userCardHeader}>
                            {item.avatar ? (
                              <Image source={{ uri: item.avatar }} style={styles.userAvatar} />
                            ) : (
                              <View style={styles.userAvatarPlaceholder}>
                                <Icon name="user" size={20} color={colors.textMuted} />
                              </View>
                            )}
                            <View style={styles.userCardInfo}>
                              <Text style={styles.userCardName}>{item.name}</Text>
                              <Text style={styles.userCardPhone}>{item.phone}</Text>
                            </View>
                            <View
                              style={[
                                styles.userStatusBadge,
                                item.status === 'ACTIVE' && styles.userStatusBadgeActive,
                                item.status === 'SUSPENDED' && styles.userStatusBadgeSuspended,
                                item.status === 'BLOCK' && styles.userStatusBadgeBlock,
                              ]}>
                              <Text
                                style={[
                                  styles.userStatusText,
                                  item.status === 'ACTIVE' && styles.userStatusTextActive,
                                ]}>
                                {item.status}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.userCardDetails}>
                            <View style={styles.userDetailRow}>
                              <Icon name="briefcase" size={14} color={colors.textMuted} />
                              <Text style={styles.userDetailText}>{item.account_type}</Text>
                            </View>
                            <View style={styles.userDetailRow}>
                              <Icon name="shield" size={14} color={colors.textMuted} />
                              <Text style={styles.userDetailText}>
                                {item.role.join(', ')}
                              </Text>
                            </View>
                            {item.report_count > 0 && (
                              <View style={styles.userDetailRow}>
                                <Icon name="exclamation-triangle" size={14} color={colors.danger} />
                                <Text style={[styles.userDetailText, styles.userReportCount]}>
                                  {item.report_count} report{item.report_count !== 1 ? 's' : ''}
                                </Text>
                              </View>
                            )}
                          </View>
                          
                          {/* Address Accordion */}
                          {item.address && (
                            <View style={styles.addressAccordionContainer}>
                              <TouchableOpacity
                                style={styles.addressAccordionHeader}
                                onPress={() => {
                                  setExpandedAddressUserId(
                                    expandedAddressUserId === item.id ? null : item.id
                                  );
                                }}
                                activeOpacity={0.7}>
                                <View style={styles.addressAccordionHeaderContent}>
                                  <Icon name="map-marker" size={14} color={colors.primary} />
                                  <Text style={styles.addressAccordionTitle}>Address</Text>
                                </View>
                                <Icon
                                  name={expandedAddressUserId === item.id ? 'chevron-up' : 'chevron-down'}
                                  size={14}
                                  color={colors.textMuted}
                                />
                              </TouchableOpacity>
                              {expandedAddressUserId === item.id && (
                                <View style={styles.addressAccordionContent}>
                                  <Text style={styles.addressText}>{item.address}</Text>
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      )}
                contentContainerStyle={styles.usersListContent}
                onEndReached={handleLoadMoreUsers}
                onEndReachedThreshold={0.5}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshingUsers}
                    onRefresh={handleRefreshUsers}
                    tintColor={colors.primary}
                  />
                }
                ListFooterComponent={
                  loadingUsers && users.length > 0 ? (
                    <View style={styles.usersFooterLoader}>
                      <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                  ) : null
                }
                ListEmptyComponent={
                  !loadingUsers ? (
                    <View style={styles.usersEmptyContainer}>
                      <Icon name="users" size={48} color={colors.textMuted} />
                      <Text style={styles.usersEmptyText}>No users found</Text>
                      <Text style={styles.usersEmptySubtext}>
                        Try adjusting your filters
                      </Text>
                    </View>
                  ) : null
                }
              />
            </View>
          )}
        </View>
      </RBSheet>

      {/* Floating Action Buttons - Only visible to ADMIN/SUB_ADMIN */}
      {isAdminOrSubAdmin() && (
        <>
          {/* View Users Button */}
          <TouchableOpacity
            style={[styles.fab, styles.fabUsers]}
            onPress={handleOpenUsersModal}
            activeOpacity={0.8}>
            <Icon name="users" size={24} color="#fff" />
          </TouchableOpacity>
          {/* Update Role Button - Only visible to ADMIN */}
      {isAdmin() && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowRoleUpdateModal(true)}
          activeOpacity={0.8}>
          <Icon name="user-plus" size={24} color="#fff" />
        </TouchableOpacity>
          )}
        </>
      )}
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
  // Role Update Modal Styles
  roleUpdateContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 0,
    maxHeight: '85%',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
    flex: 1,
  },
  roleUpdateScrollView: {
    flex: 1,
  },
  roleUpdateForm: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  rolesSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  rolesSectionTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.text,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  rolesList: {
    gap: 12,
  },
  roleCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  roleCheckboxSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  roleCheckboxInner: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  roleCheckboxInnerSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '15',
  },
  roleCheckboxText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  roleCheckboxTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  // Floating Action Button Styles
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  fabUsers: {
    bottom: 90, // Position above the role update button
  },
  // Bottom Sheet Styles (matching comments modal)
  bottomSheetContent: {
    flex: 1,
    flexDirection: 'column',
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexShrink: 0, // Prevent header from shrinking
  },
  bottomSheetTitle: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  bottomSheetCloseButton: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Users List Styles
  usersListContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 0,
    maxHeight: '90%',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
    flex: 1,
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
    flexShrink: 0, // Prevent filters from shrinking - they should be fixed height
  },
  filtersScroll: {
    marginVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  usersListContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  usersLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  usersFooterLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  usersEmptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usersEmptyText: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.text,
    marginTop: 16,
    fontWeight: '600',
  },
  usersEmptySubtext: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
  },
  userCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  userCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: colors.cardMuted,
  },
  userAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: colors.cardMuted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  userCardInfo: {
    flex: 1,
  },
  userCardName: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  userCardPhone: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },
  userStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userStatusBadgeActive: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  userStatusBadgeSuspended: {
    backgroundColor: '#FFA50015',
    borderColor: '#FFA500',
  },
  userStatusBadgeBlock: {
    backgroundColor: colors.danger + '15',
    borderColor: colors.danger,
  },
  userStatusText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userStatusTextActive: {
    color: colors.primary,
  },
  userCardDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  userDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userDetailText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text,
  },
  userReportCount: {
    color: colors.danger,
    fontWeight: '600',
  },
  // Address Accordion Styles
  addressAccordionContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  addressAccordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  addressAccordionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressAccordionTitle: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  addressAccordionContent: {
    paddingTop: 8,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  addressText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  usersFlatList: {
    flex: 1,
  },
  // Remove unused showUsersModal state - we're using RBSheet now
});
