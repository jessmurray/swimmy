import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  SafeAreaView, Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const C = {
  bg: '#F5F0E8',
  navy: '#042C53',
  navyAlpha60: 'rgba(4,44,83,0.6)',
  navyAlpha30: 'rgba(4,44,83,0.3)',
  navyAlpha15: 'rgba(4,44,83,0.15)',
  navyAlpha12: 'rgba(4,44,83,0.12)',
  navyAlpha08: 'rgba(4,44,83,0.08)',
  navyAlpha06: 'rgba(4,44,83,0.06)',
  navyAlpha03: 'rgba(4,44,83,0.03)',
  accent: '#00A8E8',
  white: '#FFFFFF',
  w80: 'rgba(255,255,255,0.8)',
  w50: 'rgba(255,255,255,0.5)',
  w20: 'rgba(255,255,255,0.2)',
  w08: 'rgba(255,255,255,0.08)',
};

const CAT = {
  Base:    { bg: '#87CEEB', text: '#083347', border: 'rgba(135,206,235,0.7)' },
  Build:   { bg: '#F4A535', text: '#5C3200', border: 'rgba(244,165,53,0.7)'  },
  Sharpen: { bg: '#042C53', text: '#FFFFFF', border: 'rgba(4,44,83,0.5)'     },
};

const DOT_COLOR = { Base: '#87CEEB', Build: '#F4A535', Sharpen: '#042C53' };

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Normalise any day string the AI might return ("Monday", "monday", "Mon") → "Mon"
function normalizeDay(d) {
  if (!d) return '';
  const abbr = d.slice(0, 3);
  return abbr.charAt(0).toUpperCase() + abbr.slice(1).toLowerCase();
}
const CAL_DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PILL_W = 44;
const PILL_GAP = 6;

// ── Date / week helpers ───────────────────────────────────────────────────────

