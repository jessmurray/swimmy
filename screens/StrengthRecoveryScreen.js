import { useEffect, useState } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { generateSRPlan } from '../services/generateSRPlan';
import { buildSRWeeks, getTodayOrNextSR } from '../utils/srSchedule';

const C = {
  bg: '#F5F0E8',
  navy: '#042C53',
  navyAlpha60: 'rgba(4,44,83,0.6)',
  navyAlpha30: 'rgba(4,44,83,0.3)',
  navyAlpha12: 'rgba(4,44,83,0.12)',
  navyAlpha08: 'rgba(4,44,83,0.08)',
  navyAlpha06: 'rgba(4,44,83,0.06)',
  white: '#FFFFFF',
  sage: '#7BAF7B',
  sageDark: '#4A7A4A',
  sageDarker: '#2D5430',
  sageDarkest: '#1E3B20',
  sageAlpha20: 'rgba(123,175,123,0.20)',
  sageAlpha12: 'rgba(123,175,123,0.12)',
  sageAlpha08: 'rgba(123,175,123,0.08)',
  sageAlpha30: 'rgba(123,175,123,0.30)',
  w80: 'rgba(255,255,255,0.80)',
  w50: 'rgba(255,255,255,0.50)',
  w20: 'rgba(255,255,255,0.20)',
  w08: 'rgba(255,255,255,0.08)',
};

const CAT_ICONS   = { strength: 'barbell-outline', mobility: 'body-outline', recovery: 'leaf-outline' };
const CAT_LABELS  = { strength: 'Strength', mobility: 'Mobility', recovery: 'Recovery' };
const CAT_DETAILS = {
  strength: 'Weights, core & resistance bands',
  mobility: 'Yoga, pilates & functional fitness',
  recovery: 'Stretching & foam rolling',
};

function hasPoolContent(lib) {
  // Substring match — no word boundaries so "swimming" and "swimmer" also trigger.
  const terms = ['swim', 'pool', 'aqua'];
  return (lib?.recovery ?? []).some(workout =>
    (workout.sets ?? []).some(set =>
      terms.some(t => (set.detail ?? '').toLowerCase().includes(t))
    )
  );
}

function getGroupLabel(workout, category) {
  if (category === 'strength') return workout.muscle_group ?? 'General';
  if (category === 'mobility') return workout.focus_area   ?? 'General';
  return workout.body_area ?? 'General';
}

function groupedWorkouts(workouts, category) {
  const map = {};
  (workouts ?? []).forEach(w => {
    const g = getGroupLabel(w, category);
    if (!map[g]) map[g] = [];
    map[g].push(w);
  });
  return Object.entries(map).map(([name, items]) => ({ name, items }));
}

// ── Category badge ─────────────────────────────────────────────────────────────

function CatBadge({ category }) {
  return (
    <View style={styles.catBadge}>
      <Text style={styles.catBadgeText}>{(CAT_LABELS[category] ?? category).toUpperCase()}</Text>
    </View>
  );
}

// ── Today's recommendation card ────────────────────────────────────────────────

