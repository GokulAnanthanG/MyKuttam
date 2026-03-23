import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
import Toast from 'react-native-toast-message';
import { pick, types, errorCodes, isErrorWithCode } from '@react-native-documents/picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { EventItem, EventService } from '../services/events';
import type { MoreStackParamList } from '../navigation/MoreNavigator';

export const EventsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const { currentUser } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'upcoming'>('upcoming');

  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formEventDate, setFormEventDate] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [formDescription, setFormDescription] = useState('');
  const [formImage, setFormImage] = useState<{ uri: string; type: string; name: string } | null>(null);

  const canManageEvents = useMemo(
    () =>
      !!currentUser?.role &&
      currentUser.role.some((r) => ['ADMIN', 'SUB_ADMIN', 'HELPER'].includes(r)),
    [currentUser?.role],
  );

  const normalizeEvents = (raw: unknown): EventItem[] => {
    if (Array.isArray(raw)) return raw as EventItem[];
    if (
      raw &&
      typeof raw === 'object' &&
      'events' in (raw as Record<string, unknown>) &&
      Array.isArray((raw as Record<string, unknown>).events)
    ) {
      return (raw as { events: EventItem[] }).events;
    }
    return [];
  };

  const fetchEvents = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        const response = await EventService.getEvents({ page: 1, limit: 50, filter: selectedFilter });
        if (response.success) {
          setEvents(normalizeEvents(response.data));
        }
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: error instanceof Error ? error.message : 'Failed to fetch events',
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedFilter],
  );

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const resetForm = () => {
    setEditingEvent(null);
    setFormTitle('');
    setFormEventDate('');
    setSelectedDate(new Date());
    setShowDatePicker(false);
    setFormDescription('');
    setFormImage(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowEditorModal(true);
  };

  const openEditModal = (event: EventItem) => {
    const parsedDate = event.event_date ? new Date(event.event_date) : new Date();
    setEditingEvent(event);
    setFormTitle(event.title || '');
    setFormEventDate((event.event_date || '').slice(0, 10));
    setSelectedDate(Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate);
    setFormDescription(event.description || '');
    setFormImage(null);
    setShowEditorModal(true);
  };

  const formatDateForInput = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const pickImage = async () => {
    try {
      const result = await pick({
        type: [types.images],
      });
      if (result && result.length > 0) {
        const file = result[0];
        if (!file.uri) return;
        setFormImage({
          uri: file.uri,
          type: file.type || 'image/jpeg',
          name: file.name || 'event.jpg',
        });
      }
    } catch (error) {
      if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) return;
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error instanceof Error ? error.message : 'Failed to pick image',
      });
    }
  };

  const validateForm = () => {
    if (!formTitle.trim()) return 'Title is required';
    if (!formEventDate.trim()) return 'Event date is required';
    if (Number.isNaN(new Date(formEventDate).getTime())) return 'Event date is invalid';
    return null;
  };

  const handleCreateOrUpdate = async () => {
    const formError = validateForm();
    if (formError) {
      Toast.show({ type: 'error', text1: 'Validation', text2: formError });
      return;
    }

    try {
      setSubmitting(true);
      if (editingEvent) {
        const id = editingEvent.id || editingEvent._id;
        if (!id) throw new Error('Invalid event id');
        await EventService.updateEvent(id, {
          title: formTitle.trim(),
          event_date: formEventDate.trim(),
          description: formDescription.trim(),
          image: formImage,
        });
      } else {
        await EventService.createEvent({
          title: formTitle.trim(),
          event_date: formEventDate.trim(),
          description: formDescription.trim(),
          image: formImage,
        });
      }

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: editingEvent ? 'Event updated successfully' : 'Event created successfully',
      });
      setShowEditorModal(false);
      resetForm();
      fetchEvents();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error instanceof Error ? error.message : 'Event operation failed',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (event: EventItem) => {
    const id = event.id || event._id;
    if (!id) return;

    Alert.alert('Delete Event', `Delete "${event.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await EventService.deleteEvent(id);
            Toast.show({
              type: 'success',
              text1: 'Deleted',
              text2: 'Event deleted successfully',
            });
            setEvents((prev) => prev.filter((e) => (e.id || e._id) !== id));
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

  const handleOpenDetail = async (event: EventItem) => {
    const id = event.id || event._id;
    if (!id) return;
    try {
      setLoadingDetailId(id);
      const response = await EventService.getEventById(id);
      const detail = response.data;
      if (!detail) {
        throw new Error('Event details not found');
      }
      Alert.alert(
        detail.title,
        `Date: ${(detail.event_date || '').slice(0, 10)}\n\n${detail.description || 'No description'}`,
      );
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error instanceof Error ? error.message : 'Failed to load event details',
      });
    } finally {
      setLoadingDetailId(null);
    }
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
          }}>
          <Icon name="arrow-left" size={15} color={colors.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Events</Text>
        {canManageEvents && (
          <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
            <Icon name="plus" size={14} color="#fff" />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, selectedFilter === 'upcoming' && styles.filterChipActive]}
          onPress={() => setSelectedFilter('upcoming')}>
          <Text style={[styles.filterChipText, selectedFilter === 'upcoming' && styles.filterChipTextActive]}>
            Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, selectedFilter === 'all' && styles.filterChipActive]}
          onPress={() => setSelectedFilter('all')}>
          <Text style={[styles.filterChipText, selectedFilter === 'all' && styles.filterChipTextActive]}>
            All
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item, index) => item.id || item._id || `${item.title}-${index}`}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchEvents(true)} />}
          renderItem={({ item }) => {
            const id = item.id || item._id || '';
            const eventImage = item.image_url || item.image;
            return (
              <TouchableOpacity style={styles.card} onPress={() => handleOpenDetail(item)} activeOpacity={0.85}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDate}>Date: {(item.event_date || '').slice(0, 10)}</Text>
                {!!item.description && (
                  <Text numberOfLines={3} style={styles.cardDescription}>
                    {item.description}
                  </Text>
                )}
                {!!eventImage && (
                  <Image source={{ uri: eventImage }} style={styles.cardImage} resizeMode="cover" />
                )}

                <View style={styles.cardFooter}>
                  {loadingDetailId === id ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={styles.viewDetailsText}>Tap to view details</Text>
                  )}
                  {canManageEvents && (
                    <View style={styles.actionsWrap}>
                      <TouchableOpacity style={styles.iconAction} onPress={() => openEditModal(item)}>
                        <Icon name="edit" size={16} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.iconAction} onPress={() => handleDelete(item)}>
                        <Icon name="trash" size={16} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Icon name="calendar" size={42} color={colors.textMuted} />
              <Text style={styles.emptyText}>No events found</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={showEditorModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowEditorModal(false);
          resetForm();
        }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingEvent ? 'Edit Event' : 'Create Event'}</Text>
            <Text style={styles.inputLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              value={formTitle}
              onChangeText={setFormTitle}
              placeholder="Enter event title"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.inputLabel}>Event Date * (YYYY-MM-DD)</Text>
            <TouchableOpacity
              style={styles.input}
              activeOpacity={0.8}
              onPress={() => setShowDatePicker(true)}>
              <Text style={formEventDate ? styles.dateText : styles.datePlaceholder}>
                {formEventDate || 'Select event date'}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (event.type === 'dismissed' || !date) {
                    return;
                  }
                  setSelectedDate(date);
                  setFormEventDate(formatDateForInput(date));
                }}
              />
            )}
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formDescription}
              onChangeText={setFormDescription}
              placeholder="Enter description"
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
              <Icon name="image" size={14} color={colors.primary} />
              <Text style={styles.imageBtnText}>{formImage ? 'Image selected' : 'Select image (optional)'}</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => {
                  setShowEditorModal(false);
                  resetForm();
                }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.submitBtn, submitting && styles.disabled]}
                disabled={submitting}
                onPress={handleCreateOrUpdate}>
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitText}>{editingEvent ? 'Update' : 'Create'}</Text>
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
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.cardMuted,
  },
  backText: {
    color: colors.text,
    fontFamily: fonts.body,
    fontWeight: '600',
    fontSize: 14,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 28,
    color: colors.text,
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
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.cardMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.text,
    fontFamily: fonts.body,
    fontWeight: '600',
    fontSize: 12,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: 24 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 18,
    marginBottom: 4,
  },
  cardDate: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginBottom: 8,
  },
  cardDescription: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    marginBottom: 8,
  },
  cardImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: colors.cardMuted,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewDetailsText: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontWeight: '600',
    fontSize: 12,
  },
  actionsWrap: {
    flexDirection: 'row',
    gap: 12,
  },
  iconAction: {
    padding: 4,
  },
  emptyWrap: {
    paddingVertical: 70,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
  },
  modalTitle: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 20,
    marginBottom: 10,
  },
  inputLabel: {
    color: colors.text,
    fontFamily: fonts.body,
    fontWeight: '600',
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    color: colors.text,
    fontFamily: fonts.body,
  },
  dateText: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  datePlaceholder: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  imageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: colors.cardMuted,
    borderRadius: 8,
    marginBottom: 12,
  },
  imageBtnText: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: { backgroundColor: colors.cardMuted },
  submitBtn: { backgroundColor: colors.primary },
  cancelText: { color: colors.text, fontFamily: fonts.body, fontWeight: '600' },
  submitText: { color: '#fff', fontFamily: fonts.body, fontWeight: '600' },
  disabled: { opacity: 0.65 },
});
