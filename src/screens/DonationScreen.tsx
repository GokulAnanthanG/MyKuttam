import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/FontAwesome';
import Toast from 'react-native-toast-message';
import { DonationStackParamList } from '../navigation/DonationNavigator';
import {
  DonationService,
  type DonationCategorySummary,
  type DonationSubcategory,
} from '../services/donations';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { useAuth } from '../context/AuthContext';
import {
  pinCategory,
  unpinCategory,
  getPinnedCategoryIds,
} from '../storage/donationRealm';

const formatCurrency = (value?: number) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '₹0.00';
  }
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const DonationScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<DonationStackParamList>>();
  const { currentUser } = useAuth();
  const [categories, setCategories] = useState<DonationCategorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [subcategoryModal, setSubcategoryModal] = useState<{
    visible: boolean;
    categoryId: string | null;
    categoryName: string;
  }>({ visible: false, categoryId: null, categoryName: '' });
  const [subcategoryTitle, setSubcategoryTitle] = useState('');
  const [subcategoryDescription, setSubcategoryDescription] = useState('');
  const [subcategoryType, setSubcategoryType] = useState<'open_donation' | 'specific_amount'>('open_donation');
  const [subcategoryAmount, setSubcategoryAmount] = useState('');
  const [subcategorySubmitting, setSubcategorySubmitting] = useState(false);
  const [pinnedCategoryIds, setPinnedCategoryIds] = useState<Set<string>>(new Set());

  const isAdminUser = useMemo(() => {
    if (!currentUser?.role) {
      return false;
    }
    return currentUser.role === 'ADMIN' || currentUser.role === 'SUB_ADMIN';
  }, [currentUser?.role]);

  const loadSummary = useCallback(async (options?: { isRefresh?: boolean }) => {
    if (!options?.isRefresh) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await DonationService.getCategoriesSummary();
      if (response.success && Array.isArray(response.data)) {
        setCategories(response.data);
      } else {
        throw new Error(response.message || 'Unable to load donation summary');
      }
    } catch (err) {
      setCategories([]);
      setError(err instanceof Error ? err.message : 'Unable to load donation summary');
    } finally {
      if (options?.isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadSummary();
    loadPinnedCategories();
  }, [loadSummary]);

  const loadPinnedCategories = useCallback(async () => {
    try {
      const pinnedIds = await getPinnedCategoryIds();
      setPinnedCategoryIds(pinnedIds);
    } catch (error) {
      console.error('Error loading pinned categories:', error);
    }
  }, []);

  const handleTogglePin = useCallback(
    async (categoryId: string) => {
      try {
        const isPinned = pinnedCategoryIds.has(categoryId);
        if (isPinned) {
          await unpinCategory(categoryId);
        } else {
          await pinCategory(categoryId);
        }
        // Update local state
        const newPinnedIds = new Set(pinnedCategoryIds);
        if (isPinned) {
          newPinnedIds.delete(categoryId);
        } else {
          newPinnedIds.add(categoryId);
        }
        setPinnedCategoryIds(newPinnedIds);
      } catch (error) {
        console.error('Error toggling pin:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to update pin status',
        });
      }
    },
    [pinnedCategoryIds],
  );

  const handleToggleCategoryStatus = useCallback(
    async (categoryId: string, currentStatus: 'active' | 'inactive' | undefined) => {
      if (!isAdminUser) {
        return;
      }

      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      
      try {
        const response = await DonationService.updateCategoryStatus(categoryId, newStatus);
        if (response.success) {
          // Update local state
          setCategories((prev) =>
            prev.map((cat) =>
              cat.id === categoryId ? { ...cat, status: newStatus } : cat,
            ),
          );
          Toast.show({
            type: 'success',
            text1: 'Status updated',
            text2: `Category is now ${newStatus}`,
          });
        }
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: error instanceof Error ? error.message : 'Failed to update category status',
        });
      }
    },
    [isAdminUser],
  );

  const handleToggleSubcategoryStatus = useCallback(
    async (subcategoryId: string, categoryId: string, currentStatus: 'active' | 'inactive' | undefined) => {
      if (!isAdminUser) {
        return;
      }

      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      
      try {
        const response = await DonationService.updateSubcategoryStatus(subcategoryId, newStatus);
        if (response.success) {
          // Update local state
          setCategories((prev) =>
            prev.map((cat) =>
              cat.id === categoryId
                ? {
                    ...cat,
                    subcategories: cat.subcategories?.map((sub) =>
                      sub.id === subcategoryId ? { ...sub, status: newStatus } : sub,
                    ),
                  }
                : cat,
            ),
          );
          Toast.show({
            type: 'success',
            text1: 'Status updated',
            text2: `Subcategory is now ${newStatus}`,
          });
        }
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: error instanceof Error ? error.message : 'Failed to update subcategory status',
        });
      }
    },
    [isAdminUser],
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadSummary({ isRefresh: true });
  }, [loadSummary]);

  const sortedCategories = useMemo(() => {
    // Sort categories: pinned first, then by name
    return [...categories].sort((a, b) => {
      const aPinned = pinnedCategoryIds.has(a.id);
      const bPinned = pinnedCategoryIds.has(b.id);
      
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      
      // If both pinned or both unpinned, sort by name
      return a.name.localeCompare(b.name);
    });
  }, [categories, pinnedCategoryIds]);

  const totals = useMemo(() => {
    return categories.reduce(
      (acc, category) => {
        acc.income += category.overallIncome || 0;
        acc.expense += category.overallExpense || 0;
        acc.net += category.netAmount || 0;
        return acc;
      },
      { income: 0, expense: 0, net: 0 },
    );
  }, [categories]);

  const lastUpdated = useMemo(() => {
    const timestamps = categories
      .map((item) => item.updatedAt || item.createdAt)
      .filter(Boolean)
      .map((date) => new Date(date as string).getTime());
    if (!timestamps.length) {
      return null;
    }
    return new Date(Math.max(...timestamps)).toLocaleString();
  }, [categories]);

  const isCategorySaveDisabled = !newCategoryName.trim() || categorySubmitting;
  const isSubcategorySaveDisabled =
    subcategorySubmitting ||
    !subcategoryTitle.trim() ||
    (subcategoryType === 'specific_amount' && !subcategoryAmount.trim());

  const handleDonateNow = () => {
    Toast.show({
      type: 'info',
      text1: 'Donate now',
      text2: 'Razorpay integration is being wired. Stay tuned!',
    });
  };

  const handleNavigateToSubcategory = (category: DonationCategorySummary, subcategory: DonationSubcategory) => {
    navigation.navigate('SubcategoryDetail', {
      categoryId: category.id,
      categoryName: category.name,
      subcategoryId: subcategory.id,
      subcategoryTitle: subcategory.title,
      subcategoryDescription: subcategory.description,
      subcategoryType: subcategory.type,
      subcategoryAmount: subcategory.amount,
      managers: category.managers,
      subcategoryIncome: subcategory.totalIncome || 0,
      subcategoryExpense: subcategory.totalExpense || 0,
      subcategoryNet: subcategory.netAmount || 0,
    });
  };

  const resetSubcategoryForm = () => {
    setSubcategoryTitle('');
    setSubcategoryDescription('');
    setSubcategoryType('open_donation');
    setSubcategoryAmount('');
  };

  const handleOpenSubcategoryModal = (category: DonationCategorySummary) => {
    setSubcategoryModal({
      visible: true,
      categoryId: category.id,
      categoryName: category.name,
    });
  };

  const closeSubcategoryModal = () => {
    setSubcategoryModal((prev) => ({ ...prev, visible: false }));
    resetSubcategoryForm();
  };

  const closeCategoryModal = () => {
    setCategoryModalVisible(false);
    setNewCategoryName('');
  };

  const handleCategorySubmit = async () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      return;
    }

    try {
      setCategorySubmitting(true);
      const response = await DonationService.createCategory({ name: trimmedName });
      if (!response.success) {
        throw new Error(response.message || 'Unable to create category');
      }
      Toast.show({ type: 'success', text1: 'Category created', text2: `${trimmedName} is now available.` });
      setCategoryModalVisible(false);
      setNewCategoryName('');
      await loadSummary();
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Add category failed',
        text2: err instanceof Error ? err.message : 'Unable to create category',
      });
    } finally {
      setCategorySubmitting(false);
    }
  };

  const handleSubcategorySubmit = async () => {
    if (!subcategoryModal.categoryId) {
      return;
    }

    const trimmedTitle = subcategoryTitle.trim();
    if (!trimmedTitle) {
      Toast.show({ type: 'error', text1: 'Missing title', text2: 'Give the subcategory a title.' });
      return;
    }

    let parsedAmount: number | undefined;
    if (subcategoryType === 'specific_amount') {
      parsedAmount = Number(subcategoryAmount);
      if (!parsedAmount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        Toast.show({ type: 'error', text1: 'Invalid amount', text2: 'Provide a valid amount for this subcategory.' });
        return;
      }
    }

    try {
      setSubcategorySubmitting(true);
      const response = await DonationService.createSubcategory({
        category_id: subcategoryModal.categoryId,
        title: trimmedTitle,
        description: subcategoryDescription.trim() || undefined,
        type: subcategoryType,
        amount: parsedAmount,
      });
      if (!response.success) {
        throw new Error(response.message || 'Unable to create subcategory');
      }
      Toast.show({
        type: 'success',
        text1: 'Subcategory added',
        text2: `${trimmedTitle} has been added under ${subcategoryModal.categoryName}.`,
      });
      closeSubcategoryModal();
      await loadSummary();
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Add subcategory failed',
        text2: err instanceof Error ? err.message : 'Unable to create subcategory',
      });
    } finally {
      setSubcategorySubmitting(false);
    }
  };

  const renderCategory = ({ item }: { item: DonationCategorySummary }) => {
    const hasSurplus = (item.netAmount || 0) >= 0;
    const isPinned = pinnedCategoryIds.has(item.id);
    const isCategoryActive = item.status !== 'inactive';
    const categoryStatus = item.status || 'active';
    
    return (
      <View style={[styles.categoryCard, isPinned && styles.categoryCardPinned]}>
        <View style={styles.categoryHeader}>
          <View style={styles.categoryIcon}>
            <Icon name="pie-chart" size={18} color="#fff" />
          </View>
          <View style={styles.categoryTitleWrapper}>
            <View style={styles.categoryNameRow}>
              <Text style={styles.categoryName}>{item.name}</Text>
              {isPinned && <Icon name="thumb-tack" size={14} color={colors.primary} style={styles.pinIcon} />}
            </View>
            <Text style={styles.categoryMeta}>
              {item.subcategories?.length || 0} sub categor{item.subcategories?.length === 1 ? 'y' : 'ies'}
            </Text>
          </View>
          <View style={styles.categoryHeaderRight}>
            {isAdminUser && (
              <View style={styles.statusToggleContainer}>
                <Text style={styles.statusLabel}>{categoryStatus === 'active' ? 'Active' : 'Inactive'}</Text>
                <Switch
                  value={categoryStatus === 'active'}
                  onValueChange={() => handleToggleCategoryStatus(item.id, categoryStatus)}
                  trackColor={{ false: colors.border, true: colors.primary + '80' }}
                  thumbColor={categoryStatus === 'active' ? colors.primary : colors.textMuted}
                />
              </View>
            )}
            <TouchableOpacity
              onPress={() => handleTogglePin(item.id)}
              style={styles.pinButton}
              activeOpacity={0.7}>
              <Icon
                name={isPinned ? 'thumb-tack' : 'thumb-tack'}
                size={16}
                color={isPinned ? colors.primary : colors.textMuted}
                style={[isPinned && styles.pinButtonActive]}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.amountRow}>
          <View style={[styles.amountPill, styles.incomePill]}>
            <Icon name="arrow-up" size={16} color="#12b886" />
            <View>
              <Text style={styles.pillLabel}>Income</Text>
              <Text style={styles.pillValue}>{formatCurrency(item.overallIncome)}</Text>
            </View>
          </View>
          <View style={[styles.amountPill, styles.expensePill]}>
            <Icon name="arrow-down" size={16} color="#f04438" />
            <View>
              <Text style={styles.pillLabel}>Expense</Text>
              <Text style={styles.pillValue}>{formatCurrency(item.overallExpense)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.netRow}>
          <Text style={styles.netLabel}>Net Amount</Text>
          <Text style={[styles.netValue, hasSurplus ? styles.netPositive : styles.netNegative]}>
            {formatCurrency(item.netAmount)}
          </Text>
        </View>

        {item.subcategories && item.subcategories.length > 0 ? (
          <View style={styles.subcategorySection}>
            <Text style={styles.subcategoryTitle}>Subcategories</Text>
            <View style={styles.subcategoryCardGrid}>
              {item.subcategories.map((sub) => {
                const isSubcategoryActive = sub.status !== 'inactive';
                const subcategoryStatus = sub.status || 'active';
                const isDisabled = !isCategoryActive || !isSubcategoryActive;
                
                return (
                  <View key={sub.id} style={styles.subcategoryCard}>
                    <View style={styles.subcategoryCardHeader}>
                      <Text style={styles.subcategoryCardTitle}>{sub.title}</Text>
                      {isAdminUser && (
                        <View style={styles.subcategoryStatusToggle}>
                          <Switch
                            value={subcategoryStatus === 'active'}
                            onValueChange={() => handleToggleSubcategoryStatus(sub.id, item.id, subcategoryStatus)}
                            trackColor={{ false: colors.border, true: colors.primary + '80' }}
                            thumbColor={subcategoryStatus === 'active' ? colors.primary : colors.textMuted}
                            disabled={!isCategoryActive}
                          />
                        </View>
                      )}
                    </View>
                    {sub.description ? (
                      <Text style={styles.subcategoryCardDescription}>{sub.description}</Text>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.subcategoryButton, isDisabled && styles.subcategoryButtonDisabled]}
                      onPress={() => {
                        if (isDisabled) {
                          if (!isCategoryActive) {
                            Alert.alert('Category Inactive', 'This category is inactive. Please contact admin.');
                          } else if (!isSubcategoryActive) {
                            Alert.alert('Subcategory Inactive', 'Contact admin, this is inactive.');
                          }
                        } else {
                          handleNavigateToSubcategory(item, sub);
                        }
                      }}
                      activeOpacity={isDisabled ? 1 : 0.85}
                      disabled={isDisabled}>
                      <Icon name="heart" size={14} color={isDisabled ? colors.textMuted : '#fff'} />
                      <Text style={[styles.subcategoryButtonText, isDisabled && styles.subcategoryButtonTextDisabled]}>
                        Donate now
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.emptySubcategories}>
            <Icon name="info-circle" size={14} color={colors.textMuted} />
            <Text style={styles.emptySubcategoriesText}>No subcategories recorded yet</Text>
          </View>
        )}

        {isAdminUser ? (
          <TouchableOpacity
            style={styles.addSubcategoryTrigger}
            onPress={() => handleOpenSubcategoryModal(item)}
            activeOpacity={0.85}>
            <Icon name="plus-circle" size={16} color={colors.primary} />
            <Text style={styles.addSubcategoryTriggerText}>Add subcategory</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const renderListHeader = () => (
    <View style={styles.headerSection}>
      <Text style={styles.screenTitle}>Finance Tracker</Text>
      <Text style={styles.screenSubtitle}>Monitor income, expense and net position</Text>
      {lastUpdated && <Text style={styles.updatedText}>Updated {lastUpdated}</Text>}

      <View style={styles.summaryGrid}>
        <View style={[styles.summaryCard, styles.summaryIncome]}>
          <Text style={styles.summaryLabel}>Total Income</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totals.income)}</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryExpense]}>
          <Text style={styles.summaryLabel}>Total Expense</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totals.expense)}</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryNet]}>
          <Text style={styles.summaryLabel}>Net Balance</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totals.net)}</Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Icon name="exclamation-triangle" size={16} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Fetching donation summary...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={sortedCategories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          !categories.length && !loading ? styles.listContentEmpty : null,
        ]}
        renderItem={renderCategory}
        ListHeaderComponent={renderListHeader}
        ListHeaderComponentStyle={styles.listHeaderSpacing}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Icon name="folder-open" size={32} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No donation categories yet</Text>
              <Text style={styles.emptySubtitle}>Pull to refresh or add new donation buckets.</Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      />

      {isAdminUser ? (
        <TouchableOpacity style={styles.fab} onPress={() => setCategoryModalVisible(true)} activeOpacity={0.9}>
          <Icon name="plus" size={18} color="#fff" />
          <Text style={styles.fabText}>Category</Text>
        </TouchableOpacity>
      ) : null}

      <Modal visible={categoryModalVisible} animationType="slide" transparent onRequestClose={closeCategoryModal}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboardWrapper}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add category</Text>
              <Text style={styles.modalSubtitle}>Create a new donation bucket for your upcoming needs.</Text>
              <Text style={styles.modalLabel}>Category name</Text>
              <TextInput
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                style={styles.modalInput}
                placeholder="Education fund"
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={closeCategoryModal}
                  disabled={categorySubmitting}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.modalButtonPrimary,
                    isCategorySaveDisabled && styles.modalButtonDisabled,
                  ]}
                  onPress={handleCategorySubmit}
                  disabled={isCategorySaveDisabled}>
                  <Text style={styles.modalButtonPrimaryText}>
                    {categorySubmitting ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={subcategoryModal.visible}
        animationType="slide"
        transparent
        onRequestClose={closeSubcategoryModal}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboardWrapper}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add subcategory</Text>
              <Text style={styles.modalSubtitle}>
                Attach a subcategory to {subcategoryModal.categoryName || 'this category'}.
              </Text>
              <Text style={styles.modalLabel}>Title</Text>
              <TextInput
                value={subcategoryTitle}
                onChangeText={setSubcategoryTitle}
                style={styles.modalInput}
                placeholder="Annual Scholarship"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.modalLabel}>Description (optional)</Text>
              <TextInput
                value={subcategoryDescription}
                onChangeText={setSubcategoryDescription}
                style={[styles.modalInput, styles.modalInputMultiline]}
                placeholder="Who does this support?"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
              />
              <Text style={styles.modalLabel}>Donation type</Text>
              <View style={styles.typeSelector}>
                {(['open_donation', 'specific_amount'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeOption, subcategoryType === type && styles.typeOptionActive]}
                    onPress={() => setSubcategoryType(type)}
                    activeOpacity={0.9}>
                    <Text
                      style={[styles.typeOptionText, subcategoryType === type && styles.typeOptionTextActive]}>
                      {type === 'open_donation' ? 'Open donation' : 'Specific amount'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {subcategoryType === 'specific_amount' ? (
                <>
                  <Text style={styles.modalLabel}>Fixed amount</Text>
                  <TextInput
                    value={subcategoryAmount}
                    onChangeText={setSubcategoryAmount}
                    style={styles.modalInput}
                    placeholder="1000"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                  />
                </>
              ) : null}
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalButton} onPress={closeSubcategoryModal} disabled={subcategorySubmitting}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.modalButtonPrimary,
                    isSubcategorySaveDisabled && styles.modalButtonDisabled,
                  ]}
                  onPress={handleSubcategorySubmit}
                  disabled={isSubcategorySaveDisabled}>
                  <Text style={styles.modalButtonPrimaryText}>
                    {subcategorySubmitting ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
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
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  loaderText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  screenTitle: {
    fontFamily: fonts.heading,
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
  },
  screenSubtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textMuted,
    marginTop: 4,
  },
  updatedText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  summaryCard: {
    flexGrow: 1,
    minWidth: '30%',
    padding: 16,
    borderRadius: 12,
  },
  summaryIncome: {
    backgroundColor: '#ecfdf3',
  },
  summaryExpense: {
    backgroundColor: '#fef3f2',
  },
  summaryNet: {
    backgroundColor: '#eef2ff',
  },
  summaryLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 8,
  },
  summaryValue: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.text,
  },
  errorBanner: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.danger + '10',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.danger,
    flex: 1,
  },
  listContent: {
    paddingBottom: 40,
  },
  listHeaderSpacing: {
    marginBottom: 12,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryCard: {
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryTitleWrapper: {
    flex: 1,
  },
  categoryNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryName: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.text,
  },
  pinIcon: {
    marginLeft: 4,
  },
  categoryHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 4,
  },
  statusLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  pinButton: {
    padding: 4,
  },
  pinButtonActive: {
    transform: [{ rotate: '45deg' }],
  },
  categoryCardPinned: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  categoryMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  amountPill: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  incomePill: {
    backgroundColor: '#ecfdf3',
  },
  expensePill: {
    backgroundColor: '#fef3f2',
  },
  pillLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  pillValue: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.text,
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  netLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
  netValue: {
    fontFamily: fonts.heading,
    fontSize: 18,
  },
  netPositive: {
    color: '#12b886',
  },
  netNegative: {
    color: '#f04438',
  },
  subcategorySection: {
    marginTop: 20,
    gap: 12,
  },
  subcategoryTitle: {
    fontFamily: fonts.heading,
    fontSize: 15,
    color: colors.text,
  },
  subcategoryCardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  subcategoryCard: {
    flexBasis: '48%',
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.cardMuted,
    gap: 8,
  },
  subcategoryCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  subcategoryCardTitle: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  subcategoryStatusToggle: {
    marginLeft: 8,
  },
  subcategoryCardAmount: {
    fontFamily: fonts.heading,
    fontSize: 14,
  },
  subcategoryCardDescription: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  subcategoryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  statValue: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.text,
    marginTop: 2,
  },
  subcategoryButton: {
    marginTop: 4,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  subcategoryButtonDisabled: {
    backgroundColor: colors.border,
    opacity: 0.6,
  },
  subcategoryButtonText: {
    fontFamily: fonts.heading,
    fontSize: 13,
    color: '#fff',
  },
  subcategoryButtonTextDisabled: {
    color: colors.textMuted,
  },
  emptySubcategories: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.cardMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptySubcategoriesText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.text,
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  fabText: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  modalKeyboardWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.text,
  },
  modalSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },
  modalLabel: {
    marginTop: 6,
    fontFamily: fonts.heading,
    fontSize: 13,
    color: colors.text,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border ?? '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  modalInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border ?? '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  typeOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  typeOptionText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },
  typeOptionTextActive: {
    color: colors.primary,
    fontFamily: fonts.heading,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border ?? '#E5E7EB',
  },
  modalButtonPrimary: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonText: {
    fontFamily: fonts.heading,
    fontSize: 13,
    color: colors.text,
  },
  modalButtonPrimaryText: {
    fontFamily: fonts.heading,
    fontSize: 13,
    color: '#fff',
  },
  addSubcategoryTrigger: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addSubcategoryTriggerText: {
    fontFamily: fonts.heading,
    fontSize: 13,
    color: colors.primary,
  },
});


