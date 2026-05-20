import { useEffect, useState } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ScrollView,
  ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { generatePredictions } from '../services/generatePredictions';

const C = {
  bg: '#F5F0E8',
  navy: '#042C53',
  navyAlpha80: 'rgba(4,44,83,0.80)',
  navyAlpha60: 'rgba(4,44,83,0.6)',
  navyAlpha30: 'rgba(4,44,83,0.3)',
  navyAlpha15: 'rgba(4,44,83,0.15)',
  navyAlpha08: 'rgba(4,44,83,0.08)',
  accent: '#00A8E8',
  accentBg: 'rgba(0,168,232,0.08)',
  white: '#FFFFFF',
  green: '#16a34a',
  greenBg: 'rgba(22,163,74,0.10)',
};

const STROKE_ORDER  = ['freestyle', 'backstroke', 'breaststroke', 'butterfly', 'im'];
const STROKE_LABELS = {
  freestyle: 'Freestyle', backstroke: 'Backstroke', breaststroke: 'Breaststroke',
  butterfly: 'Butterfly', im: 'IM',
};

export default function PredictedTimesScreen({ plan, onBack, onPlanUpdate }) {
  const meta   = plan?._meta ?? {};
  const events = meta.events ?? {};

  const [localEventTimes, setLocalEventTimes] = useState(meta.event_times ?? {});
  const [predictions, setPredictions]         = useState(meta.predictions ?? null);
  const [loading, setLoading]                 = useState(false);
  const [recalculating, setRecalculating]     = useState(false);
  const [error, setError]                     = useState(null);

  // Modal state
  const [editModal, setEditModal] = useState(null); // { strokeId, dist }
  const [timeInput, setTimeInput] = useState('');

  useEffect(() => {
    if (!meta.predictions && Object.keys(events).length > 0) {
      generateAndPersist({ ...meta, event_times: localEventTimes });
    }
  }, []);

  // silent=true keeps existing predictions visible and uses an inline spinner
  const generateAndPersist = async (metaSnapshot, silent = false) => {
    setError(null);
    silent ? setRecalculating(true) : setLoading(true);
    try {
      const result = await generatePredictions(metaSnapshot);
      setPredictions(result);
      onPlanUpdate?.({ ...plan, _meta: { ...metaSnapshot, predictions: result } });
    } catch (e) {
      console.error('[PredictedTimes] generation failed:', e?.message ?? e);
      if (!silent) {
        setError('Could not generate predictions. Check your connection and try again.');
      }
    } finally {
      setLoading(false);
      setRecalculating(false);
    }
  };

  // Refresh button always uses latest local times
  const handleRefresh = () =>
    generateAndPersist({ ...meta, event_times: localEventTimes });

  // ── PB edit modal ────────────────────────────────────────────────────────────

  const openEdit = (strokeId, dist) => {
    setTimeInput(localEventTimes[strokeId]?.[dist] ?? '');
    setEditModal({ strokeId, dist });
  };

  const handleSave = async () => {
    const trimmed = timeInput.trim();

    const updatedTimes = {
      ...localEventTimes,
      [editModal.strokeId]: {
        ...(localEventTimes[editModal.strokeId] ?? {}),
        [editModal.dist]: trimmed,
      },
    };

    setLocalEventTimes(updatedTimes);
    setEditModal(null);

    // Recalculate silently — existing predictions stay visible during the API call.
    // generateAndPersist saves both the updated times and new predictions in one write.
    await generateAndPersist({ ...meta, event_times: updatedTimes }, true);
  };

  // ── Derived data ─────────────────────────────────────────────────────────────

  const strokeRows = STROKE_ORDER
    .map((id) => ({
      id,
      label: STROKE_LABELS[id],
      dists: (events[id] ?? []).slice().sort((a, b) => parseInt(a, 10) - parseInt(b, 10)),
    }))
    .filter((s) => s.dists.length > 0);

  const hasEvents = strokeRows.length > 0;

  const editLabel = editModal
    ? `${STROKE_LABELS[editModal.strokeId]} ${editModal.dist}`
    : '';

  // ── Loading state ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <View style={styles.navbar}>
          <TouchableOpacity style={styles.navBtn} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={C.navy} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Predicted Times</Text>
          <View style={styles.navBtn} />
        </View>
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={styles.loadingTitle}>Generating predictions…</Text>
          <Text style={styles.loadingSub}>
            Analysing your events, level, and training schedule.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────────

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <View style={styles.navbar}>
          <TouchableOpacity style={styles.navBtn} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={C.navy} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Predicted Times</Text>
          <View style={styles.navBtn} />
        </View>
        <View style={styles.centred}>
          <Ionicons name="cloud-offline-outline" size={48} color={C.navyAlpha30} />
          <Text style={styles.errorTitle}>Predictions unavailable</Text>
          <Text style={styles.errorSub}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRefresh} activeOpacity={0.85}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main view ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Predicted Times</Text>
        {predictions ? (
          <TouchableOpacity style={styles.navBtn} onPress={handleRefresh} activeOpacity={0.7}>
            <Ionicons name="refresh-outline" size={20} color={C.navyAlpha60} />
          </TouchableOpacity>
        ) : (
          <View style={styles.navBtn} />
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {!hasEvents ? (
          <View style={styles.centredInline}>
            <Ionicons name="timer-outline" size={52} color={C.navyAlpha30} />
            <Text style={styles.emptyTitle}>No events selected</Text>
            <Text style={styles.emptySub}>
              Complete onboarding to select the events you want to focus on.
            </Text>
          </View>
        ) : (
          <>
            {recalculating ? (
              <View style={styles.recalcRow}>
                <ActivityIndicator size="small" color={C.accent} />
                <Text style={styles.recalcText}>Recalculating predictions…</Text>
              </View>
            ) : (
              <Text style={styles.tapHint}>Tap a row to update your current PB</Text>
            )}

            {strokeRows.map(({ id, label, dists }) => (
              <View key={id} style={styles.strokeSection}>
                <Text style={styles.strokeLabel}>{label}</Text>
                <View style={styles.card}>
                  <View style={styles.tableHeader}>
                    <Text style={styles.colEvent}>Event</Text>
                    <Text style={styles.colPbHeader}>Current PB</Text>
                    <Text style={styles.colTargetHeader}>Target</Text>
                  </View>

                  {dists.map((dist, idx) => {
                    const pb   = localEventTimes[id]?.[dist]?.trim();
                    const pred = predictions?.[id]?.[dist];
                    return (
                      <TouchableOpacity
                        key={dist}
                        activeOpacity={0.6}
                        disabled={recalculating}
                        style={[styles.tableRow, idx < dists.length - 1 && styles.rowBorder]}
                        onPress={() => openEdit(id, dist)}
                      >
                        <Text style={styles.colEvent}>{dist}</Text>

                        <View style={styles.colPb}>
                          <Text style={pb ? styles.pbText : styles.pbEmpty}>
                            {pb || 'Add PB'}
                          </Text>
                          {!pb && (
                            <Ionicons name="pencil-outline" size={11} color={C.accent} style={{ marginLeft: 4 }} />
                          )}
                        </View>

                        <View style={styles.targetCell}>
                          {pred ? (
                            <>
                              <Text style={styles.predTime}>{pred.time}</Text>
                              {pred.improvement > 0 && (
                                <View style={styles.badge}>
                                  <Text style={styles.badgeText}>
                                    ↓ {pred.improvement.toFixed(1)}%
                                  </Text>
                                </View>
                              )}
                            </>
                          ) : (
                            <Text style={styles.emptyCell}>—</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

            {!predictions && (
              <TouchableOpacity style={styles.generateBtn} onPress={handleRefresh} activeOpacity={0.85}>
                <Ionicons name="sparkles-outline" size={18} color={C.white} />
                <Text style={styles.generateBtnText}>Generate predictions</Text>
              </TouchableOpacity>
            )}

            <View style={styles.noteCard}>
              <Ionicons name="information-circle-outline" size={16} color={C.accent} />
              <Text style={styles.noteText}>
                Predictions are based on your current level, training schedule, and selected events.
                Actual results depend on consistency and effort.
              </Text>
            </View>
          </>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Edit PB modal ───────────────────────────────────────────────────── */}
      <Modal
        visible={!!editModal}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModal(null)}
      >
        <TouchableWithoutFeedback onPress={() => setEditModal(null)}>
          <View style={styles.backdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              >
                <View style={styles.modalCard}>
                  <Text style={styles.modalTitle}>{editLabel}</Text>
                  <Text style={styles.modalSub}>Enter your current personal best</Text>

                  <TextInput
                    style={styles.modalInput}
                    value={timeInput}
                    onChangeText={setTimeInput}
                    placeholder="0:00.00"
                    placeholderTextColor={C.navyAlpha30}
                    keyboardType="numbers-and-punctuation"
                    autoFocus
                    selectTextOnFocus
                    returnKeyType="done"
                    onSubmitEditing={handleSave}
                  />

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => setEditModal(null)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.saveBtn}
                      onPress={handleSave}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.saveText}>Save & recalculate</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8 },

  navbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  navBtn:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 17, fontWeight: '700', color: C.navy, letterSpacing: -0.2 },

  centred: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 12,
  },
  centredInline: { alignItems: 'center', paddingTop: 80, gap: 12 },

  loadingTitle: { fontSize: 18, fontWeight: '800', color: C.navy, marginTop: 8 },
  loadingSub:   { fontSize: 14, color: C.navyAlpha60, textAlign: 'center', lineHeight: 20 },
  errorTitle:   { fontSize: 18, fontWeight: '800', color: C.navy, marginTop: 8 },
  errorSub:     { fontSize: 14, color: C.navyAlpha60, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    marginTop: 8, paddingHorizontal: 28, paddingVertical: 13,
    backgroundColor: C.navy, borderRadius: 12,
  },
  retryText: { fontSize: 15, fontWeight: '700', color: C.white },

  emptyTitle: { fontSize: 20, fontWeight: '800', color: C.navy },
  emptySub: {
    fontSize: 14, color: C.navyAlpha60, textAlign: 'center',
    lineHeight: 20, paddingHorizontal: 24,
  },

  tapHint: {
    fontSize: 12, color: C.navyAlpha60, marginBottom: 14,
    paddingHorizontal: 4,
  },
  recalcRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 14, paddingHorizontal: 4,
  },
  recalcText: { fontSize: 12, color: C.accent, fontWeight: '600' },

  strokeSection: { marginBottom: 20 },
  strokeLabel: {
    fontSize: 11, fontWeight: '800', color: C.navyAlpha30,
    letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8, paddingHorizontal: 4,
  },
  card: {
    backgroundColor: C.white, borderRadius: 16,
    borderWidth: 1, borderColor: C.navyAlpha08, overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.navyAlpha08,
    backgroundColor: C.bg,
  },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.navyAlpha08 },

  colEvent:       { flex: 1, fontSize: 13, fontWeight: '700', color: C.navy },
  colPbHeader:    { width: 84, fontSize: 12, fontWeight: '600', color: C.navyAlpha30, textAlign: 'right' },
  colTargetHeader:{ width: 88, fontSize: 12, fontWeight: '600', color: C.navyAlpha30, textAlign: 'right' },

  colPb:    { width: 84, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  pbText:   { fontSize: 13, fontWeight: '600', color: C.navy },
  pbEmpty:  { fontSize: 12, fontWeight: '600', color: C.accent },

  targetCell: { width: 88, alignItems: 'flex-end' },
  predTime:   { fontSize: 13, fontWeight: '700', color: C.navy },
  emptyCell:  { fontSize: 13, color: C.navyAlpha30 },
  badge: {
    marginTop: 3, paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: C.greenBg, borderRadius: 6,
    borderWidth: 1, borderColor: 'rgba(22,163,74,0.20)',
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: C.green, letterSpacing: 0.2 },

  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: C.navy, borderRadius: 14,
    paddingVertical: 15, marginBottom: 16,
  },
  generateBtnText: { fontSize: 15, fontWeight: '700', color: C.white },

  noteCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: C.accentBg, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(0,168,232,0.15)', marginBottom: 8,
  },
  noteText: { flex: 1, fontSize: 12, color: C.navyAlpha60, lineHeight: 18 },

  // ── Modal ──────────────────────────────────────────────────────────────────
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,44,83,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: C.bg,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  modalTitle: {
    fontSize: 20, fontWeight: '800', color: C.navy,
    letterSpacing: -0.3, marginBottom: 4,
  },
  modalSub: {
    fontSize: 13, color: C.navyAlpha60, marginBottom: 20,
  },
  modalInput: {
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.navyAlpha15,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 15,
    fontSize: 24,
    fontWeight: '700',
    color: C.navy,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: C.navyAlpha08,
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: C.navyAlpha60 },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: C.navy,
  },
  saveText: { fontSize: 15, fontWeight: '700', color: C.white },
});
