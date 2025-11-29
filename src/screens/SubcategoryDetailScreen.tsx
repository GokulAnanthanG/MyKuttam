import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { DonationStackParamList } from '../navigation/DonationNavigator';
import {
  DonationService,
  type DonationRecord,
  type UserDonationRecord,
  type UserDonationSummary,
} from '../services/donations';
import { ExpenseService, type ExpenseRecord } from '../services/expenses';
import {
  DonationManagerMappingService,
  type DonationManager,
  type DonationManagerMapping,
  type DonationManagerWithMapping,
} from '../services/donationManagerMappings';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { useAuth } from '../context/AuthContext';
import { RazorpayService, createRazorpayOptions } from '../services/razorpay';

type Props = NativeStackScreenProps<DonationStackParamList, 'SubcategoryDetail'>;

const formatCurrency = (value?: number) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '₹0.00';
  }
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateString: string) => {
  try {
    return new Date(dateString).toLocaleString();
  } catch {
    return dateString;
  }
};

const formatDateForAPI = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateForDisplay = (date: Date | null): string => {
  if (!date) return '';
  return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
};

const generateOfflineTxnId = () => {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `OFFLINE-TXN-${Date.now()}-${random}`;
};

const getInitials = (name: string): string => {
  if (!name || name.trim().length === 0) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export const SubcategoryDetailScreen = ({ route, navigation }: Props) => {
  const { currentUser } = useAuth();
  const {
    categoryId,
    categoryName,
    subcategoryId,
    subcategoryTitle,
    subcategoryDescription,
    subcategoryType,
    subcategoryAmount,
    managers,
    subcategoryIncome = 0,
    subcategoryExpense = 0,
    subcategoryNet = 0,
  } = route.params;

  const [donations, setDonations] = useState<DonationRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offlineModalVisible, setOfflineModalVisible] = useState(false);
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [donorName, setDonorName] = useState('');
  const [donorFatherName, setDonorFatherName] = useState('');
  const [donorAddress, setDonorAddress] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [donationAmount, setDonationAmount] = useState('');
  const [donationTxnId, setDonationTxnId] = useState(generateOfflineTxnId());
  const [donationSubmitting, setDonationSubmitting] = useState(false);

  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<'cash' | 'online' | 'cheque'>('cash');
  const [expenseTxnId, setExpenseTxnId] = useState('');
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'donations' | 'expenses'>('donations');
  const [donationPage, setDonationPage] = useState(1);
  const [donationHasMore, setDonationHasMore] = useState(true);
  const [donationLoadingMore, setDonationLoadingMore] = useState(false);
  const [expensePage, setExpensePage] = useState(1);
  const [expenseHasMore, setExpenseHasMore] = useState(true);
  const [expenseLoadingMore, setExpenseLoadingMore] = useState(false);
  const [fabVisible, setFabVisible] = useState(true);

  // Edit / delete offline donation states
  const [editDonationModalVisible, setEditDonationModalVisible] = useState(false);
  const [editDonationSubmitting, setEditDonationSubmitting] = useState(false);
  const [editDonationId, setEditDonationId] = useState<string | null>(null);
  const [editDonorName, setEditDonorName] = useState('');
  const [editDonorPhone, setEditDonorPhone] = useState('');
  const [editDonorAddress, setEditDonorAddress] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editPaymentStatus, setEditPaymentStatus] = useState<'pending' | 'success' | 'failed'>('success');

  const [deleteDonationModalVisible, setDeleteDonationModalVisible] = useState(false);
  const [deleteDonationSubmitting, setDeleteDonationSubmitting] = useState(false);
  const [deleteDonationId, setDeleteDonationId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Edit / delete expense states
  const [editExpenseModalVisible, setEditExpenseModalVisible] = useState(false);
  const [editExpenseSubmitting, setEditExpenseSubmitting] = useState(false);
  const [editExpenseId, setEditExpenseId] = useState<string | null>(null);
  const [editExpenseTitle, setEditExpenseTitle] = useState('');
  const [editExpenseDescription, setEditExpenseDescription] = useState('');
  const [editExpenseAmount, setEditExpenseAmount] = useState('');
  const [editExpensePaymentMethod, setEditExpensePaymentMethod] =
    useState<'cash' | 'online' | 'cheque'>('cash');
  const [editExpenseStatus, setEditExpenseStatus] =
    useState<'approved' | 'pending' | 'rejected'>('approved');
  const [editExpenseTxnId, setEditExpenseTxnId] = useState('');

  const [deleteExpenseModalVisible, setDeleteExpenseModalVisible] = useState(false);
  const [deleteExpenseSubmitting, setDeleteExpenseSubmitting] = useState(false);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [deleteExpenseConfirmText, setDeleteExpenseConfirmText] = useState('');

  // Donation manager mapping states
  const [mappingModalVisible, setMappingModalVisible] = useState(false);
  const [donationManagers, setDonationManagers] = useState<DonationManager[]>([]);
  const [currentMappings, setCurrentMappings] = useState<Set<string>>(new Set());
  const [selectedManagers, setSelectedManagers] = useState<Set<string>>(new Set());
  const [mappingLoading, setMappingLoading] = useState(false);
  const [mappingSubmitting, setMappingSubmitting] = useState(false);
  const [subcategoryManagers, setSubcategoryManagers] = useState<DonationManagerWithMapping[]>([]);

  // Edit subcategory states
  const [editSubcategoryModalVisible, setEditSubcategoryModalVisible] = useState(false);
  const [editSubcategoryTitle, setEditSubcategoryTitle] = useState('');
  const [editSubcategoryDescription, setEditSubcategoryDescription] = useState('');
  const [editSubcategoryType, setEditSubcategoryType] = useState<'open_donation' | 'specific_amount'>('open_donation');
  const [editSubcategoryAmount, setEditSubcategoryAmount] = useState('');
  const [editSubcategorySubmitting, setEditSubcategorySubmitting] = useState(false);
  const [editSubcategoryConfirmText, setEditSubcategoryConfirmText] = useState('');

  // Filter and sort states
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [sortBy, setSortBy] = useState<'amount' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // User donations modal states
  const [donationModalVisible, setDonationModalVisible] = useState(false);
  const [donationModalTab, setDonationModalTab] = useState<'category' | 'overall'>('category');
  const [userDonationsCategory, setUserDonationsCategory] = useState<UserDonationRecord[]>([]);
  const [userDonationsOverall, setUserDonationsOverall] = useState<UserDonationRecord[]>([]);
  const [userDonationsCategorySummary, setUserDonationsCategorySummary] = useState<UserDonationSummary | null>(null);
  const [userDonationsOverallSummary, setUserDonationsOverallSummary] = useState<UserDonationSummary | null>(null);
  const [userDonationsLoading, setUserDonationsLoading] = useState(false);
  const [userDonationsCategoryPage, setUserDonationsCategoryPage] = useState(1);
  const [userDonationsOverallPage, setUserDonationsOverallPage] = useState(1);
  const [userDonationsCategoryHasMore, setUserDonationsCategoryHasMore] = useState(true);
  const [userDonationsOverallHasMore, setUserDonationsOverallHasMore] = useState(true);
  const [userDonationsCategoryLoadingMore, setUserDonationsCategoryLoadingMore] = useState(false);
  const [userDonationsOverallLoadingMore, setUserDonationsOverallLoadingMore] = useState(false);
  const [userDonationPhone, setUserDonationPhone] = useState('');
  const [userDonationStartDate, setUserDonationStartDate] = useState<Date | null>(null);
  const [userDonationEndDate, setUserDonationEndDate] = useState<Date | null>(null);
  const [userDonationPaymentStatus, setUserDonationPaymentStatus] = useState<'pending' | 'success' | 'failed' | 'all'>('all');
  const [userDonationSortBy, setUserDonationSortBy] = useState<'amount' | 'date'>('date');
  const [userDonationSortOrder, setUserDonationSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showUserDonationStartDatePicker, setShowUserDonationStartDatePicker] = useState(false);
  const [showUserDonationEndDatePicker, setShowUserDonationEndDatePicker] = useState(false);
  const [showUserDonationFilters, setShowUserDonationFilters] = useState(false);
  const [donorProfileModalVisible, setDonorProfileModalVisible] = useState(false);
  const [donorAvatarModalVisible, setDonorAvatarModalVisible] = useState(false);
  const [selectedDonor, setSelectedDonor] = useState<{
    name: string;
    phone: string;
    avatar?: string;
    fatherName?: string;
    address?: string;
  } | null>(null);
  const [paymentAmountModalVisible, setPaymentAmountModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  const canManageSubcategory = useMemo(() => {
    if (!currentUser || currentUser.account_type !== 'MANAGEMENT') {
      console.log('canManageSubcategory: false - not management user');
      return false;
    }
    if (currentUser.role === 'ADMIN' || currentUser.role === 'SUB_ADMIN') {
      console.log('canManageSubcategory: true - admin/sub-admin');
      return true;
    }
    if (currentUser.role === 'DONATION_MANAGER') {
      if (!currentUser.id) {
        console.log('canManageSubcategory: false - no user id');
        return false;
      }
      // Check both route params managers and fetched subcategory managers
      const routeManagerIds = (managers || []).map((m) => m.id);
      const subcategoryManagerIds = subcategoryManagers.map((m) => m.id);
      const isInRouteManagers = routeManagerIds.includes(currentUser.id);
      const isInSubcategoryManagers = subcategoryManagerIds.includes(currentUser.id);
      
      console.log('canManageSubcategory check for DONATION_MANAGER:', {
        currentUserId: currentUser.id,
        routeManagerIds,
        subcategoryManagerIds,
        isInRouteManagers,
        isInSubcategoryManagers,
        result: isInRouteManagers || isInSubcategoryManagers,
      });
      
      return isInRouteManagers || isInSubcategoryManagers;
    }
    console.log('canManageSubcategory: false - role not matched');
    return false;
  }, [currentUser, managers, subcategoryManagers]);

  const canViewStatusFilters = useMemo(() => {
    // Admin, Sub-Admin, or mapped Donation Manager can see status filters
    return canManageSubcategory;
  }, [canManageSubcategory]);

  // Management viewers (see all statuses) vs normal users (see only approved/success)
  const isManagementViewer = useMemo(() => {
    if (!currentUser || currentUser.account_type !== 'MANAGEMENT') {
      return false;
    }
    return (
      currentUser.role === 'ADMIN' ||
      currentUser.role === 'SUB_ADMIN' ||
      currentUser.role === 'DONATION_MANAGER'
    );
  }, [currentUser]);

  // Client-side sorting for donations
  const sortedDonations = useMemo(() => {
    const sorted = [...donations];
    sorted.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'amount') {
        comparison = a.amount - b.amount;
      } else {
        // sortBy === 'date'
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        comparison = dateA - dateB;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [donations, sortBy, sortOrder]);

  // Client-side sorting for expenses
  const sortedExpenses = useMemo(() => {
    const sorted = [...expenses];
    sorted.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'amount') {
        comparison = a.amount - b.amount;
      } else {
        // sortBy === 'date'
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        comparison = dateA - dateB;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [expenses, sortBy, sortOrder]);

  // Calculate filtered totals
  const filteredTotals = useMemo(() => {
    const filteredIncome = sortedDonations.reduce((sum, item) => sum + item.amount, 0);
    const filteredExpense = sortedExpenses.reduce((sum, item) => sum + item.amount, 0);
    const filteredNet = filteredIncome - filteredExpense;
    return {
      income: filteredIncome,
      expense: filteredExpense,
      net: filteredNet,
    };
  }, [sortedDonations, sortedExpenses]);

  const fetchDonations = useCallback(
    async (page: number = 1) => {
      const params: Parameters<typeof DonationService.getDonations>[0] = {
        subcategory_id: subcategoryId,
        page,
        limit: 10,
      };
      // Normal users see only successful payments
      if (!isManagementViewer) {
        params.payment_status = 'success';
      }
      if (startDate) {
        params.startDate = formatDateForAPI(startDate);
      }
      if (endDate) {
        params.endDate = formatDateForAPI(endDate);
      }
      const response = await DonationService.getDonations(params);
      if (!response.success) {
        throw new Error(response.message || 'Failed to load donations');
      }
      const items = response.data?.donations ?? [];
      setDonations((prev) => (page === 1 ? items : [...prev, ...items]));
      const totalPages = response.data?.pagination?.totalPages ?? page;
      setDonationHasMore(page < totalPages);
      setDonationPage(page);
    },
    [subcategoryId, startDate, endDate, isManagementViewer],
  );

  const fetchExpenses = useCallback(
    async (page: number = 1) => {
      const params: Parameters<typeof ExpenseService.listExpenses>[0] = {
        subcategory_id: subcategoryId,
        page,
        limit: 10,
      };
      // Normal users see only approved expenses
      if (!isManagementViewer) {
        params.status = 'approved';
      }
      if (startDate) {
        params.startDate = formatDateForAPI(startDate);
      }
      if (endDate) {
        params.endDate = formatDateForAPI(endDate);
      }
      const response = await ExpenseService.listExpenses(params);
      if (!response.success) {
        throw new Error(response.message || 'Failed to load expenses');
      }
      const items = response.data?.expenses ?? [];
      setExpenses((prev) => (page === 1 ? items : [...prev, ...items]));
      const totalPages = response.data?.pagination?.totalPages ?? page;
      setExpenseHasMore(page < totalPages);
      setExpensePage(page);
    },
    [subcategoryId, startDate, endDate, isManagementViewer],
  );

  const fetchSubcategoryManagers = useCallback(async () => {
    try {
      const response = await DonationManagerMappingService.getDonationManagersBySubcategory(
        subcategoryId,
        { page: 1, limit: 100 },
      );
      console.log('Subcategory managers response:', response);
      if (response.success && response.data) {
        console.log('Setting subcategory managers:', response.data.donation_managers);
        setSubcategoryManagers(response.data.donation_managers || []);
      } else {
        console.warn('API returned success=false:', response.message);
        setSubcategoryManagers([]);
      }
    } catch (err) {
      console.error('Failed to fetch subcategory managers:', err);
      // Set empty array on error so fallback shows
      setSubcategoryManagers([]);
    }
  }, [subcategoryId]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchDonations(1), fetchExpenses(1), fetchSubcategoryManagers()]);
      } catch (err) {
        if (isMounted) {
          Toast.show({
            type: 'error',
            text1: 'Unable to load data',
            text2: err instanceof Error ? err.message : 'Please try again later.',
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [fetchDonations, fetchExpenses, fetchSubcategoryManagers]);

  // Refresh managers when screen comes into focus (e.g., after mapping changes)
  useFocusEffect(
    useCallback(() => {
      fetchSubcategoryManagers();
    }, [fetchSubcategoryManagers]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchDonations(1), fetchExpenses(1), fetchSubcategoryManagers()]);
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Unable to refresh data',
        text2: err instanceof Error ? err.message : 'Please try again later.',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenOfflineModal = () => {
    if (!canManageSubcategory) {
      Alert.alert('Access denied', 'Only permitted managers can add offline entries.');
      return;
    }
    setDonorName('');
    setDonorFatherName('');
    setDonorAddress('');
    setDonorPhone('');
    setDonationAmount('');
    setDonationTxnId(generateOfflineTxnId());
    setOfflineModalVisible(true);
  };

  const handleOpenExpenseModal = () => {
    if (!canManageSubcategory) {
      Alert.alert('Access denied', 'You do not have permission to add expenses.');
      return;
    }
    setExpenseTitle('');
    setExpenseDescription('');
    setExpenseAmount('');
    setExpensePaymentMethod('cash');
    setExpenseTxnId('');
    setExpenseModalVisible(true);
  };

  const handleMapManager = async () => {
    if (currentUser?.role !== 'ADMIN' && currentUser?.role !== 'SUB_ADMIN') {
      Alert.alert('Access denied', 'Only ADMIN and SUB_ADMIN can map donation managers.');
      return;
    }
    setMappingModalVisible(true);
    setMappingLoading(true);
    try {
      // Fetch all donation managers
      const managersResponse = await DonationManagerMappingService.getDonationManagers({
        page: 1,
        limit: 100, // Get all managers
      });
      if (managersResponse.success && managersResponse.data) {
        setDonationManagers(managersResponse.data.donation_managers);
      }

      // Fetch current mappings for this subcategory
      const mappingsResponse = await DonationManagerMappingService.getMappings({
        subcategory_id: subcategoryId,
        page: 1,
        limit: 100,
      });
      if (mappingsResponse.success && mappingsResponse.data) {
        const mappedIds = new Set(
          mappingsResponse.data.mappings.map((m) => m.donation_manager._id),
        );
        setCurrentMappings(mappedIds);
        setSelectedManagers(new Set(mappedIds)); // Initialize with current mappings
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Unable to load managers',
        text2: err instanceof Error ? err.message : 'Please try again later.',
      });
    } finally {
      setMappingLoading(false);
    }
  };

  const handleOpenEditSubcategoryModal = () => {
    if (currentUser?.role !== 'ADMIN' && currentUser?.role !== 'SUB_ADMIN') {
      Alert.alert('Access denied', 'Only ADMIN and SUB_ADMIN can edit subcategories.');
      return;
    }
    // Initialize form with current values
    setEditSubcategoryTitle(subcategoryTitle);
    setEditSubcategoryDescription(subcategoryDescription || '');
    setEditSubcategoryType(subcategoryType as 'open_donation' | 'specific_amount');
    setEditSubcategoryAmount(subcategoryAmount ? String(subcategoryAmount) : '');
    setEditSubcategoryConfirmText('');
    setEditSubcategoryModalVisible(true);
  };

  const handleUpdateSubcategory = async () => {
    if (editSubcategoryConfirmText.toLowerCase() !== 'confirm') {
      Toast.show({
        type: 'error',
        text1: 'Confirmation required',
        text2: 'Please type "confirm" to update the subcategory.',
      });
      return;
    }

    if (!editSubcategoryTitle.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Validation error',
        text2: 'Title is required.',
      });
      return;
    }

    let parsedAmount: number | null | undefined;
    if (editSubcategoryType === 'specific_amount') {
      parsedAmount = Number(editSubcategoryAmount);
      if (!parsedAmount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        Toast.show({
          type: 'error',
          text1: 'Invalid amount',
          text2: 'Provide a valid amount for this subcategory.',
        });
        return;
      }
    } else {
      parsedAmount = null; // Clear amount when switching to open_donation
    }

    try {
      setEditSubcategorySubmitting(true);
      const payload: {
        category_id?: string;
        title?: string;
        description?: string;
        type?: 'open_donation' | 'specific_amount';
        amount?: number | null;
      } = {};

      // Only include fields that have changed
      if (editSubcategoryTitle.trim() !== subcategoryTitle) {
        payload.title = editSubcategoryTitle.trim();
      }
      if (editSubcategoryDescription.trim() !== (subcategoryDescription || '')) {
        payload.description = editSubcategoryDescription.trim() || undefined;
      }
      if (editSubcategoryType !== subcategoryType) {
        payload.type = editSubcategoryType;
        payload.amount = parsedAmount;
      } else if (editSubcategoryType === 'specific_amount') {
        const currentAmount = subcategoryAmount || 0;
        if (parsedAmount !== currentAmount) {
          payload.amount = parsedAmount;
        }
      }

      // If switching from specific_amount to open_donation, ensure amount is null
      if (subcategoryType === 'specific_amount' && editSubcategoryType === 'open_donation') {
        payload.amount = null;
      }

      if (Object.keys(payload).length === 0) {
        Toast.show({
          type: 'info',
          text1: 'No changes',
          text2: 'No changes were made to the subcategory.',
        });
        setEditSubcategoryModalVisible(false);
        return;
      }

      const response = await DonationService.updateSubcategory(subcategoryId, payload);
      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Subcategory updated',
          text2: 'The subcategory has been updated successfully.',
        });
        setEditSubcategoryModalVisible(false);
        // Update navigation params with new values if response contains updated data
        if (response.data) {
          navigation.setParams({
            subcategoryTitle: response.data.title || subcategoryTitle,
            subcategoryDescription: response.data.description || subcategoryDescription,
            subcategoryType: (response.data.type as 'open_donation' | 'specific_amount') || subcategoryType,
            subcategoryAmount: response.data.amount || subcategoryAmount,
          });
        }
        // Refresh the data
        handleRefresh();
      } else {
        throw new Error(response.message || 'Failed to update subcategory');
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Update failed',
        text2: err instanceof Error ? err.message : 'Unable to update subcategory',
      });
    } finally {
      setEditSubcategorySubmitting(false);
    }
  };

  const handleToggleManagerSelection = (managerId: string) => {
    setSelectedManagers((prev) => {
      const next = new Set(prev);
      if (next.has(managerId)) {
        next.delete(managerId);
      } else {
        next.add(managerId);
      }
      return next;
    });
  };

  const handleSaveMappings = async () => {
    setMappingSubmitting(true);
    try {
      // Find managers to add (in selected but not in current)
      const toAdd = Array.from(selectedManagers).filter((id) => !currentMappings.has(id));
      // Find managers to remove (in current but not in selected)
      const toRemove = Array.from(currentMappings).filter((id) => !selectedManagers.has(id));

      // Create new mappings
      const addPromises = toAdd.map((managerId) =>
        DonationManagerMappingService.createMapping({
          donation_manager_id: managerId,
          subcategory_id: subcategoryId,
        }),
      );

      // Delete removed mappings
      const removePromises = toRemove.map((managerId) =>
        DonationManagerMappingService.deleteMapping({
          donation_manager_id: managerId,
          subcategory_id: subcategoryId,
        }),
      );

      await Promise.all([...addPromises, ...removePromises]);

      Toast.show({
        type: 'success',
        text1: 'Mappings updated',
        text2: 'Donation manager mappings have been updated successfully.',
      });
      setMappingModalVisible(false);
      // Reset state
      setSelectedManagers(new Set());
      setCurrentMappings(new Set());
      setDonationManagers([]);
      // Refresh the managers list in the header
      await fetchSubcategoryManagers();
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Unable to save mappings',
        text2: err instanceof Error ? err.message : 'Please try again later.',
      });
    } finally {
      setMappingSubmitting(false);
    }
  };

  const handleDonateNow = () => {
    if (subcategoryType === 'specific_amount') {
      // Direct payment for specific amount
      if (!subcategoryAmount || subcategoryAmount <= 0) {
        Toast.show({
          type: 'error',
          text1: 'Invalid amount',
          text2: 'This subcategory does not have a valid amount configured.',
        });
        return;
      }
      initiatePayment(subcategoryAmount);
    } else if (subcategoryType === 'open_donation') {
      // Show amount input modal for open donation
      setPaymentAmount('');
      setPaymentAmountModalVisible(true);
    } else {
      Toast.show({
        type: 'error',
        text1: 'Invalid donation type',
        text2: 'Unable to process donation for this subcategory.',
      });
    }
  };

  const handleConfirmPaymentAmount = () => {
    const amount = parseFloat(paymentAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Invalid amount',
        text2: 'Please enter a valid amount greater than zero.',
      });
      return;
    }
    setPaymentAmountModalVisible(false);
    initiatePayment(amount);
  };

  const initiatePayment = async (amount: number) => {
    if (!currentUser) {
      Toast.show({
        type: 'error',
        text1: 'Authentication required',
        text2: 'Please login to make a donation.',
      });
      return;
    }

    setPaymentProcessing(true);
    try {
      const description = `Donation for ${subcategoryTitle}${subcategoryDescription ? ` - ${subcategoryDescription}` : ''}`;
      const options = createRazorpayOptions(
        amount,
        description,
        currentUser.name,
        currentUser.phone,
      );

      const paymentResponse = await RazorpayService.openCheckout(options);

      // Payment successful, create donation record
      await handlePaymentSuccess(paymentResponse, amount);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment failed';
      if (errorMessage !== 'Payment cancelled by user') {
        Toast.show({
          type: 'error',
          text1: 'Payment failed',
          text2: errorMessage,
        });
      }
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handlePaymentSuccess = async (paymentResponse: { razorpay_payment_id: string }, amount: number) => {
    try {
      const payload = {
        subcategory_id: subcategoryId,
        amount: amount,
        payment_method: 'online' as const,
        transaction_id: paymentResponse.razorpay_payment_id,
        payment_status: 'success' as const,
        donor_id: currentUser?.id,
        Donor_name: currentUser?.name,
        donor_phone: currentUser?.phone,
        donor_address: currentUser?.address,
      };

      const response = await DonationService.createDonation(payload);
      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Donation successful',
          text2: `Thank you for your donation of ${formatCurrency(amount)}!`,
        });
        // Refresh donations list
        await fetchDonations(1);
      } else {
        throw new Error(response.message || 'Failed to record donation');
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Payment recorded but donation failed',
        text2: error instanceof Error ? error.message : 'Please contact support.',
      });
    }
  };

  const handleViewDonorDonations = (donation: DonationRecord) => {
    const anyItem: any = donation;
    // Extract phone number from donation - could be in donor.phone, donor_phone, or donor_id.phone
    const donorPhone =
      donation.donor?.phone ||
      anyItem.donor_phone ||
      anyItem.donor_id?.phone ||
      '';
    
    if (!donorPhone) {
      Toast.show({
        type: 'error',
        text1: 'Phone number not found',
        text2: 'This donation does not have a phone number associated.',
      });
      return;
    }

    // Extract donor information - check multiple possible locations
    const donorName =
      donation.donor?.name ||
      anyItem.donor?.name ||
      anyItem.donor_id?.name ||
      anyItem.Donor_name ||
      'Anonymous';
    const donorAvatar =
      anyItem.donor?.avatar ||
      anyItem.donor_id?.avatar ||
      (donation.donor as any)?.avatar;
    const donorFatherName =
      anyItem.donor_father_name ||
      anyItem.donor?.father_name ||
      anyItem.donor_id?.father_name;
    const donorAddress =
      anyItem.donor_address ||
      donation.donor?.address ||
      anyItem.donor?.address ||
      anyItem.donor_id?.address;

    // Reset all state for new donor
    setUserDonationPhone(donorPhone);
    setUserDonationsCategoryPage(1);
    setUserDonationsOverallPage(1);
    setUserDonationsCategory([]);
    setUserDonationsOverall([]);
    setUserDonationsCategorySummary(null);
    setUserDonationsOverallSummary(null);
    setUserDonationsCategoryHasMore(true);
    setUserDonationsOverallHasMore(true);
    setDonationModalTab('category');
    
    // Reset filters
    setUserDonationStartDate(null);
    setUserDonationEndDate(null);
    setUserDonationPaymentStatus('all');
    setUserDonationSortBy('date');
    setUserDonationSortOrder('desc');
    setShowUserDonationFilters(false);

    // Store donor information for profile view (will be updated from API response)
    setSelectedDonor({
      name: donorName,
      phone: donorPhone,
      avatar: donorAvatar,
      fatherName: donorFatherName,
      address: donorAddress,
    });

    setDonationModalVisible(true);
    // Fetch immediately with the phone number
    fetchUserDonations('category', 1, true, donorPhone);
  };

  const handleOpenDonorProfile = (donation: UserDonationRecord) => {
    const donor = donation.donor;
    if (donor) {
      setSelectedDonor({
        name: donor.name || 'Anonymous',
        phone: donor.phone || '',
        avatar: donor.avatar,
        fatherName: donor.father_name,
        address: donor.address,
      });
      setDonorProfileModalVisible(true);
    }
  };

  const fetchUserDonations = async (
    type: 'category' | 'overall',
    page: number = 1,
    reset: boolean = false,
    phoneOverride?: string,
  ) => {
    const phoneToUse = phoneOverride || userDonationPhone;
    if (!phoneToUse.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Phone number required',
        text2: 'Please enter a phone number to fetch donations.',
      });
      return;
    }

    if (reset) {
      setUserDonationsLoading(true);
    } else {
      if (type === 'category') {
        setUserDonationsCategoryLoadingMore(true);
      } else {
        setUserDonationsOverallLoadingMore(true);
      }
    }

    try {
      const params: any = {
        page,
        limit: 10,
      };

      if (userDonationStartDate) {
        params.startDate = formatDateForAPI(userDonationStartDate);
      }
      if (userDonationEndDate) {
        params.endDate = formatDateForAPI(userDonationEndDate);
      }
      // Only send payment_status filter if user can view status filters
      if (canViewStatusFilters && userDonationPaymentStatus !== 'all') {
        params.payment_status = userDonationPaymentStatus;
      }

      if (type === 'category') {
        const response = await DonationService.getUserDonationsByCategory(phoneToUse, categoryId, params);
        if (response.success && response.data) {
          if (reset) {
            setUserDonationsCategory(response.data.donations);
            setUserDonationsCategorySummary(response.data.summary);
            // Update selectedDonor with actual donor info from API response
            if (response.data.donations.length > 0 && response.data.donations[0].donor) {
              const donor = response.data.donations[0].donor;
              setSelectedDonor({
                name: donor.name || 'Anonymous',
                phone: donor.phone || userDonationPhone,
                avatar: donor.avatar,
                fatherName: donor.father_name,
                address: donor.address,
              });
            }
          } else {
            setUserDonationsCategory((prev) => [...prev, ...response.data!.donations]);
          }
          setUserDonationsCategoryPage(page);
          setUserDonationsCategoryHasMore(page < response.data.pagination.totalPages);
        }
      } else {
        const response = await DonationService.getUserDonationsOverall(phoneToUse, params);
        if (response.success && response.data) {
          if (reset) {
            setUserDonationsOverall(response.data.donations);
            setUserDonationsOverallSummary(response.data.summary);
            // Update selectedDonor with actual donor info from API response
            if (response.data.donations.length > 0 && response.data.donations[0].donor) {
              const donor = response.data.donations[0].donor;
              setSelectedDonor({
                name: donor.name || 'Anonymous',
                phone: donor.phone || userDonationPhone,
                avatar: donor.avatar,
                fatherName: donor.father_name,
                address: donor.address,
              });
            }
          } else {
            setUserDonationsOverall((prev) => [...prev, ...response.data!.donations]);
          }
          setUserDonationsOverallPage(page);
          setUserDonationsOverallHasMore(page < response.data.pagination.totalPages);
        }
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Unable to fetch donations',
        text2: err instanceof Error ? err.message : 'Please try again later.',
      });
    } finally {
      if (reset) {
        setUserDonationsLoading(false);
      } else {
        if (type === 'category') {
          setUserDonationsCategoryLoadingMore(false);
        } else {
          setUserDonationsOverallLoadingMore(false);
        }
      }
    }
  };

  const handleUserDonationTabChange = (tab: 'category' | 'overall') => {
    setDonationModalTab(tab);
    if (tab === 'category' && userDonationsCategory.length === 0) {
      fetchUserDonations('category', 1, true);
    } else if (tab === 'overall' && userDonationsOverall.length === 0) {
      fetchUserDonations('overall', 1, true);
    }
  };

  const handleApplyUserDonationFilters = () => {
    setUserDonationsCategoryPage(1);
    setUserDonationsOverallPage(1);
    setUserDonationsCategory([]);
    setUserDonationsOverall([]);
    if (donationModalTab === 'category') {
      fetchUserDonations('category', 1, true);
    } else {
      fetchUserDonations('overall', 1, true);
    }
  };

  const handleClearUserDonationFilters = () => {
    setUserDonationStartDate(null);
    setUserDonationEndDate(null);
    setUserDonationPaymentStatus('all');
    setUserDonationSortBy('date');
    setUserDonationSortOrder('desc');
  };

  const handleUserDonationStartDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowUserDonationStartDatePicker(false);
    }
    if (selectedDate) {
      setUserDonationStartDate(selectedDate);
    }
  };

  const handleUserDonationEndDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowUserDonationEndDatePicker(false);
    }
    if (selectedDate) {
      setUserDonationEndDate(selectedDate);
    }
  };

  const sortedUserDonationsCategory = useMemo(() => {
    const sorted = [...userDonationsCategory];
    sorted.sort((a, b) => {
      let comparison = 0;
      if (userDonationSortBy === 'amount') {
        comparison = a.amount - b.amount;
      } else {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        comparison = dateA - dateB;
      }
      return userDonationSortOrder === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [userDonationsCategory, userDonationSortBy, userDonationSortOrder]);

  const sortedUserDonationsOverall = useMemo(() => {
    const sorted = [...userDonationsOverall];
    sorted.sort((a, b) => {
      let comparison = 0;
      if (userDonationSortBy === 'amount') {
        comparison = a.amount - b.amount;
      } else {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        comparison = dateA - dateB;
      }
      return userDonationSortOrder === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [userDonationsOverall, userDonationSortBy, userDonationSortOrder]);

  const handleApplyFilters = async () => {
    // Refetch data when date filters are applied (sorting is handled client-side via useMemo)
    if (startDate || endDate) {
      setDonationPage(1);
      setExpensePage(1);
      setDonations([]);
      setExpenses([]);
      setLoading(true);
      try {
        await Promise.all([fetchDonations(1), fetchExpenses(1)]);
      } catch (err) {
        Toast.show({
          type: 'error',
          text1: 'Unable to apply filters',
          text2: err instanceof Error ? err.message : 'Please try again later.',
        });
      } finally {
        setLoading(false);
      }
    }
    // Close filter panel (sorting is applied automatically via useMemo)
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setSortBy('date');
    setSortOrder('desc');
  };

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartDatePicker(false);
    }
    if (selectedDate) {
      setStartDate(selectedDate);
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndDatePicker(false);
    }
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  const handleSaveOfflineDonation = async () => {
    if (!donorName.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Missing donor name',
        text2: 'Provide the donor name to continue.',
      });
      return;
    }
    const amountValue = parseFloat(donationAmount);
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Invalid amount',
        text2: 'Enter an amount greater than zero.',
      });
      return;
    }
    if (!currentUser?.id) {
      Toast.show({
        type: 'error',
        text1: 'Missing manager id',
        text2: 'Please re-login to continue.',
      });
      return;
    }

    setDonationSubmitting(true);
    try {
      const payload = {
        subcategory_id: subcategoryId,
        amount: amountValue,
        payment_method: 'offline' as const,
        transaction_id: donationTxnId,
        payment_status: 'success' as const,
        Donor_name: donorName.trim(),
        donor_father_name: donorFatherName.trim() || undefined,
        donor_address: donorAddress.trim() || undefined,
        donor_phone: donorPhone.trim() || undefined,
        manager_id: currentUser.id,
      };
      const response = await DonationService.createDonation(payload);
      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Offline entry saved',
          text2: response.message || 'Donation recorded successfully.',
        });
        setOfflineModalVisible(false);
        await fetchDonations(1);
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Unable to save donation',
        text2: err instanceof Error ? err.message : 'Please try again later.',
      });
    } finally {
      setDonationSubmitting(false);
    }
  };

  const handleSaveExpense = async () => {
    if (!expenseTitle.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Expense title required',
        text2: 'Enter a descriptive title.',
      });
      return;
    }
    const amountValue = parseFloat(expenseAmount);
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Invalid amount',
        text2: 'Enter an amount greater than zero.',
      });
      return;
    }

    setExpenseSubmitting(true);
    try {
      const payload = {
        subcategory_id: subcategoryId,
        expense_title: expenseTitle.trim(),
        expense_description: expenseDescription.trim() || undefined,
        amount: amountValue,
        payment_method: expensePaymentMethod,
        transaction_id: expenseTxnId || undefined,
        manager_id: currentUser?.id,
      };
      const response = await ExpenseService.createExpense(payload);
      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Expense saved',
          text2: response.message || 'Expense recorded successfully.',
        });
        setExpenseModalVisible(false);
        await fetchExpenses(1);
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Unable to save expense',
        text2: err instanceof Error ? err.message : 'Please try again later.',
      });
    } finally {
      setExpenseSubmitting(false);
    }
  };

  const handleOpenEditDonationModal = (item: DonationRecord) => {
    const anyItem: any = item;
    setEditDonationId(item.id);
    setEditDonorName(anyItem.Donor_name || item.donor?.name || '');
    setEditDonorPhone(anyItem.donor_phone || item.donor?.phone || '');
    setEditDonorAddress(anyItem.donor_address || '');
    setEditAmount(String(item.amount ?? ''));
    setEditPaymentStatus(item.payment_status || 'success');
    setEditDonationModalVisible(true);
  };

  const handleSubmitEditDonation = async () => {
    if (!editDonationId) {
      return;
    }

    const payload: any = {};

    if (editPaymentStatus) {
      payload.payment_status = editPaymentStatus;
    }

    if (editAmount.trim()) {
      const amountValue = parseFloat(editAmount);
      if (Number.isNaN(amountValue) || amountValue <= 0) {
        Toast.show({
          type: 'error',
          text1: 'Invalid amount',
          text2: 'Enter an amount greater than zero.',
        });
        return;
      }
      payload.amount = amountValue;
    }

    if (editDonorName.trim()) {
      payload.Donor_name = editDonorName.trim();
    }
    if (editDonorPhone.trim()) {
      payload.donor_phone = editDonorPhone.trim();
    }
    if (editDonorAddress.trim()) {
      payload.donor_address = editDonorAddress.trim();
    }

    if (Object.keys(payload).length === 0) {
      Toast.show({
        type: 'info',
        text1: 'No changes to save',
        text2: 'Update at least one field before saving.',
      });
      return;
    }

    setEditDonationSubmitting(true);
    try {
      const response = await DonationService.updateDonation(editDonationId, payload);
      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Donation updated',
          text2: response.message || 'Offline donation updated successfully.',
        });
        setEditDonationModalVisible(false);
        await fetchDonations(1);
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Unable to update donation',
        text2: err instanceof Error ? err.message : 'Please try again later.',
      });
    } finally {
      setEditDonationSubmitting(false);
    }
  };

  const handleOpenDeleteDonationModal = (id: string) => {
    setDeleteDonationId(id);
    setDeleteConfirmText('');
    setDeleteDonationModalVisible(true);
  };

  const handleConfirmDeleteDonation = async () => {
    if (!deleteDonationId) {
      return;
    }
    if (deleteConfirmText.trim().toUpperCase() !== 'CONFIRM') {
      Toast.show({
        type: 'error',
        text1: 'Confirmation required',
        text2: 'Type CONFIRM to delete this donation.',
      });
      return;
    }

    setDeleteDonationSubmitting(true);
    try {
      const response = await DonationService.deleteDonation(deleteDonationId);
      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Donation deleted',
          text2: response.message || 'Offline donation deleted successfully.',
        });
        setDeleteDonationModalVisible(false);
        await fetchDonations(1);
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Unable to delete donation',
        text2: err instanceof Error ? err.message : 'Please try again later.',
      });
    } finally {
      setDeleteDonationSubmitting(false);
    }
  };

  const handleDonationActions = (item: DonationRecord) => {
    // Only for offline donations and management users
    if (!canManageSubcategory || item.payment_method !== 'offline') {
      return;
    }
    Alert.alert('Offline donation', 'Choose an action', [
      {
        text: 'Edit',
        onPress: () => handleOpenEditDonationModal(item),
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => handleOpenDeleteDonationModal(item.id),
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]);
  };

  const handleOpenEditExpenseModal = (item: ExpenseRecord) => {
    setEditExpenseId(item.id);
    setEditExpenseTitle(item.expense_title);
    setEditExpenseDescription(item.expense_description || '');
    setEditExpenseAmount(String(item.amount ?? ''));
    setEditExpensePaymentMethod(item.payment_method);
    setEditExpenseStatus(item.status);
    setEditExpenseTxnId(item.transaction_id || '');
    setEditExpenseModalVisible(true);
  };

  const handleSubmitEditExpense = async () => {
    if (!editExpenseId) {
      return;
    }

    const payload: any = {};

    if (editExpenseTitle.trim()) {
      payload.expense_title = editExpenseTitle.trim();
    }
    if (editExpenseDescription.trim()) {
      payload.expense_description = editExpenseDescription.trim();
    }
    if (editExpenseAmount.trim()) {
      const amountValue = parseFloat(editExpenseAmount);
      if (Number.isNaN(amountValue) || amountValue <= 0) {
        Toast.show({
          type: 'error',
          text1: 'Invalid amount',
          text2: 'Enter an amount greater than zero.',
        });
        return;
      }
      payload.amount = amountValue;
    }
    if (editExpensePaymentMethod) {
      payload.payment_method = editExpensePaymentMethod;
    }
    if (editExpenseStatus) {
      payload.status = editExpenseStatus;
    }
    if (editExpenseTxnId.trim()) {
      payload.transaction_id = editExpenseTxnId.trim();
    }

    if (Object.keys(payload).length === 0) {
      Toast.show({
        type: 'info',
        text1: 'No changes to save',
        text2: 'Update at least one field before saving.',
      });
      return;
    }

    setEditExpenseSubmitting(true);
    try {
      const response = await ExpenseService.updateExpense(editExpenseId, payload);
      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Expense updated',
          text2: response.message || 'Expense updated successfully.',
        });
        setEditExpenseModalVisible(false);
        await fetchExpenses(1);
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Unable to update expense',
        text2: err instanceof Error ? err.message : 'Please try again later.',
      });
    } finally {
      setEditExpenseSubmitting(false);
    }
  };

  const handleOpenDeleteExpenseModal = (id: string) => {
    setDeleteExpenseId(id);
    setDeleteExpenseConfirmText('');
    setDeleteExpenseModalVisible(true);
  };

  const handleConfirmDeleteExpense = async () => {
    if (!deleteExpenseId) {
      return;
    }
    if (deleteExpenseConfirmText.trim().toUpperCase() !== 'CONFIRM') {
      Toast.show({
        type: 'error',
        text1: 'Confirmation required',
        text2: 'Type CONFIRM to delete this expense.',
      });
      return;
    }

    setDeleteExpenseSubmitting(true);
    try {
      const response = await ExpenseService.deleteExpense(deleteExpenseId);
      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Expense deleted',
          text2: response.message || 'Expense deleted successfully.',
        });
        setDeleteExpenseModalVisible(false);
        await fetchExpenses(1);
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Unable to delete expense',
        text2: err instanceof Error ? err.message : 'Please try again later.',
      });
    } finally {
      setDeleteExpenseSubmitting(false);
    }
  };

  const handleExpenseActions = (item: ExpenseRecord) => {
    if (!canManageSubcategory) {
      return;
    }
    Alert.alert('Expense', 'Choose an action', [
      {
        text: 'Edit',
        onPress: () => handleOpenEditExpenseModal(item),
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => handleOpenDeleteExpenseModal(item.id),
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]);
  };

  const handleLoadMoreDonations = useCallback(() => {
    if (!donationHasMore || donationLoadingMore) {
      return;
    }
    setDonationLoadingMore(true);
    fetchDonations(donationPage + 1)
      .catch((err) => {
        Toast.show({
          type: 'error',
          text1: 'Unable to load more donations',
          text2: err instanceof Error ? err.message : 'Please try again later.',
        });
      })
      .finally(() => setDonationLoadingMore(false));
  }, [donationHasMore, donationLoadingMore, fetchDonations, donationPage]);

  const handleLoadMoreExpenses = useCallback(() => {
    if (!expenseHasMore || expenseLoadingMore) {
      return;
    }
    setExpenseLoadingMore(true);
    fetchExpenses(expensePage + 1)
      .catch((err) => {
        Toast.show({
          type: 'error',
          text1: 'Unable to load more expenses',
          text2: err instanceof Error ? err.message : 'Please try again later.',
        });
      })
      .finally(() => setExpenseLoadingMore(false));
  }, [expenseHasMore, expenseLoadingMore, fetchExpenses, expensePage]);

  const renderDonationEmpty = () => (
    <View style={styles.emptyList}>
      <Icon name="folder-open" size={20} color={colors.textMuted} />
      <Text style={styles.emptyListText}>No donations captured yet.</Text>
    </View>
  );

  const renderExpenseEmpty = () => (
    <View style={styles.emptyList}>
      <Icon name="ticket" size={20} color={colors.textMuted} />
      <Text style={styles.emptyListText}>No expenses recorded yet.</Text>
    </View>
  );

  const renderLoadingMore = () => (
    <View style={styles.loadMore}>
      <ActivityIndicator size="small" color={colors.primary} />
    </View>
  );

  const renderDonationsCard = () => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Donations</Text>
        <Text style={styles.cardSubtitle}>Income inflow</Text>
      </View>
      {sortedDonations.length > 0 ? (
        sortedDonations.map((item, index) => {
          // Backend can return donor in multiple shapes:
          // - offline: top-level Donor_name, donor_father_name
          // - online: donor_id: { name }, or donor?: { name }
          const anyItem: any = item;
          const donorName =
            item.donor?.name ||
            anyItem.Donor_name ||
            anyItem.donor_id?.name ||
            'Anonymous donor';
          const fatherName: string | undefined = anyItem.donor_father_name;

          const showActions = canManageSubcategory && item.payment_method === 'offline';

          const anyItemForPhone: any = item;
          const donorPhone =
            item.donor?.phone ||
            anyItemForPhone.donor_phone ||
            anyItemForPhone.donor_id?.phone ||
            '';

          return (
            <View key={item.id}>
              <TouchableOpacity
                style={styles.itemRow}
                onPress={() => {
                  if (donorPhone) {
                    handleViewDonorDonations(item);
                  } else {
                    Toast.show({
                      type: 'info',
                      text1: 'No phone number',
                      text2: 'This donation does not have a phone number to view donor history.',
                    });
                  }
                }}
                activeOpacity={0.7}
                disabled={!donorPhone}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle}>{donorName}</Text>
                  {!!fatherName && (
                    <Text style={styles.itemFatherName}>Father Name: {fatherName}</Text>
                  )}
                  <Text style={styles.itemMeta}>{item.payment_method.toUpperCase()}</Text>
                  {isManagementViewer && (
                    <View
                      style={[
                        styles.statusBadge,
                        item.payment_status === 'success'
                          ? styles.statusBadgeSuccess
                          : item.payment_status === 'pending'
                          ? styles.statusBadgePending
                          : styles.statusBadgeFailed,
                      ]}>
                      <Text style={styles.statusBadgeText}>
                        {item.payment_status.toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.itemDate}>{formatDate(item.createdAt)}</Text>
                </View>
                <View style={styles.itemRight}>
                  <Text style={styles.itemAmount}>{formatCurrency(item.amount)}</Text>
                  {showActions && (
                    <TouchableOpacity
                      style={styles.moreButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDonationActions(item);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Icon name="ellipsis-v" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
              {index !== sortedDonations.length - 1 && <View style={styles.itemDivider} />}
            </View>
          );
        })
      ) : (
        renderDonationEmpty()
      )}
      {donationLoadingMore && renderLoadingMore()}
    </View>
  );

  const renderExpensesCard = () => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Expenses</Text>
        <Text style={styles.cardSubtitle}>Utilisation log</Text>
      </View>
      {sortedExpenses.length > 0 ? (
        sortedExpenses.map((item, index) => (
          <View key={item.id}>
            <View style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemTitle}>{item.expense_title}</Text>
                <Text style={styles.itemMeta}>{item.payment_method.toUpperCase()}</Text>
                {isManagementViewer && (
                  <View
                    style={[
                      styles.statusBadge,
                      item.status === 'approved'
                        ? styles.statusBadgeSuccess
                        : item.status === 'pending'
                        ? styles.statusBadgePending
                        : styles.statusBadgeFailed,
                    ]}>
                    <Text style={styles.statusBadgeText}>{item.status.toUpperCase()}</Text>
                  </View>
                )}
                <Text style={styles.itemDate}>{formatDate(item.createdAt)}</Text>
              </View>
              <View style={styles.itemRight}>
                <Text style={[styles.itemAmount, styles.expenseAmount]}>
                  {formatCurrency(item.amount)}
                </Text>
                {canManageSubcategory && (
                  <TouchableOpacity
                    style={styles.moreButton}
                    onPress={() => handleExpenseActions(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon name="ellipsis-v" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {index !== sortedExpenses.length - 1 && <View style={styles.itemDivider} />}
          </View>
        ))
      ) : (
        renderExpenseEmpty()
      )}
      {expenseLoadingMore && renderLoadingMore()}
    </View>
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      const threshold = 80;
      const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - threshold;
      if (!isNearBottom) {
        return;
      }
      if (activeTab === 'donations') {
        handleLoadMoreDonations();
      } else {
        handleLoadMoreExpenses();
      }
    },
    [activeTab, handleLoadMoreDonations, handleLoadMoreExpenses],
  );

  const renderListHeader = () => (
    <View style={styles.listHeaderContainer}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Icon name="arrow-left" size={16} color={colors.text} />
        <Text style={styles.backButtonText}>Back to summary</Text>
      </TouchableOpacity>

      <View style={styles.headerCard}>
        <Text style={styles.categoryLabel}>{categoryName}</Text>
        <Text style={styles.subcategoryTitle}>{subcategoryTitle}</Text>
        {subcategoryDescription ? (
          <Text style={styles.subcategoryDescription}>{subcategoryDescription}</Text>
        ) : null}
        <View style={styles.summaryStatsRow}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatLabel}>Income</Text>
            <Text style={[styles.summaryStatValue, styles.netPositive]}>{formatCurrency(subcategoryIncome)}</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatLabel}>Expense</Text>
            <Text style={[styles.summaryStatValue, styles.netNegative]}>{formatCurrency(subcategoryExpense)}</Text>
          </View>
        </View>
        <View style={styles.netBalanceRow}>
          <Text style={styles.netBalanceLabel}>Net balance</Text>
          <Text
            style={[
              styles.netBalanceValue,
              (subcategoryNet || 0) >= 0 ? styles.netBalancePositive : styles.netBalanceNegative,
            ]}>
            {formatCurrency(subcategoryNet)}
          </Text>
        </View>
        {subcategoryManagers.length > 0 ? (
          <View style={styles.managersContainer}>
            <Text style={styles.managersLabel}>Donation Managers:</Text>
            {subcategoryManagers.map((manager) => (
              <View key={manager.id} style={styles.managerRow}>
                <Icon name="user" size={10} color={colors.textMuted} />
                <Text style={styles.managerText}>
                  {manager.name} - {manager.phone}
                </Text>
              </View>
            ))}
          </View>
        ) : managers && managers.length > 0 ? (
          <View style={styles.managersContainer}>
            <Text style={styles.managersLabel}>Donation Managers:</Text>
            {managers.map((manager) => (
              <View key={manager.id} style={styles.managerRow}>
                <Icon name="user" size={10} color={colors.textMuted} />
                <Text style={styles.managerText}>
                  {manager.name} {manager.phone ? `- ${manager.phone}` : ''}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.metaText}>Managers: Not assigned</Text>
        )}
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'donations' && styles.tabButtonActive]}
          onPress={() => setActiveTab('donations')}>
          <Text style={[styles.tabLabel, activeTab === 'donations' && styles.tabLabelActive]}>Donations</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'expenses' && styles.tabButtonActive]}
          onPress={() => setActiveTab('expenses')}>
          <Text style={[styles.tabLabel, activeTab === 'expenses' && styles.tabLabelActive]}>Expenses</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.filterToggle}
        onPress={() => setShowFilters(!showFilters)}
        activeOpacity={0.7}>
        <Icon name={showFilters ? 'chevron-up' : 'chevron-down'} size={14} color={colors.text} />
        <Text style={styles.filterToggleText}>Filters & Sort</Text>
        {(startDate || endDate || sortBy !== 'date' || sortOrder !== 'desc') && (
          <View style={styles.filterBadge}>
            <Text style={styles.filterBadgeText}>Active</Text>
          </View>
        )}
      </TouchableOpacity>

      {showFilters && (
        <View style={styles.filterContainer}>
          <View style={styles.filterRow}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Start date</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowStartDatePicker(true)}
                activeOpacity={0.7}>
                <Text style={[styles.dateInputText, !startDate && styles.dateInputPlaceholder]}>
                  {startDate ? formatDateForDisplay(startDate) : 'Start date'}
                </Text>
                <Icon name="calendar" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>End date</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowEndDatePicker(true)}
                activeOpacity={0.7}>
                <Text style={[styles.dateInputText, !endDate && styles.dateInputPlaceholder]}>
                  {endDate ? formatDateForDisplay(endDate) : 'End date'}
                </Text>
                <Icon name="calendar" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.filterRow}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Sort by</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, sortBy === 'date' && styles.chipActive]}
                  onPress={() => setSortBy('date')}
                  activeOpacity={0.7}>
                  <Text style={[styles.chipText, sortBy === 'date' && styles.chipTextActive]}>Date</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, sortBy === 'amount' && styles.chipActive]}
                  onPress={() => setSortBy('amount')}
                  activeOpacity={0.7}>
                  <Text style={[styles.chipText, sortBy === 'amount' && styles.chipTextActive]}>Amount</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Order</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, sortOrder === 'asc' && styles.chipActive]}
                  onPress={() => setSortOrder('asc')}
                  activeOpacity={0.7}>
                  <Text style={[styles.chipText, sortOrder === 'asc' && styles.chipTextActive]}>Asc</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, sortOrder === 'desc' && styles.chipActive]}
                  onPress={() => setSortOrder('desc')}
                  activeOpacity={0.7}>
                  <Text style={[styles.chipText, sortOrder === 'desc' && styles.chipTextActive]}>Desc</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.filterActions}>
            <TouchableOpacity style={styles.filterClearButton} onPress={handleClearFilters} activeOpacity={0.7}>
              <Text style={styles.filterClearText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterApplyButton} onPress={handleApplyFilters} activeOpacity={0.7}>
              <Text style={styles.filterApplyText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {(startDate || endDate || sortBy !== 'date' || sortOrder !== 'desc') && (
        <View style={styles.filteredTotalsContainer}>
          <Text style={styles.filteredTotalsLabel}>Filtered totals:</Text>
          <View style={styles.filteredTotalsRow}>
            <Text style={styles.filteredTotalText}>
              Income: <Text style={styles.filteredTotalValue}>{formatCurrency(filteredTotals.income)}</Text>
            </Text>
            <Text style={styles.filteredTotalText}>
              Expense: <Text style={[styles.filteredTotalValue, styles.filteredTotalExpense]}>{formatCurrency(filteredTotals.expense)}</Text>
            </Text>
            <Text style={styles.filteredTotalText}>
              Net: <Text style={[styles.filteredTotalValue, filteredTotals.net >= 0 ? styles.filteredTotalPositive : styles.filteredTotalNegative]}>{formatCurrency(filteredTotals.net)}</Text>
            </Text>
          </View>
        </View>
      )}

      {Platform.OS === 'ios' && showStartDatePicker && (
        <Modal visible={showStartDatePicker} transparent animationType="slide">
          <View style={styles.datePickerModal}>
            <View style={styles.datePickerContainer}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity onPress={() => setShowStartDatePicker(false)}>
                  <Text style={styles.datePickerCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.datePickerTitle}>Select start date</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (!startDate) {
                      setStartDate(new Date());
                    }
                    setShowStartDatePicker(false);
                  }}>
                  <Text style={styles.datePickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={startDate || new Date()}
                mode="date"
                display="spinner"
                onChange={handleStartDateChange}
                maximumDate={endDate || undefined}
              />
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === 'android' && showStartDatePicker && (
        <DateTimePicker
          value={startDate || new Date()}
          mode="date"
          display="default"
          onChange={handleStartDateChange}
          maximumDate={endDate || undefined}
        />
      )}

      {Platform.OS === 'ios' && showEndDatePicker && (
        <Modal visible={showEndDatePicker} transparent animationType="slide">
          <View style={styles.datePickerModal}>
            <View style={styles.datePickerContainer}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity onPress={() => setShowEndDatePicker(false)}>
                  <Text style={styles.datePickerCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.datePickerTitle}>Select end date</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (!endDate) {
                      setEndDate(new Date());
                    }
                    setShowEndDatePicker(false);
                  }}>
                  <Text style={styles.datePickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={endDate || new Date()}
                mode="date"
                display="spinner"
                onChange={handleEndDateChange}
                minimumDate={startDate || undefined}
              />
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === 'android' && showEndDatePicker && (
        <DateTimePicker
          value={endDate || new Date()}
          mode="date"
          display="default"
          onChange={handleEndDateChange}
          minimumDate={startDate || undefined}
        />
      )}
    </View>
  );

  const floatingActions = useMemo(() => {
    return [
      {
        key: 'donate',
        label: 'Donate now',
        icon: 'heart',
        onPress: handleDonateNow,
        visible: true,
      },
      {
        key: 'offline',
        label: 'Offline entry',
        icon: 'clipboard',
        onPress: handleOpenOfflineModal,
        visible: canManageSubcategory,
      },
      {
        key: 'expense',
        label: 'Add expense',
        icon: 'money',
        onPress: handleOpenExpenseModal,
        visible: canManageSubcategory,
      },
      {
        key: 'map',
        label: 'Map manager',
        icon: 'user-plus',
        onPress: handleMapManager,
        visible: currentUser?.role === 'ADMIN' || currentUser?.role === 'SUB_ADMIN',
      },
      {
        key: 'edit',
        label: 'Edit subcategory',
        icon: 'edit',
        onPress: handleOpenEditSubcategoryModal,
        visible: currentUser?.role === 'ADMIN' || currentUser?.role === 'SUB_ADMIN',
      },
    ].filter((action) => action.visible);
  }, [canManageSubcategory, currentUser?.role]);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Loading subcategory data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        onScroll={handleScroll}
        scrollEventThrottle={16}>
        {renderListHeader()}
        {activeTab === 'donations' ? renderDonationsCard() : renderExpensesCard()}
      </ScrollView>

      {floatingActions.length > 0 && (
        <>
          {fabVisible && (
            <View style={styles.fabContainer}>
              {floatingActions.map((action) => (
                <TouchableOpacity key={action.key} style={styles.fabButton} onPress={action.onPress} activeOpacity={0.85}>
                  <Icon name={action.icon} size={16} color="#fff" />
                  <Text style={styles.fabLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TouchableOpacity
            style={[styles.fabToggle, fabVisible && styles.fabToggleActive]}
            onPress={() => setFabVisible(!fabVisible)}
            activeOpacity={0.85}>
            <Icon name={fabVisible ? 'chevron-down' : 'chevron-up'} size={18} color={fabVisible ? '#fff' : colors.primary} />
          </TouchableOpacity>
        </>
      )}

      <Modal visible={offlineModalVisible} transparent animationType="slide" onRequestClose={() => setOfflineModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Add offline donation</Text>
              <TouchableOpacity onPress={() => setOfflineModalVisible(false)}>
                <Icon name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Donor name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  value={donorName}
                  onChangeText={setDonorName}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.rowItem]}>
                  <Text style={styles.inputLabel}>Father / spouse</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Relative name"
                    value={donorFatherName}
                    onChangeText={setDonorFatherName}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={[styles.inputGroup, styles.rowItem]}>
                  <Text style={styles.inputLabel}>Phone</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="10-digit"
                    keyboardType="phone-pad"
                    value={donorPhone}
                    onChangeText={setDonorPhone}
                    maxLength={10}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Address</Text>
                <TextInput
                  style={[styles.input, styles.multiline]}
                  placeholder="Street, city"
                  value={donorAddress}
                  onChangeText={setDonorAddress}
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
              </View>
              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.rowItem]}>
                  <Text style={styles.inputLabel}>Amount (₹) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 500"
                    keyboardType="numeric"
                    value={donationAmount}
                    onChangeText={setDonationAmount}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={[styles.inputGroup, styles.rowItem]}>
                  <View style={styles.inputLabelRow}>
                    <Text style={styles.inputLabel}>Txn ID</Text>
                    <TouchableOpacity onPress={() => setDonationTxnId(generateOfflineTxnId())}>
                      <Text style={styles.generateIdInline}>Generate</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={donationTxnId}
                    onChangeText={setDonationTxnId}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>
            </ScrollView>
            <TouchableOpacity
              style={[styles.submitButton, donationSubmitting && styles.submitButtonDisabled]}
              onPress={handleSaveOfflineDonation}
              activeOpacity={0.9}
              disabled={donationSubmitting}>
              {donationSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="save" size={14} color="#fff" />
                  <Text style={styles.submitButtonText}>Save offline entry</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={expenseModalVisible} transparent animationType="slide" onRequestClose={() => setExpenseModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Add expense</Text>
              <TouchableOpacity onPress={() => setExpenseModalVisible(false)}>
                <Icon name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Expense title *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="School uniforms"
                  value={expenseTitle}
                  onChangeText={setExpenseTitle}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.input, styles.multiline]}
                  placeholder="Optional notes"
                  value={expenseDescription}
                  onChangeText={setExpenseDescription}
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
              </View>
              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.rowItem]}>
                  <Text style={styles.inputLabel}>Amount (₹) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 1200"
                    keyboardType="numeric"
                    value={expenseAmount}
                    onChangeText={setExpenseAmount}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={[styles.inputGroup, styles.rowItem]}>
                  <Text style={styles.inputLabel}>Payment method</Text>
                  <View style={styles.chipRow}>
                    {(['cash', 'online', 'cheque'] as const).map((method) => (
                      <TouchableOpacity
                        key={method}
                        style={[styles.chip, expensePaymentMethod === method && styles.chipActive]}
                        onPress={() => setExpensePaymentMethod(method)}>
                        <Text
                          style={[
                            styles.chipText,
                            expensePaymentMethod === method && styles.chipTextActive,
                          ]}>
                          {method.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Transaction ID</Text>
                <TextInput
                  style={styles.input}
                  value={expenseTxnId}
                  onChangeText={setExpenseTxnId}
                  placeholder="Optional reference"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </ScrollView>
            <TouchableOpacity
              style={[styles.submitButton, expenseSubmitting && styles.submitButtonDisabled]}
              onPress={handleSaveExpense}
              activeOpacity={0.9}
              disabled={expenseSubmitting}>
              {expenseSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="check" size={14} color="#fff" />
                  <Text style={styles.submitButtonText}>Save expense</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit subcategory modal */}
      <Modal
        visible={editSubcategoryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditSubcategoryModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboardWrapper}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Edit subcategory</Text>
                <TouchableOpacity onPress={() => setEditSubcategoryModalVisible(false)}>
                  <Icon name="close" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Title *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Subcategory title"
                    value={editSubcategoryTitle}
                    onChangeText={setEditSubcategoryTitle}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Description</Text>
                  <TextInput
                    style={[styles.input, styles.multiline]}
                    placeholder="Optional description"
                    value={editSubcategoryDescription}
                    onChangeText={setEditSubcategoryDescription}
                    placeholderTextColor={colors.textMuted}
                    multiline
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Donation type</Text>
                  <View style={styles.chipRow}>
                    {(['open_donation', 'specific_amount'] as const).map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[styles.chip, editSubcategoryType === type && styles.chipActive]}
                        onPress={() => {
                          setEditSubcategoryType(type);
                          if (type === 'open_donation') {
                            setEditSubcategoryAmount('');
                          }
                        }}>
                        <Text
                          style={[
                            styles.chipText,
                            editSubcategoryType === type && styles.chipTextActive,
                          ]}>
                          {type === 'open_donation' ? 'Open Donation' : 'Specific Amount'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                {editSubcategoryType === 'specific_amount' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Fixed amount (₹) *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 1000"
                      keyboardType="numeric"
                      value={editSubcategoryAmount}
                      onChangeText={setEditSubcategoryAmount}
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                )}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Type "confirm" to update *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="confirm"
                    value={editSubcategoryConfirmText}
                    onChangeText={setEditSubcategoryConfirmText}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                  />
                </View>
              </ScrollView>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (editSubcategorySubmitting ||
                    !editSubcategoryTitle.trim() ||
                    (editSubcategoryType === 'specific_amount' && !editSubcategoryAmount.trim())) &&
                    styles.submitButtonDisabled,
                ]}
                onPress={handleUpdateSubcategory}
                activeOpacity={0.9}
                disabled={
                  editSubcategorySubmitting ||
                  !editSubcategoryTitle.trim() ||
                  (editSubcategoryType === 'specific_amount' && !editSubcategoryAmount.trim())
                }>
                {editSubcategorySubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="check" size={14} color="#fff" />
                    <Text style={styles.submitButtonText}>Update subcategory</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Edit offline donation modal */}
      <Modal
        visible={editDonationModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditDonationModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Edit donation</Text>
              <TouchableOpacity onPress={() => setEditDonationModalVisible(false)}>
                <Icon name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Donor name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Donor name"
                  value={editDonorName}
                  onChangeText={setEditDonorName}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.rowItem]}>
                  <Text style={styles.inputLabel}>Phone</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="10-digit"
                    keyboardType="phone-pad"
                    value={editDonorPhone}
                    onChangeText={setEditDonorPhone}
                    maxLength={10}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={[styles.inputGroup, styles.rowItem]}>
                  <Text style={styles.inputLabel}>Amount (₹)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 500"
                    keyboardType="numeric"
                    value={editAmount}
                    onChangeText={setEditAmount}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Address</Text>
                <TextInput
                  style={[styles.input, styles.multiline]}
                  placeholder="Street, city"
                  value={editDonorAddress}
                  onChangeText={setEditDonorAddress}
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Payment status</Text>
                <View style={styles.chipRow}>
                  {(['pending', 'success', 'failed'] as const).map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[styles.chip, editPaymentStatus === status && styles.chipActive]}
                      onPress={() => setEditPaymentStatus(status)}>
                      <Text
                        style={[
                          styles.chipText,
                          editPaymentStatus === status && styles.chipTextActive,
                        ]}>
                        {status.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
            <TouchableOpacity
              style={[styles.submitButton, editDonationSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmitEditDonation}
              activeOpacity={0.9}
              disabled={editDonationSubmitting}>
              {editDonationSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="save" size={14} color="#fff" />
                  <Text style={styles.submitButtonText}>Save changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete offline donation modal */}
      <Modal
        visible={deleteDonationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteDonationModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Delete donation</Text>
              <TouchableOpacity onPress={() => setDeleteDonationModalVisible(false)}>
                <Icon name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                This will permanently delete this offline donation. Type{' '}
                <Text style={{ fontFamily: fonts.heading }}>CONFIRM</Text> to continue.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Type CONFIRM to delete"
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
              />
            </View>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (deleteDonationSubmitting ||
                  deleteConfirmText.trim().toUpperCase() !== 'CONFIRM') &&
                  styles.submitButtonDisabled,
                { backgroundColor: '#f04438' },
              ]}
              onPress={handleConfirmDeleteDonation}
              activeOpacity={0.9}
              disabled={
                deleteDonationSubmitting ||
                deleteConfirmText.trim().toUpperCase() !== 'CONFIRM'
              }>
              {deleteDonationSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="trash" size={14} color="#fff" />
                  <Text style={styles.submitButtonText}>Delete donation</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit expense modal */}
      <Modal
        visible={editExpenseModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditExpenseModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Edit expense</Text>
              <TouchableOpacity onPress={() => setEditExpenseModalVisible(false)}>
                <Icon name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Expense title</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Expense title"
                  value={editExpenseTitle}
                  onChangeText={setEditExpenseTitle}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.input, styles.multiline]}
                  placeholder="Optional notes"
                  value={editExpenseDescription}
                  onChangeText={setEditExpenseDescription}
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
              </View>
              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.rowItem]}>
                  <Text style={styles.inputLabel}>Amount (₹)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 1200"
                    keyboardType="numeric"
                    value={editExpenseAmount}
                    onChangeText={setEditExpenseAmount}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={[styles.inputGroup, styles.rowItem]}>
                  <Text style={styles.inputLabel}>Payment method</Text>
                  <View style={styles.chipRow}>
                    {(['cash', 'online', 'cheque'] as const).map((method) => (
                      <TouchableOpacity
                        key={method}
                        style={[styles.chip, editExpensePaymentMethod === method && styles.chipActive]}
                        onPress={() => setEditExpensePaymentMethod(method)}>
                        <Text
                          style={[
                            styles.chipText,
                            editExpensePaymentMethod === method && styles.chipTextActive,
                          ]}>
                          {method.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Status</Text>
                <View style={styles.chipRow}>
                  {(['approved', 'pending', 'rejected'] as const).map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[styles.chip, editExpenseStatus === status && styles.chipActive]}
                      onPress={() => setEditExpenseStatus(status)}>
                      <Text
                        style={[
                          styles.chipText,
                          editExpenseStatus === status && styles.chipTextActive,
                        ]}>
                        {status.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Transaction ID</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Optional reference"
                  value={editExpenseTxnId}
                  onChangeText={setEditExpenseTxnId}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </ScrollView>
            <TouchableOpacity
              style={[styles.submitButton, editExpenseSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmitEditExpense}
              activeOpacity={0.9}
              disabled={editExpenseSubmitting}>
              {editExpenseSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="save" size={14} color="#fff" />
                  <Text style={styles.submitButtonText}>Save changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete expense modal */}
      <Modal
        visible={deleteExpenseModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteExpenseModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Delete expense</Text>
              <TouchableOpacity onPress={() => setDeleteExpenseModalVisible(false)}>
                <Icon name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                This will permanently delete this expense. Type{' '}
                <Text style={{ fontFamily: fonts.heading }}>CONFIRM</Text> to continue.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Type CONFIRM to delete"
                value={deleteExpenseConfirmText}
                onChangeText={setDeleteExpenseConfirmText}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
              />
            </View>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (deleteExpenseSubmitting ||
                  deleteExpenseConfirmText.trim().toUpperCase() !== 'CONFIRM') &&
                  styles.submitButtonDisabled,
                { backgroundColor: '#f04438' },
              ]}
              onPress={handleConfirmDeleteExpense}
              activeOpacity={0.9}
              disabled={
                deleteExpenseSubmitting ||
                deleteExpenseConfirmText.trim().toUpperCase() !== 'CONFIRM'
              }>
              {deleteExpenseSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="trash" size={14} color="#fff" />
                  <Text style={styles.submitButtonText}>Delete expense</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* User Donations Modal */}
      <Modal
        visible={donationModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDonationModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.userDonationModalContainer]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Donor Donations</Text>
              <TouchableOpacity onPress={() => setDonationModalVisible(false)}>
                <Icon name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            {selectedDonor && (
              <View style={styles.donorProfileHeader}>
                <TouchableOpacity
                  style={styles.donorProfileAvatarContainer}
                  onPress={() => {
                    if (selectedDonor.avatar) {
                      setDonorAvatarModalVisible(true);
                    }
                  }}
                  activeOpacity={0.7}>
                  {selectedDonor.avatar ? (
                    <Image
                      source={{ uri: selectedDonor.avatar }}
                      style={styles.donorProfileAvatar}
                    />
                  ) : (
                    <View style={styles.donorProfileAvatarPlaceholder}>
                      <Text style={styles.donorProfileAvatarText}>
                        {getInitials(selectedDonor.name)}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                <View style={styles.donorProfileInfo}>
                  <Text style={styles.donorProfileName}>{selectedDonor.name}</Text>
                  {selectedDonor.fatherName && (
                    <View style={styles.donorProfileInfoRow}>
                      <Icon name="user-o" size={12} color={colors.textMuted} />
                      <Text style={styles.donorProfileInfoText}>Father: {selectedDonor.fatherName}</Text>
                    </View>
                  )}
                  {selectedDonor.address && (
                    <View style={styles.donorProfileInfoRow}>
                      <Icon name="map-marker" size={12} color={colors.textMuted} />
                      <Text style={styles.donorProfileInfoText} numberOfLines={2}>
                        {selectedDonor.address}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabButton, donationModalTab === 'category' && styles.tabButtonActive]}
                onPress={() => handleUserDonationTabChange('category')}>
                <Text style={[styles.tabLabel, donationModalTab === 'category' && styles.tabLabelActive]}>
                  Category Donation
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, donationModalTab === 'overall' && styles.tabButtonActive]}
                onPress={() => handleUserDonationTabChange('overall')}>
                <Text style={[styles.tabLabel, donationModalTab === 'overall' && styles.tabLabelActive]}>
                  Overall Donation
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.filterToggle}
              onPress={() => setShowUserDonationFilters(!showUserDonationFilters)}
              activeOpacity={0.7}>
              <Icon name={showUserDonationFilters ? 'chevron-up' : 'chevron-down'} size={14} color={colors.text} />
              <Text style={styles.filterToggleText}>Filters & Sort</Text>
              {(userDonationStartDate ||
                userDonationEndDate ||
                (canViewStatusFilters && userDonationPaymentStatus !== 'all') ||
                userDonationSortBy !== 'date' ||
                userDonationSortOrder !== 'desc') && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>Active</Text>
                </View>
              )}
            </TouchableOpacity>

            {showUserDonationFilters && (
              <View style={styles.filterContainer}>
                <View style={styles.filterRow}>
                  <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Start date</Text>
                    <TouchableOpacity
                      style={styles.dateInput}
                      onPress={() => setShowUserDonationStartDatePicker(true)}
                      activeOpacity={0.7}>
                      <Text
                        style={[
                          styles.dateInputText,
                          !userDonationStartDate && styles.dateInputPlaceholder,
                        ]}>
                        {userDonationStartDate ? formatDateForDisplay(userDonationStartDate) : 'Start date'}
                      </Text>
                      <Icon name="calendar" size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>End date</Text>
                    <TouchableOpacity
                      style={styles.dateInput}
                      onPress={() => setShowUserDonationEndDatePicker(true)}
                      activeOpacity={0.7}>
                      <Text
                        style={[styles.dateInputText, !userDonationEndDate && styles.dateInputPlaceholder]}>
                        {userDonationEndDate ? formatDateForDisplay(userDonationEndDate) : 'End date'}
                      </Text>
                      <Icon name="calendar" size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>

                {canViewStatusFilters && (
                  <View style={styles.filterRow}>
                    <View style={styles.filterGroup}>
                      <Text style={styles.filterLabel}>Payment status</Text>
                      <View style={styles.chipRow}>
                        {(['all', 'success', 'pending', 'failed'] as const).map((status) => (
                          <TouchableOpacity
                            key={status}
                            style={[
                              styles.chip,
                              userDonationPaymentStatus === status && styles.chipActive,
                            ]}
                            onPress={() => setUserDonationPaymentStatus(status)}
                            activeOpacity={0.7}>
                            <Text
                              style={[
                                styles.chipText,
                                userDonationPaymentStatus === status && styles.chipTextActive,
                              ]}>
                              {status.toUpperCase()}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.filterRow}>
                  <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Sort by</Text>
                    <View style={styles.chipRow}>
                      <TouchableOpacity
                        style={[styles.chip, userDonationSortBy === 'date' && styles.chipActive]}
                        onPress={() => setUserDonationSortBy('date')}
                        activeOpacity={0.7}>
                        <Text
                          style={[
                            styles.chipText,
                            userDonationSortBy === 'date' && styles.chipTextActive,
                          ]}>
                          Date
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.chip, userDonationSortBy === 'amount' && styles.chipActive]}
                        onPress={() => setUserDonationSortBy('amount')}
                        activeOpacity={0.7}>
                        <Text
                          style={[
                            styles.chipText,
                            userDonationSortBy === 'amount' && styles.chipTextActive,
                          ]}>
                          Amount
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Order</Text>
                    <View style={styles.chipRow}>
                      <TouchableOpacity
                        style={[styles.chip, userDonationSortOrder === 'asc' && styles.chipActive]}
                        onPress={() => setUserDonationSortOrder('asc')}
                        activeOpacity={0.7}>
                        <Text
                          style={[
                            styles.chipText,
                            userDonationSortOrder === 'asc' && styles.chipTextActive,
                          ]}>
                          Asc
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.chip, userDonationSortOrder === 'desc' && styles.chipActive]}
                        onPress={() => setUserDonationSortOrder('desc')}
                        activeOpacity={0.7}>
                        <Text
                          style={[
                            styles.chipText,
                            userDonationSortOrder === 'desc' && styles.chipTextActive,
                          ]}>
                          Desc
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <View style={styles.filterActions}>
                  <TouchableOpacity
                    style={styles.filterClearButton}
                    onPress={handleClearUserDonationFilters}
                    activeOpacity={0.7}>
                    <Text style={styles.filterClearText}>Clear</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.filterApplyButton}
                    onPress={handleApplyUserDonationFilters}
                    activeOpacity={0.7}>
                    <Text style={styles.filterApplyText}>Apply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {donationModalTab === 'category' && userDonationsCategorySummary && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryCardTitle}>Summary</Text>
                {canViewStatusFilters ? (
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Total</Text>
                      <Text style={styles.summaryValue}>{userDonationsCategorySummary.totalDonations}</Text>
                      <Text style={styles.summaryAmount}>{formatCurrency(userDonationsCategorySummary.totalAmount)}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Success</Text>
                      <Text style={styles.summaryValue}>{userDonationsCategorySummary.successCount}</Text>
                      <Text style={[styles.summaryAmount, styles.summaryAmountSuccess]}>
                        {formatCurrency(userDonationsCategorySummary.successAmount)}
                      </Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Pending</Text>
                      <Text style={styles.summaryValue}>{userDonationsCategorySummary.pendingCount}</Text>
                      <Text style={[styles.summaryAmount, styles.summaryAmountPending]}>
                        {formatCurrency(userDonationsCategorySummary.pendingAmount)}
                      </Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Failed</Text>
                      <Text style={styles.summaryValue}>{userDonationsCategorySummary.failedCount}</Text>
                      <Text style={[styles.summaryAmount, styles.summaryAmountFailed]}>
                        {formatCurrency(userDonationsCategorySummary.failedAmount)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.summaryRow}>
                    <View style={[styles.summaryItem, styles.summaryItemFull]}>
                      <Text style={styles.summaryLabel}>Total Donations</Text>
                      <Text style={styles.summaryValue}>{userDonationsCategorySummary.totalDonations}</Text>
                      <Text style={styles.summaryAmount}>{formatCurrency(userDonationsCategorySummary.totalAmount)}</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {donationModalTab === 'overall' && userDonationsOverallSummary && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryCardTitle}>Summary</Text>
                {canViewStatusFilters ? (
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Total</Text>
                      <Text style={styles.summaryValue}>{userDonationsOverallSummary.totalDonations}</Text>
                      <Text style={styles.summaryAmount}>{formatCurrency(userDonationsOverallSummary.totalAmount)}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Success</Text>
                      <Text style={styles.summaryValue}>{userDonationsOverallSummary.successCount}</Text>
                      <Text style={[styles.summaryAmount, styles.summaryAmountSuccess]}>
                        {formatCurrency(userDonationsOverallSummary.successAmount)}
                      </Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Pending</Text>
                      <Text style={styles.summaryValue}>{userDonationsOverallSummary.pendingCount}</Text>
                      <Text style={[styles.summaryAmount, styles.summaryAmountPending]}>
                        {formatCurrency(userDonationsOverallSummary.pendingAmount)}
                      </Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Failed</Text>
                      <Text style={styles.summaryValue}>{userDonationsOverallSummary.failedCount}</Text>
                      <Text style={[styles.summaryAmount, styles.summaryAmountFailed]}>
                        {formatCurrency(userDonationsOverallSummary.failedAmount)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.summaryRow}>
                    <View style={[styles.summaryItem, styles.summaryItemFull]}>
                      <Text style={styles.summaryLabel}>Total Donations</Text>
                      <Text style={styles.summaryValue}>{userDonationsOverallSummary.totalDonations}</Text>
                      <Text style={styles.summaryAmount}>{formatCurrency(userDonationsOverallSummary.totalAmount)}</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            <ScrollView
              style={styles.userDonationList}
              showsVerticalScrollIndicator={false}
              onScroll={(event) => {
                const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
                const threshold = 80;
                const isNearBottom =
                  layoutMeasurement.height + contentOffset.y >= contentSize.height - threshold;
                if (isNearBottom) {
                  if (donationModalTab === 'category' && userDonationsCategoryHasMore && !userDonationsCategoryLoadingMore) {
                    fetchUserDonations('category', userDonationsCategoryPage + 1, false);
                  } else if (
                    donationModalTab === 'overall' &&
                    userDonationsOverallHasMore &&
                    !userDonationsOverallLoadingMore
                  ) {
                    fetchUserDonations('overall', userDonationsOverallPage + 1, false);
                  }
                }
              }}
              scrollEventThrottle={16}>
              {userDonationsLoading ? (
                <View style={styles.loader}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loaderText}>Loading donations...</Text>
                </View>
              ) : donationModalTab === 'category' ? (
                sortedUserDonationsCategory.length > 0 ? (
                  sortedUserDonationsCategory.map((donation) => {
                    const donorName = donation.donor?.name || 'Anonymous';
                    const donorAvatar = donation.donor?.avatar;
                    return (
                      <View key={donation.id} style={styles.userDonationItem}>
                        <View style={styles.userDonationAvatar}>
                          {donorAvatar ? (
                            <Image
                              source={{ uri: donorAvatar }}
                              style={styles.userDonationAvatarImage}
                            />
                          ) : (
                            <View style={styles.userDonationAvatarPlaceholder}>
                              <Text style={styles.userDonationAvatarText}>
                                {getInitials(donorName)}
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.userDonationContent}>
                          <Text style={styles.userDonationName}>{donorName}</Text>
                          <Text style={styles.userDonationSubcategory}>{donation.subcategory.title}</Text>
                          <Text style={styles.userDonationCategory}>{donation.subcategory.category.name}</Text>
                          <Text style={styles.userDonationDate}>{formatDate(donation.createdAt)}</Text>
                          <View
                            style={[
                              styles.statusBadge,
                              donation.payment_status === 'success'
                                ? styles.statusBadgeSuccess
                                : donation.payment_status === 'pending'
                                ? styles.statusBadgePending
                                : styles.statusBadgeFailed,
                            ]}>
                            <Text style={styles.statusBadgeText}>{donation.payment_status.toUpperCase()}</Text>
                          </View>
                        </View>
                        <View style={styles.userDonationAmount}>
                          <Text style={styles.userDonationAmountText}>{formatCurrency(donation.amount)}</Text>
                          <Text style={styles.userDonationMethod}>{donation.payment_method.toUpperCase()}</Text>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.emptyList}>
                    <Icon name="folder-open" size={24} color={colors.textMuted} />
                    <Text style={styles.emptyListText}>No donations found</Text>
                  </View>
                )
              ) : sortedUserDonationsOverall.length > 0 ? (
                sortedUserDonationsOverall.map((donation) => {
                  const donorName = donation.donor?.name || 'Anonymous';
                  const donorAvatar = donation.donor?.avatar;
                  return (
                    <View key={donation.id} style={styles.userDonationItem}>
                      <TouchableOpacity
                        style={styles.userDonationAvatar}
                        onPress={() => handleOpenDonorProfile(donation)}
                        activeOpacity={0.7}>
                        {donorAvatar ? (
                          <Image
                            source={{ uri: donorAvatar }}
                            style={styles.userDonationAvatarImage}
                          />
                        ) : (
                          <View style={styles.userDonationAvatarPlaceholder}>
                            <Text style={styles.userDonationAvatarText}>
                              {getInitials(donorName)}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                      <View style={styles.userDonationContent}>
                        <Text style={styles.userDonationName}>{donorName}</Text>
                        <Text style={styles.userDonationSubcategory}>{donation.subcategory.title}</Text>
                        <Text style={styles.userDonationCategory}>{donation.subcategory.category.name}</Text>
                        <Text style={styles.userDonationDate}>{formatDate(donation.createdAt)}</Text>
                        <View
                          style={[
                            styles.statusBadge,
                            donation.payment_status === 'success'
                              ? styles.statusBadgeSuccess
                              : donation.payment_status === 'pending'
                              ? styles.statusBadgePending
                              : styles.statusBadgeFailed,
                          ]}>
                          <Text style={styles.statusBadgeText}>{donation.payment_status.toUpperCase()}</Text>
                        </View>
                      </View>
                      <View style={styles.userDonationAmount}>
                        <Text style={styles.userDonationAmountText}>{formatCurrency(donation.amount)}</Text>
                        <Text style={styles.userDonationMethod}>{donation.payment_method.toUpperCase()}</Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyList}>
                  <Icon name="folder-open" size={24} color={colors.textMuted} />
                  <Text style={styles.emptyListText}>No donations found</Text>
                </View>
              )}
              {donationModalTab === 'category' && userDonationsCategoryLoadingMore && (
                <View style={styles.loadMore}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              )}
              {donationModalTab === 'overall' && userDonationsOverallLoadingMore && (
                <View style={styles.loadMore}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              )}
            </ScrollView>

            {Platform.OS === 'ios' && showUserDonationStartDatePicker && (
              <Modal visible={showUserDonationStartDatePicker} transparent animationType="slide">
                <View style={styles.datePickerModal}>
                  <View style={styles.datePickerContainer}>
                    <View style={styles.datePickerHeader}>
                      <TouchableOpacity onPress={() => setShowUserDonationStartDatePicker(false)}>
                        <Text style={styles.datePickerCancel}>Cancel</Text>
                      </TouchableOpacity>
                      <Text style={styles.datePickerTitle}>Select start date</Text>
                      <TouchableOpacity
                        onPress={() => {
                          if (!userDonationStartDate) {
                            setUserDonationStartDate(new Date());
                          }
                          setShowUserDonationStartDatePicker(false);
                        }}>
                        <Text style={styles.datePickerDone}>Done</Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={userDonationStartDate || new Date()}
                      mode="date"
                      display="spinner"
                      onChange={handleUserDonationStartDateChange}
                      maximumDate={userDonationEndDate || undefined}
                    />
                  </View>
                </View>
              </Modal>
            )}

            {Platform.OS === 'android' && showUserDonationStartDatePicker && (
              <DateTimePicker
                value={userDonationStartDate || new Date()}
                mode="date"
                display="default"
                onChange={handleUserDonationStartDateChange}
                maximumDate={userDonationEndDate || undefined}
              />
            )}

            {Platform.OS === 'ios' && showUserDonationEndDatePicker && (
              <Modal visible={showUserDonationEndDatePicker} transparent animationType="slide">
                <View style={styles.datePickerModal}>
                  <View style={styles.datePickerContainer}>
                    <View style={styles.datePickerHeader}>
                      <TouchableOpacity onPress={() => setShowUserDonationEndDatePicker(false)}>
                        <Text style={styles.datePickerCancel}>Cancel</Text>
                      </TouchableOpacity>
                      <Text style={styles.datePickerTitle}>Select end date</Text>
                      <TouchableOpacity
                        onPress={() => {
                          if (!userDonationEndDate) {
                            setUserDonationEndDate(new Date());
                          }
                          setShowUserDonationEndDatePicker(false);
                        }}>
                        <Text style={styles.datePickerDone}>Done</Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={userDonationEndDate || new Date()}
                      mode="date"
                      display="spinner"
                      onChange={handleUserDonationEndDateChange}
                      minimumDate={userDonationStartDate || undefined}
                    />
                  </View>
                </View>
              </Modal>
            )}

            {Platform.OS === 'android' && showUserDonationEndDatePicker && (
              <DateTimePicker
                value={userDonationEndDate || new Date()}
                mode="date"
                display="default"
                onChange={handleUserDonationEndDateChange}
                minimumDate={userDonationStartDate || undefined}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Donor Avatar Large Image Modal */}
      <Modal
        visible={donorAvatarModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDonorAvatarModalVisible(false)}>
        <TouchableOpacity
          style={styles.avatarModalOverlay}
          activeOpacity={1}
          onPress={() => setDonorAvatarModalVisible(false)}>
          <View style={styles.avatarModalContainer}>
            {selectedDonor && selectedDonor.avatar && (
              <Image
                source={{ uri: selectedDonor.avatar }}
                style={styles.avatarModalImage}
                resizeMode="contain"
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Payment Amount Modal */}
      <Modal
        visible={paymentAmountModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentAmountModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Enter Donation Amount</Text>
              <TouchableOpacity
                onPress={() => setPaymentAmountModalVisible(false)}
                style={styles.modalCloseButton}>
                <Icon name="times" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              <Text style={styles.modalLabel}>Amount (₹)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter amount"
                placeholderTextColor={colors.textMuted}
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                keyboardType="decimal-pad"
                autoFocus
              />
              <View style={styles.modalButtonRow}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setPaymentAmountModalVisible(false);
                    setPaymentAmount('');
                  }}>
                  <Text style={styles.modalButtonCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonConfirm]}
                  onPress={handleConfirmPaymentAmount}
                  disabled={paymentProcessing}>
                  {paymentProcessing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonConfirmText}>Confirm</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Map donation managers modal */}
      <Modal
        visible={mappingModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setMappingModalVisible(false);
          // Reset state on close
          setSelectedManagers(new Set());
          setCurrentMappings(new Set());
          setDonationManagers([]);
        }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Map donation managers</Text>
              <TouchableOpacity
                onPress={() => {
                  setMappingModalVisible(false);
                  // Reset state on close
                  setSelectedManagers(new Set());
                  setCurrentMappings(new Set());
                  setDonationManagers([]);
                }}>
                <Icon name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            {mappingLoading ? (
              <View style={styles.mappingLoader}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loaderText}>Loading managers...</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {donationManagers.length === 0 ? (
                  <View style={styles.emptyList}>
                    <Icon name="users" size={24} color={colors.textMuted} />
                    <Text style={styles.emptyListText}>No donation managers found</Text>
                  </View>
                ) : (
                  donationManagers.map((manager) => {
                    const isSelected = selectedManagers.has(manager.id);
                    return (
                      <TouchableOpacity
                        key={manager.id}
                        style={styles.managerItem}
                        onPress={() => handleToggleManagerSelection(manager.id)}
                        activeOpacity={0.7}>
                        <View style={styles.managerItemLeft}>
                          <View
                            style={[
                              styles.checkbox,
                              isSelected && styles.checkboxChecked,
                            ]}>
                            {isSelected && <Icon name="check" size={12} color="#fff" />}
                          </View>
                          <View style={styles.managerInfo}>
                            <Text style={styles.managerName}>{manager.name}</Text>
                            <Text style={styles.managerPhone}>{manager.phone}</Text>
                          </View>
                        </View>
                        {manager.status === 'ACTIVE' ? (
                          <View style={styles.statusBadgeActive}>
                            <Text style={styles.statusBadgeTextSmall}>ACTIVE</Text>
                          </View>
                        ) : (
                          <View style={styles.statusBadgeInactive}>
                            <Text style={styles.statusBadgeTextSmall}>
                              {manager.status}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            )}
            <TouchableOpacity
              style={[styles.submitButton, mappingSubmitting && styles.submitButtonDisabled]}
              onPress={handleSaveMappings}
              activeOpacity={0.9}
              disabled={mappingSubmitting || mappingLoading}>
              {mappingSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="save" size={14} color="#fff" />
                  <Text style={styles.submitButtonText}>Save mappings</Text>
                </>
              )}
            </TouchableOpacity>
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
  listHeaderContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 140,
    gap: 16,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loaderText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  backButtonText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  headerCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 16,
    gap: 6,
  },
  categoryLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  subcategoryTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.text,
  },
  subcategoryDescription: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  summaryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  summaryStat: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.cardMuted,
  },
  summaryStatLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },
  summaryStatValue: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.text,
    marginTop: 4,
  },
  netBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.cardMuted,
    marginTop: 8,
  },
  netBalanceLabel: {
    fontFamily: fonts.heading,
    fontSize: 13,
    color: colors.text,
  },
  netBalanceValue: {
    fontFamily: fonts.heading,
    fontSize: 18,
    fontWeight: '700',
  },
  netBalancePositive: {
    color: '#12b886',
  },
  netBalanceNegative: {
    color: '#f04438',
  },
  netPositive: {
    color: '#12b886',
  },
  netNegative: {
    color: '#f04438',
  },
  metaText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
  managersContainer: {
    marginTop: 8,
    gap: 4,
  },
  managersLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 2,
  },
  managerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  managerText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.text,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.cardMuted,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabLabel: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.text,
  },
  tabLabelActive: {
    color: '#fff',
  },
  card: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.text,
  },
  cardSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemTitle: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.text,
  },
  itemFatherName: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  itemMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  itemDate: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  itemAmount: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: '#12b886',
  },
  expenseAmount: {
    color: '#f04438',
  },
  emptyList: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  emptyListText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },
  moreButton: {
    paddingLeft: 4,
  },
  itemDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusBadgeSuccess: {
    backgroundColor: 'rgba(18, 184, 134, 0.12)',
  },
  statusBadgePending: {
    backgroundColor: 'rgba(234, 179, 8, 0.16)',
  },
  statusBadgeFailed: {
    backgroundColor: 'rgba(240, 68, 56, 0.16)',
  },
  statusBadgeText: {
    fontFamily: fonts.heading,
    fontSize: 10,
    color: colors.text,
  },
  loadMore: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  fabContainer: {
    position: 'absolute',
    right: 20,
    bottom: 90,
    gap: 12,
    zIndex: 999,
  },
  fabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  fabLabel: {
    fontFamily: fonts.heading,
    fontSize: 13,
    color: '#fff',
  },
  fabToggle: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 1000,
  },
  fabToggleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '90%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.text,
  },
  modalScroll: {
    maxHeight: 350,
  },
  inputGroup: {
    marginBottom: 12,
    gap: 6,
  },
  inputLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  generateIdInline: {
    fontFamily: fonts.heading,
    fontSize: 11,
    color: colors.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
  },
  multiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowItem: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text,
  },
  chipTextActive: {
    color: '#fff',
  },
  submitButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontFamily: fonts.heading,
    fontSize: 15,
    color: '#fff',
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.cardMuted,
    marginBottom: 12,
  },
  filterToggleText: {
    fontFamily: fonts.heading,
    fontSize: 13,
    color: colors.text,
    flex: 1,
  },
  filterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  filterBadgeText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#fff',
  },
  filterContainer: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.card,
    marginBottom: 16,
    gap: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
  },
  filterGroup: {
    flex: 1,
    gap: 6,
  },
  filterLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  dateInputText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text,
  },
  dateInputPlaceholder: {
    color: colors.textMuted,
  },
  filterActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  filterClearButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  filterClearText: {
    fontFamily: fonts.heading,
    fontSize: 13,
    color: colors.text,
  },
  filterApplyButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  filterApplyText: {
    fontFamily: fonts.heading,
    fontSize: 13,
    color: '#fff',
  },
  filteredTotalsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    backgroundColor: colors.cardMuted,
    borderRadius: 8,
  },
  filteredTotalsLabel: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.textMuted,
    marginBottom: 4,
  },
  filteredTotalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  filteredTotalText: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.textMuted,
  },
  filteredTotalValue: {
    fontFamily: fonts.heading,
    fontSize: 9,
    color: colors.text,
  },
  filteredTotalPositive: {
    color: '#12b886',
  },
  filteredTotalNegative: {
    color: '#f04438',
  },
  filteredTotalExpense: {
    color: '#f04438',
  },
  datePickerModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  datePickerContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  datePickerTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.text,
  },
  datePickerCancel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
  datePickerDone: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.primary,
  },
  mappingLoader: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  managerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.cardMuted,
    marginBottom: 8,
  },
  managerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  managerInfo: {
    flex: 1,
  },
  managerName: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.text,
  },
  managerPhone: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusBadgeActive: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(18, 184, 134, 0.12)',
  },
  statusBadgeInactive: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(240, 68, 56, 0.12)',
  },
  statusBadgeTextSmall: {
    fontFamily: fonts.heading,
    fontSize: 9,
    color: colors.text,
  },
  userDonationModalContainer: {
    maxHeight: '90%',
  },
  searchButton: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: '#fff',
  },
  userDonationList: {
    maxHeight: 400,
    marginTop: 12,
  },
  userDonationItem: {
    flexDirection: 'row',
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: colors.cardMuted,
    gap: 12,
  },
  userDonationAvatar: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDonationAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userDonationAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDonationAvatarText: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: '#fff',
  },
  userDonationContent: {
    flex: 1,
    gap: 4,
  },
  userDonationName: {
    fontFamily: fonts.heading,
    fontSize: 15,
    color: colors.text,
  },
  userDonationSubcategory: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text,
  },
  userDonationCategory: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
  },
  userDonationDate: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
  userDonationAmount: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  userDonationAmountText: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: '#12b886',
  },
  userDonationMethod: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },
  summaryCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.cardMuted,
    marginTop: 12,
    marginBottom: 12,
  },
  summaryCardTitle: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  summaryItemFull: {
    flex: 1,
    minWidth: '100%',
  },
  summaryLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 4,
  },
  summaryValue: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.text,
  },
  summaryAmount: {
    fontFamily: fonts.heading,
    fontSize: 12,
    color: colors.text,
    marginTop: 4,
  },
  summaryAmountSuccess: {
    color: '#12b886',
  },
  summaryAmountPending: {
    color: '#b8860b',
  },
  summaryAmountFailed: {
    color: '#f04438',
  },
  donorProfileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.cardMuted,
    marginBottom: 12,
    gap: 12,
  },
  donorProfileAvatarContainer: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  donorProfileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  donorProfileAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  donorProfileAvatarText: {
    fontFamily: fonts.heading,
    fontSize: 24,
    color: '#fff',
  },
  donorProfileInfo: {
    flex: 1,
    gap: 6,
  },
  donorProfileName: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.text,
    marginBottom: 2,
  },
  donorProfileInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  donorProfileInfoText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text,
  },
  donorProfileModalContainer: {
    maxHeight: '80%',
    width: '90%',
    alignSelf: 'center',
  },
  donorProfileContent: {
    maxHeight: 500,
  },
  donorProfileLargeAvatarContainer: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 12,
  },
  donorProfileLargeAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  donorProfileLargeAvatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  donorProfileLargeAvatarText: {
    fontFamily: fonts.heading,
    fontSize: 48,
    color: '#fff',
  },
  donorProfileDetails: {
    gap: 16,
    paddingHorizontal: 8,
  },
  donorProfileDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  donorProfileDetailLabel: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.textMuted,
    minWidth: 80,
  },
  donorProfileDetailValue: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  avatarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarModalContainer: {
    width: '90%',
    height: '70%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarModalImage: {
    width: '100%',
    height: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    gap: 16,
  },
  modalLabel: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.text,
    backgroundColor: colors.card,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalButtonCancelText: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.text,
  },
  modalButtonConfirm: {
    backgroundColor: colors.primary,
  },
  modalButtonConfirmText: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: '#fff',
  },
});