function TodayCard({ session }) {
  if (!session) {
    return (
      <View style={styles.todayPlaceholder}>
        <Ionicons name="barbell-outline" size={36} color={C.sageAlpha20} />
        <Text style={styles.placeholderTitle}>No programme yet</Text>
        <Text style={styles.placeholderSub}>
          Generate your personalised S&R programme below.
        </Text>
      </View>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.9} style={styles.todayWrapper}>
      <LinearGradient
        colors={[C.sageDark, C.sageDarker, C.sageDarkest]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.todayCard}
      >
        <View style={styles.glowBlob} pointerEvents="none" />

        <View style={styles.todayHeader}>
          <View style={styles.todayTitleBlock}>
            <Text style={styles.todaySub}>{session.whenLabel}</Text>
            <Text style={styles.todayTitle}>{session.title}</Text>
          </View>
          <CatBadge category={session.sr_category} />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Ionicons name="time-outline" size={14} color={C.sage} />
            <View>
              <Text style={styles.statValue}>{session.duration}</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
          </View>
          {session.equipment && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statPill}>
                <Ionicons name="fitness-outline" size={14} color={C.sage} />
                <View>
                  <Text style={styles.statValue}>{session.equipment}</Text>
                  <Text style={styles.statLabel}>Equipment</Text>
                </View>
              </View>
            </>
          )}
        </View>

        <View style={styles.setsContainer}>
          {(session.sets ?? []).map((set, idx) => (
            <View key={idx} style={styles.setRow}>
              <View style={styles.setDot} />
              <Text style={styles.setLabel}>{set.label}</Text>
              <Text style={styles.setDetail} numberOfLines={1}>{set.detail}</Text>
            </View>
          ))}
        </View>

        <LinearGradient
          colors={[C.sage, C.sageDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.startBtn}
        >
          <Ionicons name="play" size={14} color={C.white} />
          <Text style={styles.startBtnText}>Start Session</Text>
        </LinearGradient>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ── Category explore box ───────────────────────────────────────────────────────

function CategoryBox({ category, count, onPress }) {
  return (
    <TouchableOpacity style={styles.catBox} onPress={onPress} activeOpacity={0.82}>
      <View style={styles.catBoxAccent} />
      <View style={styles.catBoxContent}>
        <View style={styles.catBoxIconCircle}>
          <Ionicons name={CAT_ICONS[category]} size={22} color={C.sage} />
        </View>
        <View style={styles.catBoxText}>
          <Text style={styles.catBoxLabel}>{CAT_LABELS[category]}</Text>
          <Text style={styles.catBoxSub}>{count} workouts  ·  {CAT_DETAILS[category]}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={C.navyAlpha30} />
      </View>
    </TouchableOpacity>
  );
}

// ── Shared navbar ──────────────────────────────────────────────────────────────

function Navbar({ title, onBack }) {
  return (
    <View style={styles.navbar}>
      <TouchableOpacity style={styles.navBtn} onPress={onBack} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={22} color={C.navy} />
      </TouchableOpacity>
      <Text style={styles.navTitle}>{title}</Text>
      <View style={styles.navBtn} />
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function StrengthRecoveryScreen({ plan, onBack, onPlanUpdate }) {
  const meta    = plan?._meta ?? {};
  const library = meta.sr?.library ?? null;

  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [view, setView]               = useState('main'); // 'main' | 'library'
  const [libCategory, setLibCategory] = useState(null);
  const [expandedId, setExpandedId]   = useState(null);

  const srWeeks      = library ? buildSRWeeks(plan, library) : [];
  const recommendation = getTodayOrNextSR(srWeeks);

  useEffect(() => {
    if (!library) {
      generateLibrary();
    } else if (hasPoolContent(library)) {
      console.log('[SR] Pool content detected in recovery sessions — clearing cache and regenerating');
      onPlanUpdate?.({ ...plan, _meta: { ...meta, sr: null } });
      generateLibrary();
    }
  }, []);

  const generateLibrary = async () => {
    setLoading(true);
    setError(null);
    try {
      const lib = await generateSRPlan(meta);
      onPlanUpdate?.({ ...plan, _meta: { ...meta, sr: { library: lib } } });
    } catch (e) {
      console.error('[SR] generateSRPlan failed:', e?.message ?? e);
      setError('Could not generate programme. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <Navbar title="Strength & Recovery" onBack={onBack} />
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={C.sage} />
          <Text style={styles.loadingTitle}>Building your programme…</Text>
          <Text style={styles.loadingSub}>
            Designing swimmer-specific workouts tailored to your level.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <Navbar title="Strength & Recovery" onBack={onBack} />
        <View style={styles.centred}>
          <Ionicons name="cloud-offline-outline" size={48} color={C.navyAlpha30} />
          <Text style={styles.errorTitle}>Programme unavailable</Text>
          <Text style={styles.errorSub}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={generateLibrary} activeOpacity={0.85}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Library view ─────────────────────────────────────────────────────────────

  if (view === 'library' && libCategory) {
    const workouts = library?.[libCategory] ?? [];
    const groups   = groupedWorkouts(workouts, libCategory);

    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <Navbar
          title={CAT_LABELS[libCategory]}
          onBack={() => { setView('main'); setExpandedId(null); }}
        />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {groups.map(({ name, items }) => (
            <View key={name} style={styles.libGroup}>
              <Text style={styles.libGroupLabel}>{name}</Text>
              {items.map(workout => {
                const expanded = expandedId === workout.id;
                return (
                  <TouchableOpacity
                    key={workout.id}
                    style={[styles.workoutCard, expanded && styles.workoutCardExpanded]}
                    onPress={() => setExpandedId(expanded ? null : workout.id)}
                    activeOpacity={0.82}
                  >
                    <View style={styles.workoutSageBar} />
                    <View style={styles.workoutCardInner}>
                      <View style={styles.workoutCardInfo}>
                        <Text style={styles.workoutCardTitle}>{workout.title}</Text>
                        <Text style={styles.workoutCardMeta}>
                          {workout.duration}
                          {workout.equipment ? `  ·  ${workout.equipment}` : ''}
                        </Text>
                      </View>
                      <Ionicons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={C.navyAlpha30}
                      />
                    </View>
                    {expanded && (
                      <View style={styles.workoutSets}>
                        {(workout.sets ?? []).map((set, i) => (
                          <View key={i} style={[styles.libSetRow, i > 0 && styles.libSetBorder]}>
                            <View style={styles.libSetDot} />
                            <Text style={styles.libSetLabel}>{set.label}</Text>
                            <Text style={styles.libSetDetail}>{set.detail}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Main view ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <Navbar title="Strength & Recovery" onBack={onBack} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionPip, { backgroundColor: C.sage }]} />
          <Text style={styles.sectionTitle}>Today's Recommendation</Text>
        </View>

        <TodayCard session={recommendation} />

        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <View style={[styles.sectionPip, { backgroundColor: C.sage }]} />
          <Text style={styles.sectionTitle}>Explore</Text>
        </View>

        {library ? (
          <>
            {['strength', 'mobility', 'recovery'].map(cat => (
              <CategoryBox
                key={cat}
                category={cat}
                count={library[cat]?.length ?? 0}
                onPress={() => { setLibCategory(cat); setView('library'); }}
              />
            ))}
          </>
        ) : (
          <TouchableOpacity style={styles.generateBtn} onPress={generateLibrary} activeOpacity={0.85}>
            <Ionicons name="sparkles-outline" size={18} color={C.white} />
            <Text style={styles.generateBtnText}>Generate Programme</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8 },

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
  loadingTitle: { fontSize: 18, fontWeight: '800', color: C.navy, marginTop: 8 },
  loadingSub:   { fontSize: 14, color: C.navyAlpha60, textAlign: 'center', lineHeight: 20 },
  errorTitle:   { fontSize: 18, fontWeight: '800', color: C.navy, marginTop: 8 },
  errorSub:     { fontSize: 14, color: C.navyAlpha60, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    marginTop: 8, paddingHorizontal: 28, paddingVertical: 13,
    backgroundColor: C.sageDark, borderRadius: 12,
  },
  retryText: { fontSize: 15, fontWeight: '700', color: C.white },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionPip:    { width: 3, height: 16, borderRadius: 2, marginRight: 8 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: C.navyAlpha60,
    letterSpacing: 1.4, textTransform: 'uppercase',
  },

  // Today's card
  todayWrapper: {
    borderRadius: 20, overflow: 'hidden',
    shadowColor: C.sageDark, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22, shadowRadius: 22, elevation: 12,
    marginBottom: 4,
  },
  todayCard:   { padding: 22, borderRadius: 20, overflow: 'hidden' },
  glowBlob: {
    position: 'absolute', right: -40, top: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: C.sage, opacity: 0.08,
  },
  todayHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 16,
  },
  todayTitleBlock: { flex: 1, paddingRight: 12 },
  todaySub:  { fontSize: 11, color: C.w50, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  todayTitle: { fontSize: 24, fontWeight: '800', color: C.white, letterSpacing: -0.3 },
  catBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    backgroundColor: C.sageAlpha20, borderWidth: 1, borderColor: C.sageAlpha30,
  },
  catBadgeText: { fontSize: 11, fontWeight: '700', color: C.sage, letterSpacing: 0.5 },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 18, paddingBottom: 18,
    borderBottomWidth: 1, borderBottomColor: C.w08,
  },
  statPill:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statValue:  { fontSize: 18, fontWeight: '700', color: C.white, lineHeight: 20 },
  statLabel:  { fontSize: 10, color: C.w50, textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, height: 32, backgroundColor: C.w20, marginHorizontal: 20 },
  setsContainer: { marginBottom: 20, gap: 9 },
  setRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  setDot:  { width: 5, height: 5, borderRadius: 3, backgroundColor: C.sage, opacity: 0.7 },
  setLabel: { fontSize: 12, fontWeight: '700', color: C.w80, width: 72, flexShrink: 0 },
  setDetail: { fontSize: 12, color: C.w50, flex: 1 },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, gap: 8, borderRadius: 12,
  },
  startBtnText: { fontSize: 14, fontWeight: '700', color: C.white, letterSpacing: 0.5 },

  todayPlaceholder: {
    alignItems: 'center', paddingVertical: 36, gap: 10,
    backgroundColor: C.sageAlpha08, borderRadius: 20,
    borderWidth: 1, borderColor: C.sageAlpha12,
    marginBottom: 4,
  },
  placeholderTitle: { fontSize: 16, fontWeight: '700', color: C.navyAlpha60 },
  placeholderSub:   { fontSize: 13, color: C.navyAlpha30, textAlign: 'center', paddingHorizontal: 24 },

  // Category boxes
  catBox: {
    backgroundColor: C.white, borderRadius: 16, marginBottom: 10,
    borderWidth: 1, borderColor: C.navyAlpha08, overflow: 'hidden',
    shadowColor: C.navy, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  catBoxAccent: { height: 3, backgroundColor: C.sage },
  catBoxContent: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 14,
  },
  catBoxIconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.sageAlpha12, alignItems: 'center', justifyContent: 'center',
  },
  catBoxText: { flex: 1 },
  catBoxLabel: { fontSize: 15, fontWeight: '700', color: C.navy, marginBottom: 3 },
  catBoxSub:   { fontSize: 12, color: C.navyAlpha60 },

  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: C.sageDark, borderRadius: 14,
    paddingVertical: 15, marginBottom: 16,
  },
  generateBtnText: { fontSize: 15, fontWeight: '700', color: C.white },

  // Library view
  libGroup:      { marginBottom: 20 },
  libGroupLabel: {
    fontSize: 11, fontWeight: '800', color: C.navyAlpha30,
    letterSpacing: 1.4, textTransform: 'uppercase',
    marginBottom: 8, paddingHorizontal: 4,
  },
  workoutCard: {
    backgroundColor: C.white, borderRadius: 14, marginBottom: 8,
    borderWidth: 1, borderColor: C.navyAlpha08, overflow: 'hidden',
    shadowColor: C.navy, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  workoutCardExpanded: { borderColor: C.sageAlpha30 },
  workoutSageBar: { height: 3, backgroundColor: C.sage },
  workoutCardInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 14,
  },
  workoutCardInfo: { flex: 1 },
  workoutCardTitle: { fontSize: 14, fontWeight: '700', color: C.navy, marginBottom: 3 },
  workoutCardMeta:  { fontSize: 12, color: C.navyAlpha60 },
  workoutSets: {
    paddingHorizontal: 14, paddingBottom: 14, gap: 10,
  },
  libSetRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingTop: 10,
  },
  libSetBorder: { borderTopWidth: 1, borderTopColor: C.navyAlpha08 },
  libSetDot:    { width: 5, height: 5, borderRadius: 3, backgroundColor: C.sage, opacity: 0.7, marginTop: 4 },
  libSetLabel:  { fontSize: 12, fontWeight: '700', color: C.navy, width: 72, flexShrink: 0 },
  libSetDetail: { fontSize: 12, color: C.navyAlpha60, flex: 1, lineHeight: 18 },
});
