import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import Icon from 'react-native-vector-icons/FontAwesome';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { DonationStackParamList } from '../navigation/DonationNavigator';
import { DonationService, type DonationRecord } from '../services/donations';
import { ExpenseService, type ExpenseRecord } from '../services/expenses';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { useAuth } from '../context/AuthContext';

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

export const SubcategoryDetailScreen = ({ route, navigation }: Props) => {
  const { currentUser } = useAuth();
  const {
    categoryId,
    categoryName,
    subcategoryId,
    subcategoryTitle,
    subcategoryDescription,
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

  // Filter and sort states
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [sortBy, setSortBy] = useState<'amount' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const canManageSubcategory = useMemo(() => {
    if (!currentUser || currentUser.account_type !== 'MANAGEMENT') {
      return false;
    }
    if (currentUser.role === 'ADMIN' || currentUser.role === 'SUB_ADMIN') {
      return true;
    }
    if (currentUser.role === 'DONATION_MANAGER') {
      return (managers || []).some((manager) => manager.id === currentUser.id);
    }
    return false;
  }, [currentUser, managers]);

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
    [subcategoryId, startDate, endDate],
  );

  const fetchExpenses = useCallback(
    async (page: number = 1) => {
      const params: Parameters<typeof ExpenseService.listExpenses>[0] = {
        subcategory_id: subcategoryId,
        page,
        limit: 10,
      };
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
    [subcategoryId, startDate, endDate],
  );

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchDonations(1), fetchExpenses(1)]);
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
  }, [fetchDonations, fetchExpenses]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchDonations(1), fetchExpenses(1)]);
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

  const handleMapManager = () => {
    Alert.alert(
      'Assign donation manager',
      'Mapping UI will be integrated soon. Please use the admin console meanwhile.',
    );
  };

  const handleDonateNow = () => {
    Toast.show({
      type: 'info',
      text1: 'Donate now',
      text2: 'Razorpay flow coming soon!',
    });
  };

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
        sortedDonations.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle}>{item.donor?.name || 'Anonymous donor'}</Text>
              <Text style={styles.itemMeta}>{item.payment_method.toUpperCase()}</Text>
              <Text style={styles.itemDate}>{formatDate(item.createdAt)}</Text>
            </View>
            <Text style={styles.itemAmount}>{formatCurrency(item.amount)}</Text>
          </View>
        ))
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
        sortedExpenses.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle}>{item.expense_title}</Text>
              <Text style={styles.itemMeta}>
                {item.payment_method.toUpperCase()} • {item.status.toUpperCase()}
              </Text>
              <Text style={styles.itemDate}>{formatDate(item.createdAt)}</Text>
            </View>
            <Text style={[styles.itemAmount, styles.expenseAmount]}>{formatCurrency(item.amount)}</Text>
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
        <Text style={styles.metaText}>
          Managers:{' '}
          {managers?.length
            ? managers.map((manager) => manager.name).join(', ')
            : 'Not assigned'}
        </Text>
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
                  {startDate ? formatDateForDisplay(startDate) : 'Select start date'}
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
                  {endDate ? formatDateForDisplay(endDate) : 'Select end date'}
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
});