function getWeekStart(weekIndex) {
  const today = new Date();
  const dow = today.getDay();
  const toMon = dow === 0 ? -6 : 1 - dow;
  const d = new Date(today);
  d.setDate(d.getDate() + toMon + weekIndex * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayDate(weekStart, offset) {
  const d = new Date(weekStart);
  d.setDate(weekStart.getDate() + offset);
  return d;
}

function fmtRange(weekStart) {
  const end = new Date(weekStart);
  end.setDate(weekStart.getDate() + 6);
  return `${weekStart.getDate()} ${MONTHS[weekStart.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]}`;
}

function todayDaysIdx() {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}

function resolveCategory(session) {
  if (session.category && CAT[session.category]) return session.category;
  const s = (session.intensity || '').toLowerCase();
  if (s.includes('speed') || s.includes('race') || s.includes('anaerobic')) return 'Sharpen';
  if (s.includes('threshold') || s.includes('endurance') || s.includes('build')) return 'Build';
  return 'Base';
}

// ── Calendar helpers ──────────────────────────────────────────────────────────

function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function buildSessionDateMap(weeks) {
  if (!weeks?.length) return {};
  const map = {};
  const today = new Date();
  const dow = today.getDay();
  const toMon = dow === 0 ? -6 : 1 - dow;
  const firstMonday = new Date(today);
  firstMonday.setDate(today.getDate() + toMon);
  firstMonday.setHours(0, 0, 0, 0);

  weeks.forEach((week, wi) => {
    const wStart = new Date(firstMonday);
    wStart.setDate(firstMonday.getDate() + wi * 7);
    (week.sessions || []).forEach((s) => {
      const di = DAYS.indexOf(normalizeDay(s.day));
      if (di < 0) return;
      const d = new Date(wStart);
      d.setDate(wStart.getDate() + di);
      map[dateKey(d.getFullYear(), d.getMonth(), d.getDate())] = resolveCategory(s);
    });
  });
  return map;
}

function buildGrid(year, month) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDow = first.getDay();
  const offset = startDow === 0 ? 6 : startDow - 1;

  const cells = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function weekIdxContainingDate(year, month, day, weeks) {
  if (!weeks?.length) return null;
  const target = new Date(year, month, day);
  const today = new Date();
  const dow = today.getDay();
  const toMon = dow === 0 ? -6 : 1 - dow;
  const firstMonday = new Date(today);
  firstMonday.setDate(today.getDate() + toMon);
  firstMonday.setHours(0, 0, 0, 0);

  for (let wi = 0; wi < weeks.length; wi++) {
    const wStart = new Date(firstMonday);
    wStart.setDate(firstMonday.getDate() + wi * 7);
    const wEnd = new Date(wStart);
    wEnd.setDate(wStart.getDate() + 6);
    if (target >= wStart && target <= wEnd) {
      const di = Math.round((target - wStart) / 86400000);
      return { weekIdx: wi, dayIdx: di };
    }
  }
  return null;
}

// ── Category tag ──────────────────────────────────────────────────────────────

function CategoryTag({ category, small }) {
  const c = CAT[category] || CAT.Base;
  return (
    <View style={[styles.catTag, { backgroundColor: c.bg, borderColor: c.border }, small && styles.catTagSm]}>
      <Text style={[styles.catTagText, { color: c.text }, small && styles.catTagTextSm]}>
        {category}
      </Text>
    </View>
  );
}

// ── Month calendar ────────────────────────────────────────────────────────────

function MonthCalendar({ year, month, sessionDateMap, selectedDate, onDayPress }) {
  const rows = buildGrid(year, month);
  const today = new Date();
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <View style={styles.calendar}>
      <Text style={styles.calMonthTitle}>{MONTHS[month]} {year}</Text>

      <View style={styles.calRow}>
        {CAL_DAY_HEADERS.map((h, i) => (
          <View key={i} style={styles.calCell}>
            <Text style={styles.calDayHeader}>{h}</Text>
          </View>
        ))}
      </View>

      {rows.map((row, ri) => (
        <View key={ri} style={styles.calRow}>
          {row.map((day, ci) => {
            if (!day) return <View key={ci} style={styles.calCell} />;

            const key = dateKey(year, month, day);
            const category = sessionDateMap[key];
            const isToday = key === todayKey;
            const isSelected =
              selectedDate?.year === year &&
              selectedDate?.month === month &&
              selectedDate?.day === day;

            return (
              <TouchableOpacity
                key={ci}
                style={styles.calCell}
                onPress={() => onDayPress({ year, month, day })}
                activeOpacity={0.6}
              >
                <View style={[
                  styles.calNumWrap,
                  isToday && !isSelected && styles.calNumToday,
                  isSelected && !isToday && styles.calNumSelected,
                  isSelected && isToday  && styles.calNumSelectedToday,
                ]}>
                  <Text style={[
                    styles.calNum,
                    isToday && !isSelected && styles.calNumTextToday,
                    isSelected               && styles.calNumTextSelected,
                  ]}>
                    {day}
                  </Text>
                </View>
                <View style={[
                  styles.calDot,
                  category ? { backgroundColor: DOT_COLOR[category] } : { opacity: 0 },
                ]} />
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ── Session detail ────────────────────────────────────────────────────────────

function SessionDetail({ session, weekNum, onBack }) {
  const category = resolveCategory(session);

  return (
    <LinearGradient
      colors={['#0F2A5A', '#0A1A3C', '#07101F']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.laneLine, { top: 60 + i * 28, opacity: 0.05 + i * 0.02 }]} pointerEvents="none" />
      ))}

      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar style="light" />

        <View style={styles.detailNav}>
          <TouchableOpacity style={styles.detailBackBtn} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={C.w80} />
          </TouchableOpacity>
          <Text style={styles.detailNavLabel}>WEEK {weekNum}</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
          <CategoryTag category={category} />
          <Text style={styles.detailTitle}>{session.title}</Text>

          <View style={styles.detailBadge}>
            <Text style={styles.detailBadgeText}>{session.intensity}</Text>
          </View>

          <View style={styles.detailStats}>
            <View style={styles.detailStatPill}>
              <Ionicons name="water-outline" size={14} color={C.accent} />
              <View>
                <Text style={styles.detailStatVal}>{session.distance}</Text>
                <Text style={styles.detailStatLbl}>Distance</Text>
              </View>
            </View>
            <View style={styles.detailStatDiv} />
            <View style={styles.detailStatPill}>
              <Ionicons name="time-outline" size={14} color={C.accent} />
              <View>
                <Text style={styles.detailStatVal}>{session.duration}</Text>
                <Text style={styles.detailStatLbl}>Duration</Text>
              </View>
            </View>
          </View>

          <View style={styles.detailDivider} />

          <View style={styles.detailSets}>
            {(session.sets || []).map((set, i) => (
              <View key={i} style={styles.detailSetRow}>
                <View style={styles.detailSetDot} />
                <Text style={styles.detailSetLabel}>{set.label}</Text>
                <Text style={styles.detailSetDetail} numberOfLines={3}>{set.detail}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function TrainingPlanScreen({ plan, onBack }) {
  const [weekIdx, setWeekIdx] = useState(0);
  const [openSession, setOpenSession] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const t = new Date();
    return { year: t.getFullYear(), month: t.getMonth(), day: t.getDate() };
  });

  const weekScrollRef = useRef(null);
  const scrollViewRef = useRef(null);
  const dayListYRef   = useRef(0);
  const rowYRef       = useRef({});
  const pendingDayIdx = useRef(null);

  const weeks    = plan?.weeks || [];
  const weekData = weeks[weekIdx];
  const weekStart = getWeekStart(weekIdx);
  const todayIdx  = todayDaysIdx();

  const sessionDateMap = useMemo(() => buildSessionDateMap(weeks), [weeks]);

  console.log('[TrainingPlanScreen] plan received:', JSON.stringify(plan)?.slice(0, 300));
  console.log('[TrainingPlanScreen] weeks.length:', weeks.length);
  console.log('[TrainingPlanScreen] weekData (week 1):', JSON.stringify(weekData)?.slice(0, 300));
  console.log('[TrainingPlanScreen] sessionForDay("Mon"):', JSON.stringify(weekData?.sessions?.find((s) => normalizeDay(s.day) === 'Mon')));
  console.log('[TrainingPlanScreen] raw session days:', weekData?.sessions?.map((s) => s.day));

  const calYear  = weekStart.getFullYear();
  const calMonth = weekStart.getMonth();

  useEffect(() => {
    if (!weekScrollRef.current) return;
    const x = Math.max(0, weekIdx * (PILL_W + PILL_GAP) - width / 2 + PILL_W / 2);
    weekScrollRef.current.scrollTo({ x, animated: true });
  }, [weekIdx]);

  useEffect(() => {
    if (pendingDayIdx.current === null) return;
    const di = pendingDayIdx.current;
    pendingDayIdx.current = null;
    const timer = setTimeout(() => {
      const y = dayListYRef.current + (rowYRef.current[di] ?? 0);
      scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
    }, 150);
    return () => clearTimeout(timer);
  }, [selectedDate, weekIdx]);

  const handleCalendarDayPress = ({ year, month, day }) => {
    setSelectedDate({ year, month, day });
    const found = weekIdxContainingDate(year, month, day, weeks);
    if (!found) return;
    if (found.weekIdx !== weekIdx) setWeekIdx(found.weekIdx);
    pendingDayIdx.current = found.dayIdx;
  };

  if (openSession) {
    return (
      <SessionDetail session={openSession} weekNum={weekIdx + 1} onBack={() => setOpenSession(null)} />
    );
  }

  const sessionForDay = (day) => weekData?.sessions?.find((s) => normalizeDay(s.day) === day) ?? null;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      {/* ── Navbar ── */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={C.navy} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>TRAINING PLAN</Text>
        <View style={{ width: 36 }} />
      </View>

      {/*
        ── Week selector ──
        The horizontal ScrollView is wrapped in a plain View so Yoga can
        measure its intrinsic height from the pill content. A horizontal
        ScrollView placed directly in a flex column has no bounded height
        to measure against and can collapse or expand unpredictably.
      */}
      <View style={styles.weekStrip}>
        <ScrollView
          ref={weekScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.weekStripContent}
        >
          {weeks.map((w, i) => (
            <TouchableOpacity
              key={i}
              activeOpacity={0.7}
              style={[styles.weekPill, i === weekIdx && styles.weekPillActive]}
              onPress={() => setWeekIdx(i)}
            >
              <Text style={[styles.weekPillText, i === weekIdx && styles.weekPillTextActive]}>
                W{w.week}
              </Text>
              {i === 0 && weekIdx !== 0 && <View style={styles.weekPillCurrentDot} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Main scroll: calendar → week header → legend → day rows ── */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        automaticallyAdjustContentInsets={false}
      >
        <MonthCalendar
          year={calYear}
          month={calMonth}
          sessionDateMap={sessionDateMap}
          selectedDate={selectedDate}
          onDayPress={handleCalendarDayPress}
        />

        <View style={styles.weekHeader}>
          <View>
            <Text style={styles.weekTitle}>
              Week {weekData?.week ?? weekIdx + 1}
              {weekIdx === 0 ? <Text style={styles.weekCurrentLabel}> · Current</Text> : null}
            </Text>
            {weekData?.theme ? <Text style={styles.weekTheme}>{weekData.theme}</Text> : null}
          </View>
          <Text style={styles.weekDates}>{fmtRange(weekStart)}</Text>
        </View>

        <View style={styles.legend}>
          {Object.entries(CAT).map(([name, c]) => (
            <View key={name} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: c.bg, borderColor: c.border }]} />
              <Text style={styles.legendLabel}>{name}</Text>
            </View>
          ))}
        </View>

        <View onLayout={(e) => { dayListYRef.current = e.nativeEvent.layout.y; }}>
          {DAYS.map((day, di) => {
            const session  = sessionForDay(day);
            const date     = dayDate(weekStart, di);
            const isToday  = weekIdx === 0 && di === todayIdx;
            const isSelected =
              selectedDate &&
              date.getFullYear() === selectedDate.year &&
              date.getMonth()    === selectedDate.month &&
              date.getDate()     === selectedDate.day;

            if (session) {
              const cat = resolveCategory(session);
              return (
                <TouchableOpacity
                  key={day}
                  activeOpacity={0.75}
                  style={[
                    styles.sessionCard,
                    isToday    && styles.sessionCardToday,
                    isSelected && styles.sessionCardSelected,
                  ]}
                  onPress={() => setOpenSession(session)}
                  onLayout={(e) => { rowYRef.current[di] = e.nativeEvent.layout.y; }}
                >
                  {isToday && <View style={styles.todayBar} />}
                  <View style={styles.dateCol}>
                    <Text style={[styles.dateDay, isToday && { color: C.accent }]}>{day}</Text>
                    <Text style={[styles.dateNum, isToday && { color: C.accent }]}>{date.getDate()}</Text>
                  </View>
                  <View style={styles.sessionInfo}>
                    <CategoryTag category={cat} small />
                    <Text style={styles.sessionTitle} numberOfLines={1}>{session.title}</Text>
                    <Text style={styles.sessionStats}>{session.distance}  ·  {session.duration}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={C.navyAlpha30} />
                </TouchableOpacity>
              );
            }

            return (
              <View
                key={day}
                style={[
                  styles.restRow,
                  isToday    && { backgroundColor: C.navyAlpha03 },
                  isSelected && styles.restRowSelected,
                ]}
                onLayout={(e) => { rowYRef.current[di] = e.nativeEvent.layout.y; }}
              >
                <View style={styles.dateCol}>
                  <Text style={[styles.dateDay, styles.dateMuted]}>{day}</Text>
                  <Text style={[styles.dateNum, styles.dateMuted]}>{date.getDate()}</Text>
                </View>
                <Text style={styles.restLabel}>Rest</Text>
              </View>
            );
          })}
        </View>

        {weeks.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={36} color={C.navyAlpha30} />
            <Text style={styles.emptyText}>No plan available yet.</Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  // Navbar
  navbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.navyAlpha08,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.navyAlpha06, alignItems: 'center', justifyContent: 'center',
  },
  navTitle: { fontSize: 13, fontWeight: '800', color: C.navy, letterSpacing: 2 },

  // Week selector — plain View wrapper gives the horizontal ScrollView a
  // measured height; no flex:1 here so it never expands beyond pill content.
  weekStrip: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: C.navyAlpha08,
  },
  weekStripContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: PILL_GAP,
  },
  weekPill: {
    width: PILL_W, height: 32, borderRadius: 16,
    backgroundColor: C.navyAlpha06, alignItems: 'center', justifyContent: 'center',
  },
  weekPillActive: { backgroundColor: C.navy },
  weekPillText: { fontSize: 12, fontWeight: '700', color: C.navyAlpha60 },
  weekPillTextActive: { color: C.white },
  weekPillCurrentDot: {
    position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: 2,
    backgroundColor: C.accent,
  },

  // Main scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12 },

  // Month calendar
  calendar: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1, borderColor: C.navyAlpha08,
    shadowColor: C.navy, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  calMonthTitle: {
    fontSize: 14, fontWeight: '700', color: C.navy,
    letterSpacing: 0.2, marginBottom: 10,
  },
  calRow: { flexDirection: 'row' },
  calCell: { flex: 1, alignItems: 'center', paddingVertical: 3, gap: 3 },
  calDayHeader: { fontSize: 11, fontWeight: '600', color: C.navyAlpha30, marginBottom: 2 },
  calNumWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  calNumToday: { backgroundColor: 'rgba(0,168,232,0.14)' },
  calNumSelected: { backgroundColor: C.navy },
  calNumSelectedToday: { backgroundColor: C.accent },
  calNum: { fontSize: 13, fontWeight: '500', color: C.navy },
  calNumTextToday: { color: C.accent, fontWeight: '700' },
  calNumTextSelected: { color: C.white, fontWeight: '700' },
  calDot: { width: 6, height: 6, borderRadius: 3 },

  // Week header
  weekHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 12,
  },
  weekTitle: { fontSize: 20, fontWeight: '800', color: C.navy, letterSpacing: -0.3 },
  weekCurrentLabel: { fontSize: 13, fontWeight: '600', color: C.accent },
  weekTheme: { fontSize: 12, color: C.navyAlpha60, marginTop: 2 },
  weekDates: { fontSize: 11, color: C.navyAlpha60, marginTop: 3, textAlign: 'right' },

  // Legend
  legend: { flexDirection: 'row', gap: 14, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },
  legendLabel: { fontSize: 11, fontWeight: '600', color: C.navyAlpha60 },

  // Session card
  sessionCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 14, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: C.navyAlpha08,
    shadowColor: C.navy, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    overflow: 'hidden',
  },
  sessionCardToday: { borderColor: C.accent, borderWidth: 1.5 },
  sessionCardSelected: { backgroundColor: C.navyAlpha03 },
  todayBar: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: 3, backgroundColor: C.accent,
    borderTopLeftRadius: 14, borderBottomLeftRadius: 14,
  },

  // Date column
  dateCol: { width: 52, marginLeft: 4 },
  dateDay: {
    fontSize: 11, fontWeight: '700', color: C.navyAlpha60,
    letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 1,
  },
  dateNum: { fontSize: 20, fontWeight: '800', color: C.navy, lineHeight: 22 },
  dateMuted: { color: C.navyAlpha30 },

  // Session info
  sessionInfo: { flex: 1, gap: 4, paddingHorizontal: 10 },
  sessionTitle: { fontSize: 14, fontWeight: '700', color: C.navy, lineHeight: 18 },
  sessionStats: { fontSize: 11, color: C.navyAlpha60 },

  // Category tag
  catTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10, borderWidth: 1,
  },
  catTagSm: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  catTagText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  catTagTextSm: { fontSize: 10 },

  // Rest row
  restRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 14,
    marginBottom: 8, borderRadius: 14,
    backgroundColor: C.navyAlpha06,
  },
  restRowSelected: { backgroundColor: C.navyAlpha12 },
  restLabel: { fontSize: 13, color: C.navyAlpha30, fontStyle: 'italic', marginLeft: 10 },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: C.navyAlpha60 },

  // Session detail
  laneLine: {
    position: 'absolute', left: -10, right: -10,
    height: 1, backgroundColor: '#00A8E8',
  },
  detailNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  detailBackBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.w08, alignItems: 'center', justifyContent: 'center',
  },
  detailNavLabel: { fontSize: 12, fontWeight: '800', color: C.w50, letterSpacing: 2 },
  detailContent: { paddingHorizontal: 22, paddingBottom: 48 },
  detailTitle: {
    fontSize: 26, fontWeight: '800', color: C.white,
    letterSpacing: -0.3, marginTop: 12, marginBottom: 12, lineHeight: 32,
  },
  detailBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    backgroundColor: 'rgba(0,168,232,0.18)',
    borderWidth: 1, borderColor: 'rgba(0,168,232,0.4)',
    marginBottom: 22,
  },
  detailBadgeText: { fontSize: 11, fontWeight: '700', color: '#1BBFFF', letterSpacing: 0.5 },
  detailStats: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  detailStatPill: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailStatVal: { fontSize: 18, fontWeight: '700', color: C.white, lineHeight: 20 },
  detailStatLbl: { fontSize: 10, color: C.w50, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailStatDiv: { width: 1, height: 32, backgroundColor: C.w20, marginHorizontal: 20 },
  detailDivider: { height: 1, backgroundColor: C.w08, marginBottom: 20 },
  detailSets: { gap: 12 },
  detailSetRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  detailSetDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: '#00A8E8', opacity: 0.7, marginTop: 5,
  },
  detailSetLabel: { fontSize: 12, fontWeight: '700', color: C.w80, width: 72, flexShrink: 0 },
  detailSetDetail: { fontSize: 12, color: C.w50, flex: 1, lineHeight: 18 },
});
