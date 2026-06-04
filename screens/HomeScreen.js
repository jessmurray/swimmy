import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const GRID_ITEM_SIZE = (width - 48) / 2;

const C = {
  bg: '#F5F0E8',
  navy: '#042C53',
  navyMid: '#0F2044',
  navyLight: '#1A3A6E',
  navyAlpha60: 'rgba(4,44,83,0.6)',
  navyAlpha30: 'rgba(4,44,83,0.3)',
  navyAlpha12: 'rgba(4,44,83,0.12)',
  navyAlpha06: 'rgba(4,44,83,0.06)',
  accent: '#00A8E8',
  accentGlow: '#0074C8',
  accentSoft: '#1BBFFF',
  gold: '#F5A623',
  white: '#FFFFFF',
  cardBg: '#FFFFFF',
  cardBorder: 'rgba(4,44,83,0.08)',
  w80: 'rgba(255,255,255,0.8)',
  w50: 'rgba(255,255,255,0.5)',
  w20: 'rgba(255,255,255,0.2)',
  w08: 'rgba(255,255,255,0.08)',
};

const todaysWorkout = {
  title: 'Threshold Builder',
  subtitle: 'Tuesday · Main Set',
  duration: '58 min',
  distance: '4,200m',
  intensity: 'Threshold',
  sets: [
    { label: 'Warm-up',   detail: '400m easy FR + 4×50m drill' },
    { label: 'Pre-set',   detail: '6×100m @ CSS +5s, :20 rest' },
    { label: 'Main set',  detail: '3×(4×200m) @ CSS, :30/:90 rest' },
    { label: 'Cool-down', detail: '300m easy choice' },
  ],
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getTodaysWorkout(plan) {
  if (!plan?.weeks?.[0]?.sessions?.length) return null;

  const sessions = plan.weeks[0].sessions;
  const todayAbbr = DAY_NAMES[new Date().getDay()];

  let session = sessions.find((s) => s.day === todayAbbr);

  if (!session) {
    for (let i = 1; i <= 7; i++) {
      const next = DAY_NAMES[(new Date().getDay() + i) % 7];
      session = sessions.find((s) => s.day === next);
      if (session) break;
    }
  }

  if (!session) session = sessions[0];

  return {
    title:      session.title,
    subtitle:   `${session.day} · Week ${plan.weeks[0].week ?? 1}`,
    duration:   session.duration,
    distance:   session.distance,
    intensity:  session.intensity,
    sets:       session.sets,
    weekNumber: plan.weeks[0].week ?? 1,
  };
}

const GRID_ACCENT = '#00A8E8';

function IntensityBadge({ label }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

function StatPill({ icon, value, label }) {
  return (
    <View style={styles.statPill}>
      <Ionicons name={icon} size={14} color={C.accent} />
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

function WorkoutCard({ workout, onStart }) {
  return (
    <TouchableOpacity activeOpacity={0.9} style={styles.workoutCardWrapper}>
      <LinearGradient
        colors={['#0F2A5A', '#0A1A3C', '#07101F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.workoutCard}
      >
        <View style={styles.laneLineContainer} pointerEvents="none">
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.laneLine, { top: 28 + i * 22, opacity: 0.06 + i * 0.02 }]} />
          ))}
        </View>
        <View style={styles.glowBlob} pointerEvents="none" />

        <View style={styles.workoutHeader}>
          <View style={styles.workoutTitleBlock}>
            <Text style={styles.workoutSub}>{workout.subtitle}</Text>
            <Text style={styles.workoutTitle}>{workout.title}</Text>
          </View>
          <IntensityBadge label={workout.intensity} />
        </View>

        <View style={styles.statsRow}>
          <StatPill icon="time-outline"  value={workout.duration} label="Duration" />
          <View style={styles.statDivider} />
          <StatPill icon="water-outline" value={workout.distance} label="Distance" />
        </View>

        <View style={styles.setsContainer}>
          {workout.sets.map((set, idx) => (
            <View key={idx} style={styles.setRow}>
              <View style={styles.setDot} />
              <Text style={styles.setLabel}>{set.label}</Text>
              <Text style={styles.setDetail} numberOfLines={1}>{set.detail}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity activeOpacity={0.85} style={styles.startBtn} onPress={() => onStart?.(workout)}>
          <LinearGradient
            colors={[C.accent, C.accentGlow]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.startBtnGradient}
          >
            <Ionicons name="play" size={14} color="#fff" />
            <Text style={styles.startBtnText}>Start Workout</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function GridItem({ item }) {
  return (
    <TouchableOpacity activeOpacity={0.82} style={styles.gridItemWrapper} onPress={item.onPress}>
      <View style={styles.gridItem}>
        <View style={[styles.gridAccentBar, { backgroundColor: GRID_ACCENT }]} />
        <View style={[styles.gridIconCircle, { backgroundColor: GRID_ACCENT + '14', borderColor: GRID_ACCENT + '30' }]}>
          <Ionicons name={item.icon} size={24} color={GRID_ACCENT} />
        </View>
        <Text style={styles.gridLabel}>{item.label}</Text>
        <Text style={styles.gridSub}>{item.sub}</Text>
        <View style={styles.gridArrow}>
          <Ionicons name="chevron-forward" size={14} color={C.navyAlpha30} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function getPredictionsSub(plan) {
  const updatedAt = plan?._meta?.predictions_updated_at;
  if (updatedAt) {
    const label = new Date(updatedAt).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
    return `Predictions last updated: ${label}`;
  }
  if (plan?._meta?.predictions) return 'Predictions ready';
  return 'Tap to generate predictions';
}

export default function HomeScreen({ profile, plan, onOpenPlan, onOpenProfile, onOpenTimes, onOpenStrength, onStartWorkout, onSignOut }) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const workout = getTodaysWorkout(plan) || todaysWorkout;

  const gridItems = [
    { id: 'plan',   label: 'Training Plan',   sub: '12-week base',         icon: 'calendar-outline',    onPress: onOpenPlan },
    { id: 'times',  label: 'Predicted Times', sub: getPredictionsSub(plan), icon: 'timer-outline',       onPress: onOpenTimes },
    { id: 'strength', label: 'Strength &\nRecovery', sub: 'Next: Mobility', icon: 'barbell-outline', onPress: onOpenStrength },
    { id: 'profile', label: 'Profile',              sub: profile?.name ?? 'Profile', icon: 'person-circle-outline', onPress: onOpenProfile },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.navbar}>
          <View>
            <Text style={styles.appName}>SWIMMY</Text>
            <Text style={styles.navDate}>{today}</Text>
          </View>
          <View style={styles.navActions}>
            <TouchableOpacity style={styles.notifBtn}>
              <Ionicons name="notifications-outline" size={22} color={C.navy} />
              <View style={styles.notifDot} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut} activeOpacity={0.7}>
              <Ionicons name="log-out-outline" size={20} color={C.navyAlpha60} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View style={[styles.sectionPip, { backgroundColor: C.accent }]} />
          <Text style={styles.sectionTitle}>Today's Workout</Text>
        </View>

        <WorkoutCard workout={workout} onStart={onStartWorkout} />

        <View style={[styles.grid, { marginTop: 20 }]}>
          {gridItems.map((item) => (
            <GridItem key={item.id} item={item} />
          ))}
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },

  navbar: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 12, marginBottom: 4,
  },
  appName: { fontSize: 22, fontWeight: '800', color: C.navy, letterSpacing: 4 },
  navDate: { fontSize: 12, color: C.navyAlpha60, marginTop: 2, letterSpacing: 0.3 },
  navActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notifBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.navyAlpha06, alignItems: 'center', justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute', top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.accent, borderWidth: 1.5, borderColor: C.bg,
  },
  signOutBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.navyAlpha06, alignItems: 'center', justifyContent: 'center',
  },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionPip: { width: 3, height: 16, borderRadius: 2, marginRight: 8 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: C.navyAlpha60,
    letterSpacing: 1.4, textTransform: 'uppercase',
  },

  workoutCardWrapper: {
    borderRadius: 20, overflow: 'hidden',
    shadowColor: C.navyMid, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22, shadowRadius: 22, elevation: 12,
  },
  workoutCard: { padding: 22, borderRadius: 20, overflow: 'hidden' },
  laneLineContainer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  laneLine: { position: 'absolute', left: -10, right: -10, height: 1, backgroundColor: C.accent },
  glowBlob: {
    position: 'absolute', right: -40, top: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: C.accent, opacity: 0.06,
  },
  workoutHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 16,
  },
  workoutTitleBlock: { flex: 1, paddingRight: 12 },
  workoutSub: {
    fontSize: 11, color: C.w50, letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 4,
  },
  workoutTitle: { fontSize: 24, fontWeight: '800', color: C.white, letterSpacing: -0.3 },
  badge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    backgroundColor: 'rgba(0,168,232,0.18)',
    borderWidth: 1, borderColor: 'rgba(0,168,232,0.4)',
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: C.accentSoft, letterSpacing: 0.5 },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 18, paddingBottom: 18,
    borderBottomWidth: 1, borderBottomColor: C.w08,
  },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statValue: { fontSize: 18, fontWeight: '700', color: C.white, lineHeight: 20 },
  statLabel: { fontSize: 10, color: C.w50, textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, height: 32, backgroundColor: C.w20, marginHorizontal: 20 },
  setsContainer: { marginBottom: 20, gap: 9 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  setDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.accent, opacity: 0.7 },
  setLabel: { fontSize: 12, fontWeight: '700', color: C.w80, width: 72, flexShrink: 0 },
  setDetail: { fontSize: 12, color: C.w50, flex: 1 },
  startBtn: { borderRadius: 12, overflow: 'hidden' },
  startBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, gap: 8, borderRadius: 12,
  },
  startBtnText: { fontSize: 14, fontWeight: '700', color: C.white, letterSpacing: 0.5 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItemWrapper: {
    width: GRID_ITEM_SIZE, height: GRID_ITEM_SIZE, borderRadius: 18,
    overflow: 'hidden', backgroundColor: C.cardBg,
    borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: C.navy, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  gridItem: { flex: 1, padding: 18, justifyContent: 'flex-end' },
  gridAccentBar: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
  },
  gridIconCircle: {
    width: 46, height: 46, borderRadius: 23, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 'auto', marginTop: 20,
  },
  gridLabel: { fontSize: 14, fontWeight: '700', color: '#042C53', lineHeight: 19, marginBottom: 3 },
  gridSub: { fontSize: 11, color: 'rgba(4,44,83,0.6)', letterSpacing: 0.2 },
  gridArrow: { position: 'absolute', bottom: 14, right: 14 },

  bottomPad: { height: 32 },
});
