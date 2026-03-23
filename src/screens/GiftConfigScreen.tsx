import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome';
import Toast from 'react-native-toast-message';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { pick, types, errorCodes, isErrorWithCode } from '@react-native-documents/picker';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import type { MoreStackParamList } from '../navigation/MoreNavigator';
import { Gift, GiftService } from '../services/gift';

export const GiftConfigScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const route = useRoute<any>();
  const { eventId, eventTitle, gifts: initialGifts = [] } = route.params || {};

  const [gifts, setGifts] = useState<Gift[]>(Array.isArray(initialGifts) ? initialGifts : []);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingGiftId, setDeletingGiftId] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [availableQuantity, setAvailableQuantity] = useState('1');
  const [description, setDescription] = useState('');
  const [selectedImage, setSelectedImage] = useState<{ uri: string; type: string; name: string } | null>(null);

  const canSubmit = useMemo(
    () => !!eventId && !!productName.trim() && !!selectedImage,
    [eventId, productName, selectedImage],
  );

  const resetForm = () => {
    setProductName('');
    setAvailableQuantity('1');
    setDescription('');
    setSelectedImage(null);
  };

  const handlePickImage = async () => {
    try {
      const result = await pick({
        type: [types.images],
      });
      if (result && result.length > 0) {
        const file = result[0];
        if (!file.uri) return;
        setSelectedImage({
          uri: file.uri,
          type: file.type || 'image/jpeg',
          name: file.name || 'gift.jpg',
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

  const handleAddGift = async () => {
    if (!eventId) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Lucky draw event id is missing',
      });
      return;
    }
    if (!canSubmit || !selectedImage) return;

    const parsedQty = Number(availableQuantity);
    if (Number.isNaN(parsedQty) || parsedQty < 0) {
      Toast.show({
        type: 'error',
        text1: 'Invalid quantity',
        text2: 'Available quantity must be a non-negative number',
      });
      return;
    }

    try {
      setSubmitting(true);
      const response = await GiftService.addGift({
        lucky_draw_event_id: eventId,
        product_name: productName.trim(),
        image: selectedImage,
        available_quantity: parsedQty,
        description: description.trim(),
      });

      if (response.success && response.data) {
        setGifts((prev) => [response.data as Gift, ...prev]);
      }

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: response.message || 'Gift created successfully',
      });

      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error instanceof Error ? error.message : 'Failed to add gift',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGift = (gift: Gift) => {
    const giftId = gift._id || gift.id;
    if (!giftId) return;

    Alert.alert('Delete Gift', `Delete "${gift.product_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeletingGiftId(giftId);
            const response = await GiftService.deleteGift(giftId);
            setGifts((prev) => prev.filter((g) => (g._id || g.id) !== giftId));
            Toast.show({
              type: 'success',
              text1: 'Deleted',
              text2: response.message || 'Gift deleted successfully',
            });
          } catch (error) {
            Toast.show({
              type: 'error',
              text1: 'Error',
              text2: error instanceof Error ? error.message : 'Failed to delete gift',
            });
          } finally {
            setDeletingGiftId(null);
          }
        },
      },
    ]);
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
              navigation.navigate('LuckyDrawConfig');
            }
          }}>
          <Icon name="arrow-left" size={16} color={colors.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          Gift Configuration
        </Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowCreateModal(true)}
          activeOpacity={0.8}>
          <Icon name="plus" size={14} color="#fff" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.eventInfo}>
        <Text style={styles.eventLabel}>Event</Text>
        <Text style={styles.eventName}>{eventTitle || 'Selected Event'}</Text>
      </View>

      <FlatList
        data={gifts}
        keyExtractor={(item, index) => item._id || item.id || `${item.product_name}-${index}`}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Icon name="gift" size={36} color={colors.textMuted} />
            <Text style={styles.emptyText}>No gifts added yet for this event</Text>
          </View>
        }
        renderItem={({ item }) => {
          const giftId = item._id || item.id;
          const isDeleting = deletingGiftId === giftId;
          return (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.product_name}</Text>
              <Text style={styles.metaText}>Qty: {item.available_quantity ?? 1}</Text>
              {!!item.description && <Text style={styles.descText}>{item.description}</Text>}
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDeleteGift(item)}
                disabled={isDeleting}>
                {isDeleting ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <>
                    <Icon name="trash" size={14} color={colors.danger} />
                    <Text style={styles.deleteText}>Delete</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          );
        }}
      />

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
            <Text style={styles.modalTitle}>Add Gift</Text>

            <Text style={styles.inputLabel}>Product Name *</Text>
            <TextInput
              style={styles.input}
              value={productName}
              onChangeText={setProductName}
              placeholder="Enter gift name"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.inputLabel}>Available Quantity</Text>
            <TextInput
              style={styles.input}
              value={availableQuantity}
              onChangeText={setAvailableQuantity}
              keyboardType="numeric"
              placeholder="1"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Optional description"
              placeholderTextColor={colors.textMuted}
              multiline
            />

            <Text style={styles.inputLabel}>Image *</Text>
            <TouchableOpacity style={styles.imageBtn} onPress={handlePickImage}>
              <Icon name="image" size={14} color={colors.primary} />
              <Text style={styles.imageBtnText}>
                {selectedImage ? 'Image selected' : 'Select gift image'}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.submitBtn, (!canSubmit || submitting) && styles.disabled]}
                disabled={!canSubmit || submitting}
                onPress={handleAddGift}>
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Create</Text>
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
    gap: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.cardMuted,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  backText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  title: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 20,
    color: colors.text,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#fff',
    fontFamily: fonts.body,
    fontWeight: '600',
  },
  eventInfo: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  eventLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  eventName: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.text,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 70,
    gap: 8,
  },
  emptyText: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 14,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  cardTitle: {
    fontFamily: fonts.heading,
    fontSize: 17,
    color: colors.text,
    marginBottom: 4,
  },
  metaText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },
  descText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text,
    marginTop: 6,
  },
  deleteBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  deleteText: {
    fontFamily: fonts.body,
    color: colors.danger,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
  },
  modalTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: colors.text,
    marginBottom: 10,
  },
  inputLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
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
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  imageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.cardMuted,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  imageBtnText: {
    fontFamily: fonts.body,
    color: colors.primary,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
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
  submitBtn: {
    backgroundColor: colors.primary,
  },
  cancelBtnText: {
    fontFamily: fonts.body,
    color: colors.text,
    fontWeight: '600',
  },
  submitBtnText: {
    fontFamily: fonts.body,
    color: '#fff',
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
});
