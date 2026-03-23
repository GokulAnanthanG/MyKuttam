import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { pick, types, errorCodes, isErrorWithCode } from '@react-native-documents/picker';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { LuckyDrawEvent, LuckyDrawService } from '../services/luckyDraw';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MoreStackParamList } from '../navigation/MoreNavigator';

export const LuckyDrawConfigScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const [events, setEvents] = useState<LuckyDrawEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<LuckyDrawEvent | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<boolean>(true);
  const [selectedThumb, setSelectedThumb] = useState<{
    uri: string;
    type: string;
    name: string;
  } | null>(null);

  const fetchEvents = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await LuckyDrawService.getEvents();
      if (response.success) {
        setEvents(response.data || []);
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error instanceof Error ? error.message : 'Failed to fetch lucky draw events',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStatus(true);
    setSelectedThumb(null);
    setEditingEvent(null);
  };

  const handlePickThumbnail = async () => {
    try {
      const result = await pick({
        type: [types.images],
      });

      if (result && result.length > 0) {
        const file = result[0];
        if (!file.uri) return;
        setSelectedThumb({
          uri: file.uri,
          type: file.type || 'image/jpeg',
          name: file.name || 'thumbnail.jpg',
        });
      }
    } catch (error) {
      if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error instanceof Error ? error.message : 'Failed to select image',
      });
    }
  };

  const handleCreateOrUpdate = async () => {
    if (!title.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Title required',
        text2: 'Please enter event title',
      });
      return;
    }

    try {
      setSubmitting(true);

      if (editingEvent) {
        const eventId = editingEvent.id || editingEvent._id;
        if (!eventId) {
          throw new Error('Invalid event id');
        }
        await LuckyDrawService.updateEvent(eventId, {
          title: title.trim(),
          description: description.trim(),
          status,
        });
      } else {
        await LuckyDrawService.createEvent(title.trim(), description.trim(), selectedThumb);
      }

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: editingEvent ? 'Event updated successfully' : 'Event created successfully',
      });

      setShowCreateModal(false);
      resetForm();
      fetchEvents();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error instanceof Error ? error.message : 'Operation failed',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (event: LuckyDrawEvent) => {
    const eventId = event.id || event._id;
    if (!eventId) {
      return;
    }

    Alert.alert('Delete Event', `Delete "${event.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await LuckyDrawService.deleteEvent(eventId);
            Toast.show({
              type: 'success',
              text1: 'Deleted',
              text2: 'Lucky draw event deleted',
            });
            fetchEvents();
          } catch (error) {
            Toast.show({
              type: 'error',
              text1: 'Error',
              text2: error instanceof Error ? error.message : 'Failed to delete event',
            });
          }
        },
      },
    ]);
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (event: LuckyDrawEvent) => {
    setEditingEvent(event);
    setTitle(event.title || '');
    setDescription(event.description || '');
    setStatus(event.status ?? true);
    setSelectedThumb(null);
    setShowCreateModal(true);
  };

  const renderItem = ({ item }: { item: LuckyDrawEvent }) => {
    const winnerCount = item.winners?.length || 0;
    const eventId = item.id || item._id;
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        {!!item.description && <Text style={styles.cardDescription}>{item.description}</Text>}
        <Text style={styles.cardMeta}>
          Status: {item.status === false ? 'Inactive' : 'Active'}
        </Text>
        <Text style={styles.cardMeta}>Winners: {winnerCount}</Text>
        {winnerCount > 0 && (
          <View style={styles.winnersSection}>
            <Text style={styles.winnersTitle}>Winner Details</Text>
            {item.winners?.map((winner, index) => {
              const winnerName = winner.user?.name || winner.user_id?.name || 'N/A';
              const winnerPhone = winner.user?.phone || winner.user_id?.phone || 'N/A';
              const giftName = winner.gift?.product_name || winner.gift_id?.product_name || 'N/A';
              const luckyNumber =
                winner.lucky_number !== undefined && winner.lucky_number !== null
                  ? String(winner.lucky_number)
                  : 'N/A';

              return (
                <View key={`${eventId || item.title}-winner-${index}`} style={styles.winnerCard}>
                  <Text style={styles.winnerText}>Name: {winnerName}</Text>
                  <Text style={styles.winnerText}>Phone: {winnerPhone}</Text>
                  <Text style={styles.winnerText}>Gift: {giftName}</Text>
                  <Text style={styles.winnerText}>Lucky Number: {luckyNumber}</Text>
                </View>
              );
            })}
          </View>
        )}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              if (!eventId) {
                Toast.show({
                  type: 'error',
                  text1: 'Invalid event',
                  text2: 'Unable to open gift configuration for this event',
                });
                return;
              }
              navigation.navigate('GiftConfig', {
                eventId,
                eventTitle: item.title,
                gifts: item.gifts || [],
              });
            }}>
            <Icon name="gift" size={16} color={colors.accent} />
            <Text style={[styles.actionText, { color: colors.accent }]}>Gifts</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => openEditModal(item)}>
            <Icon name="edit" size={16} color={colors.primary} />
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleDelete(item)}>
            <Icon name="trash" size={16} color={colors.danger} />
            <Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('More');
            }
          }}
          activeOpacity={0.8}>
          <Icon name="arrow-left" size={16} color={colors.text} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Lucky Draw Configurations</Text>
        <TouchableOpacity style={styles.addButton} onPress={openCreateModal} activeOpacity={0.8}>
          <Icon name="plus" size={16} color="#fff" />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item, index) => item.id || item._id || `${item.title}-${index}`}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchEvents(true)}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="gift" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No lucky draw events found</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingEvent ? 'Edit Event' : 'Create Event'}</Text>

            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter title"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter description"
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <Text style={styles.label}>Status</Text>
            <View style={styles.statusRow}>
              <TouchableOpacity
                style={[styles.statusChip, status && styles.statusChipActive]}
                onPress={() => setStatus(true)}
                activeOpacity={0.8}>
                <Text style={[styles.statusChipText, status && styles.statusChipTextActive]}>
                  Active
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statusChip, !status && styles.statusChipActive]}
                onPress={() => setStatus(false)}
                activeOpacity={0.8}>
                <Text style={[styles.statusChipText, !status && styles.statusChipTextActive]}>
                  Inactive
                </Text>
              </TouchableOpacity>
            </View>

            {!editingEvent && (
              <TouchableOpacity style={styles.thumbBtn} onPress={handlePickThumbnail}>
                <Icon name="image" size={16} color={colors.primary} />
                <Text style={styles.thumbBtnText}>
                  {selectedThumb ? 'Thumbnail selected' : 'Select thumbnail (optional)'}
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.saveBtn, submitting && styles.disabled]}
                disabled={submitting}
                onPress={handleCreateOrUpdate}>
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveText}>{editingEvent ? 'Update' : 'Create'}</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.cardMuted,
  },
  backButtonText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: colors.text,
    flex: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontFamily: fonts.body,
    fontWeight: '600',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.text,
    marginBottom: 6,
  },
  cardDescription: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 8,
  },
  cardMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  winnersSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  winnersTitle: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  winnerCard: {
    backgroundColor: colors.cardMuted,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  winnerText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    gap: 8,
  },
  modalTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: colors.text,
    marginBottom: 8,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.cardMuted,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    marginBottom: 8,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  thumbBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.cardMuted,
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  thumbBtnText: {
    fontFamily: fonts.body,
    color: colors.primary,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  statusChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardMuted,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statusChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  statusChipText: {
    fontFamily: fonts.body,
    color: colors.text,
    fontWeight: '600',
  },
  statusChipTextActive: {
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  modalBtn: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  cancelBtn: {
    backgroundColor: colors.cardMuted,
  },
  saveBtn: {
    backgroundColor: colors.primary,
  },
  cancelText: {
    fontFamily: fonts.body,
    color: colors.text,
    fontWeight: '600',
  },
  saveText: {
    fontFamily: fonts.body,
    color: '#fff',
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
});
