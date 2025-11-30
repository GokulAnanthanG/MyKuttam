import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/FontAwesome';
import Toast from 'react-native-toast-message';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  DailyActiveUserService,
  type ActiveUser,
  type DailyActiveUserCount,
  type DailyActiveUserCountRange,
} from '../services/dailyActiveUsers';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackNavigationProp<RootStackParamList>;

const formatDate = (dateString: string) => {
  try {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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

const getInitials = (name: string): string => {
  if (!name || name.trim().length === 0) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export const ActiveUsersScreen = () => {
  const navigation = useNavigation<Props>();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'stats' | 'users'>('stats');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Stats states
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateCount, setSelectedDateCount] = useState<number | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [rangeStartDate, setRangeStartDate] = useState<Date | null>(null);
  const [rangeEndDate, setRangeEndDate] = useState<Date | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [rangeData, setRangeData] = useState<DailyActiveUserCountRange | null>(null);
  const [loadingRange, setLoadingRange] = useState(false);

  // Users list states
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersHasMore, setUsersHasMore] = useState(true);
  const [usersLoadingMore, setUsersLoadingMore] = useState(false);
  const [usersDate, setUsersDate] = useState<Date | null>(null);
  const [showUsersDatePicker, setShowUsersDatePicker] = useState(false);

  const fetchTodayCount = useCallback(async () => {
    try {
      const response = await DailyActiveUserService.getDailyCount();
      if (response.success && response.data) {
        setTodayCount(response.data.count);
      }
    } catch (error) {
      console.error('Error fetching today count:', error);
    }
  }, []);

  const fetchSelectedDateCount = useCallback(async (date: Date) => {
    try {
      const dateStr = formatDateForAPI(date);
      const response = await DailyActiveUserService.getDailyCount(dateStr);
      if (response.success && response.data) {
        setSelectedDateCount(response.data.count);
      } else {
        setSelectedDateCount(0);
      }
    } catch (error) {
      console.error('Error fetching selected date count:', error);
      setSelectedDateCount(0);
    }
  }, []);

  const fetchRangeData = useCallback(async () => {
    if (!rangeStartDate || !rangeEndDate) {
      Toast.show({
        type: 'error',
        text1: 'Date range required',
        text2: 'Please select both start and end dates.',
      });
      return;
    }

    setLoadingRange(true);
    try {
      const startStr = formatDateForAPI(rangeStartDate);
      const endStr = formatDateForAPI(rangeEndDate);
      const response = await DailyActiveUserService.getDailyCountRange(startStr, endStr);
      if (response.success && response.data) {
        setRangeData(response.data);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.message || 'Failed to fetch range data',
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error instanceof Error ? error.message : 'Failed to fetch range data',
      });
    } finally {
      setLoadingRange(false);
    }
  }, [rangeStartDate, rangeEndDate]);

  const fetchUsers = useCallback(
    async (page: number = 1, reset: boolean = false) => {
      if (reset) {
        setUsersLoadingMore(false);
      } else {
        setUsersLoadingMore(true);
      }

      try {
        const params: any = {
          page,
          limit: 20,
        };
        // Use the selected date or default to today
        if (usersDate) {
          params.date = formatDateForAPI(usersDate);
        }

        const response = await DailyActiveUserService.getActiveUsersWithDetails(params);
        if (response.success && response.data) {
          if (reset) {
            setUsers(response.data.users);
          } else {
            setUsers((prev) => [...prev, ...response.data!.users]);
          }
          setUsersPage(page);
          setUsersHasMore(page < response.data.pagination.totalPages);
        } else {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: response.message || 'Failed to fetch active users',
          });
        }
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: error instanceof Error ? error.message : 'Failed to fetch users',
        });
      } finally {
        setUsersLoadingMore(false);
      }
    },
    [usersDate],
  );

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchTodayCount();
      setLoading(false);
    };
    loadData();
  }, [fetchTodayCount]);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'stats') {
      await fetchTodayCount();
      if (selectedDate) {
        await fetchSelectedDateCount(selectedDate);
      }
    } else {
      await fetchUsers(1, true);
    }
    setRefreshing(false);
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
      fetchSelectedDateCount(date);
    }
  };

  const handleStartDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartDatePicker(false);
    }
    if (date) {
      setRangeStartDate(date);
    }
  };

  const handleEndDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndDatePicker(false);
    }
    if (date) {
      setRangeEndDate(date);
    }
  };

  const handleLoadMoreUsers = () => {
    if (!usersHasMore || usersLoadingMore) return;
    fetchUsers(usersPage + 1, false);
  };


  const handleUsersDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowUsersDatePicker(false);
    }
    if (date) {
      setUsersDate(date);
      // Fetch users for the selected date
      fetchUsers(1, true);
    }
  };

  const renderStatsTab = () => (
    <ScrollView
      style={styles.statsContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}>
      <View style={styles.statsCard}>
        <Text style={styles.statsCardTitle}>Today's Active Users</Text>
        <Text style={styles.statsCardValue}>{todayCount !== null ? todayCount : '--'}</Text>
        <Text style={styles.statsCardSubtitle}>Users active today</Text>
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.statsCardTitle}>Count by Date</Text>
        <TouchableOpacity
          style={styles.dateInput}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.7}>
          <Text style={[styles.dateInputText, !selectedDate && styles.dateInputPlaceholder]}>
            {selectedDate ? formatDate(selectedDate.toISOString()) : 'Select date'}
          </Text>
          <Icon name="calendar" size={16} color={colors.textMuted} />
        </TouchableOpacity>
        {selectedDateCount !== null && (
          <View style={styles.countResult}>
            <Text style={styles.countResultLabel}>Active Users:</Text>
            <Text style={styles.countResultValue}>{selectedDateCount}</Text>
          </View>
        )}
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.statsCardTitle}>Date Range Statistics</Text>
        <View style={styles.dateRangeRow}>
          <TouchableOpacity
            style={[styles.dateInput, styles.dateInputHalf]}
            onPress={() => setShowStartDatePicker(true)}
            activeOpacity={0.7}>
            <Text style={[styles.dateInputText, !rangeStartDate && styles.dateInputPlaceholder]}>
              {rangeStartDate ? formatDate(rangeStartDate.toISOString()) : 'Start date'}
            </Text>
            <Icon name="calendar" size={14} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dateInput, styles.dateInputHalf]}
            onPress={() => setShowEndDatePicker(true)}
            activeOpacity={0.7}>
            <Text style={[styles.dateInputText, !rangeEndDate && styles.dateInputPlaceholder]}>
              {rangeEndDate ? formatDate(rangeEndDate.toISOString()) : 'End date'}
            </Text>
            <Icon name="calendar" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.fetchButton, loadingRange && styles.fetchButtonDisabled]}
          onPress={fetchRangeData}
          disabled={loadingRange || !rangeStartDate || !rangeEndDate}
          activeOpacity={0.7}>
          {loadingRange ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="line-chart" size={14} color="#fff" />
              <Text style={styles.fetchButtonText}>Fetch Range Data</Text>
            </>
          )}
        </TouchableOpacity>
        {rangeData && (
          <View style={styles.rangeResults}>
            <Text style={styles.rangeResultsTitle}>
              Daily Counts ({rangeData.dailyCounts.length} days)
            </Text>
            <ScrollView style={styles.rangeResultsList} nestedScrollEnabled>
              {rangeData.dailyCounts.map((item, index) => (
                <View key={index} style={styles.rangeResultItem}>
                  <Text style={styles.rangeResultDate}>{formatDate(item.date)}</Text>
                  <Text style={styles.rangeResultCount}>{item.count}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {Platform.OS === 'ios' && showDatePicker && (
        <Modal visible={showDatePicker} transparent animationType="slide">
          <View style={styles.datePickerModal}>
            <View style={styles.datePickerContainer}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.datePickerCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.datePickerTitle}>Select date</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (!selectedDate) {
                      setSelectedDate(new Date());
                    }
                    setShowDatePicker(false);
                  }}>
                  <Text style={styles.datePickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={selectedDate || new Date()}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                maximumDate={new Date()}
              />
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === 'android' && showDatePicker && (
        <DateTimePicker
          value={selectedDate || new Date()}
          mode="date"
          display="default"
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
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
                    if (!rangeStartDate) {
                      setRangeStartDate(new Date());
                    }
                    setShowStartDatePicker(false);
                  }}>
                  <Text style={styles.datePickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={rangeStartDate || new Date()}
                mode="date"
                display="spinner"
                onChange={handleStartDateChange}
                maximumDate={rangeEndDate || new Date()}
              />
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === 'android' && showStartDatePicker && (
        <DateTimePicker
          value={rangeStartDate || new Date()}
          mode="date"
          display="default"
          onChange={handleStartDateChange}
          maximumDate={rangeEndDate || new Date()}
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
                    if (!rangeEndDate) {
                      setRangeEndDate(new Date());
                    }
                    setShowEndDatePicker(false);
                  }}>
                  <Text style={styles.datePickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={rangeEndDate || new Date()}
                mode="date"
                display="spinner"
                onChange={handleEndDateChange}
                minimumDate={rangeStartDate || undefined}
                maximumDate={new Date()}
              />
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === 'android' && showEndDatePicker && (
        <DateTimePicker
          value={rangeEndDate || new Date()}
          mode="date"
          display="default"
          onChange={handleEndDateChange}
          minimumDate={rangeStartDate || undefined}
          maximumDate={new Date()}
        />
      )}
    </ScrollView>
  );

  const renderUsersTab = () => (
    <View style={styles.usersContainer}>
      <View style={styles.filtersContainer}>
        <Text style={styles.filtersTitle}>Active Users by Date</Text>
        <Text style={styles.filtersSubtitle}>
          View users who were active on a specific date with full details
        </Text>
        <TouchableOpacity
          style={styles.dateInput}
          onPress={() => setShowUsersDatePicker(true)}
          activeOpacity={0.7}>
          <Text style={[styles.dateInputText, !usersDate && styles.dateInputPlaceholder]}>
            {usersDate ? formatDate(usersDate.toISOString()) : 'Select date (defaults to today)'}
          </Text>
          <Icon name="calendar" size={16} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.filterClearButton}
          onPress={() => {
            setUsersDate(null);
            fetchUsers(1, true);
          }}
          activeOpacity={0.7}>
          <Text style={styles.filterClearText}>View Today's Active Users</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.userCard}>
            <View style={styles.userAvatar}>
              {item.avatar ? (
                <Image source={{ uri: item.avatar }} style={styles.userAvatarImage} />
              ) : (
                <View style={styles.userAvatarPlaceholder}>
                  <Text style={styles.userAvatarText}>{getInitials(item.name)}</Text>
                </View>
              )}
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{item.name}</Text>
              {item.father_name && <Text style={styles.userFatherName}>Father: {item.father_name}</Text>}
              {item.address && <Text style={styles.userAddress} numberOfLines={2}>{item.address}</Text>}
              <Text style={styles.userPhone}>{item.phone}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          !usersLoadingMore ? (
            <View style={styles.emptyState}>
              <Icon name="users" size={32} color={colors.textMuted} />
              <Text style={styles.emptyStateText}>No users found</Text>
            </View>
          ) : null
        }
        onEndReached={handleLoadMoreUsers}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        ListFooterComponent={
          usersLoadingMore ? (
            <View style={styles.loadMore}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
      />

      {Platform.OS === 'ios' && showUsersDatePicker && (
        <Modal visible={showUsersDatePicker} transparent animationType="slide">
          <View style={styles.datePickerModal}>
            <View style={styles.datePickerContainer}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity onPress={() => setShowUsersDatePicker(false)}>
                  <Text style={styles.datePickerCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.datePickerTitle}>Select date</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (!usersDate) {
                      setUsersDate(new Date());
                    }
                    setShowUsersDatePicker(false);
                  }}>
                  <Text style={styles.datePickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={usersDate || new Date()}
                mode="date"
                display="spinner"
                onChange={handleUsersDateChange}
                maximumDate={new Date()}
              />
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === 'android' && showUsersDatePicker && (
        <DateTimePicker
          value={usersDate || new Date()}
          mode="date"
          display="default"
          onChange={handleUsersDateChange}
          maximumDate={new Date()}
        />
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Loading active users data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Icon name="arrow-left" size={18} color={colors.text} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Active Users</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'stats' && styles.tabButtonActive]}
          onPress={() => setActiveTab('stats')}
          activeOpacity={0.7}>
          <Text style={[styles.tabLabel, activeTab === 'stats' && styles.tabLabelActive]}>Statistics</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'users' && styles.tabButtonActive]}
          onPress={() => {
            setActiveTab('users');
            if (users.length === 0) {
              // Fetch users (will default to today if no date selected)
              fetchUsers(1, true);
            }
          }}
          activeOpacity={0.7}>
          <Text style={[styles.tabLabel, activeTab === 'users' && styles.tabLabelActive]}>Active Users</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'stats' ? renderStatsTab() : renderUsersTab()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButtonText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 60,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
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
  statsContainer: {
    flex: 1,
    padding: 16,
  },
  statsCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statsCardTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.text,
    marginBottom: 8,
  },
  statsCardValue: {
    fontFamily: fonts.heading,
    fontSize: 32,
    color: colors.primary,
    marginBottom: 4,
  },
  statsCardSubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginTop: 8,
  },
  dateInputHalf: {
    flex: 1,
  },
  dateInputText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  dateInputPlaceholder: {
    color: colors.textMuted,
  },
  dateRangeRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  countResult: {
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.cardMuted,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countResultLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
  countResultValue: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.primary,
  },
  fetchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  fetchButtonDisabled: {
    opacity: 0.6,
  },
  fetchButtonText: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: '#fff',
  },
  rangeResults: {
    marginTop: 16,
    padding: 12,
    backgroundColor: colors.cardMuted,
    borderRadius: 8,
  },
  rangeResultsTitle: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.text,
    marginBottom: 12,
  },
  rangeResultsList: {
    maxHeight: 200,
  },
  rangeResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rangeResultDate: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text,
  },
  rangeResultCount: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.primary,
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
  usersContainer: {
    flex: 1,
  },
  filtersContainer: {
    padding: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filtersTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.text,
    marginBottom: 8,
  },
  filtersSubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 12,
  },
  filterClearButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  filterClearText: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.text,
  },
  userCard: {
    flexDirection: 'row',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  userAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: '#fff',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.text,
    marginBottom: 4,
  },
  userFatherName: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  userAddress: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  userPhone: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 12,
  },
  loadMore: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});

