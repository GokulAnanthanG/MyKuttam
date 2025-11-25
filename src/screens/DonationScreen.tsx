import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
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
import { DonationStackParamList } from '../navigation/DonationNavigator';
import {
  DonationService,
  type DonationCategorySummary,
  type DonationSubcategory,
} from '../services/donations';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

const formatCurrency = (value?: number) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '₹0.00';
  }
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const DonationScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<DonationStackParamList>>();
  const [categories, setCategories] = useState<DonationCategorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }, [loadSummary]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadSummary({ isRefresh: true });
  }, [loadSummary]);

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
      managers: category.managers,
    subcategoryIncome: subcategory.totalIncome || 0,
    subcategoryExpense: subcategory.totalExpense || 0,
    subcategoryNet: subcategory.netAmount || 0,
    });
  };

  const renderCategory = ({ item }: { item: DonationCategorySummary }) => {
    const hasSurplus = (item.netAmount || 0) >= 0;
    return (
      <View style={styles.categoryCard}>
        <View style={styles.categoryHeader}>
          <View style={styles.categoryIcon}>
            <Icon name="pie-chart" size={18} color="#fff" />
          </View>
          <View style={styles.categoryTitleWrapper}>
            <Text style={styles.categoryName}>{item.name}</Text>
            <Text style={styles.categoryMeta}>
              {item.subcategories?.length || 0} sub categor{item.subcategories?.length === 1 ? 'y' : 'ies'}
            </Text>
          </View>
          <View style={[styles.netBadge, hasSurplus ? styles.netBadgePositive : styles.netBadgeNegative]}>
            <Icon name={hasSurplus ? 'arrow-up' : 'arrow-down'} size={12} color="#fff" />
            <Text style={styles.netBadgeText}>{hasSurplus ? 'Surplus' : 'Deficit'}</Text>
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
              {item.subcategories.map((sub) => (
                <View key={sub.id} style={styles.subcategoryCard}>
                  <Text style={styles.subcategoryCardTitle}>{sub.title}</Text>
                  {sub.description ? (
                    <Text style={styles.subcategoryCardDescription}>{sub.description}</Text>
                  ) : null}
                  <TouchableOpacity
                    style={styles.subcategoryButton}
                    onPress={() => handleNavigateToSubcategory(item, sub)}
                    activeOpacity={0.85}>
                    <Icon name="heart" size={14} color="#fff" />
                    <Text style={styles.subcategoryButtonText}>Donate now</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.emptySubcategories}>
            <Icon name="info-circle" size={14} color={colors.textMuted} />
            <Text style={styles.emptySubcategoriesText}>No subcategories recorded yet</Text>
          </View>
        )}
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
        data={categories}
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
  categoryName: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.text,
  },
  categoryMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  netBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  netBadgePositive: {
    backgroundColor: '#ecfdf3',
  },
  netBadgeNegative: {
    backgroundColor: '#fef3f2',
  },
  netBadgeText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text,
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
  },
  subcategoryCardTitle: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.text,
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
  subcategoryButtonText: {
    fontFamily: fonts.heading,
    fontSize: 13,
    color: '#fff',
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
});


