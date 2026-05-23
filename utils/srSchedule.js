export const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_TO_IDX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

function normalizeDay(d) {
  if (!d) return '';
  const abbr = d.slice(0, 3);
  return abbr.charAt(0).toUpperCase() + abbr.slice(1).toLowerCase();
}

function resolveSessionCategory(session) {
  if (session.category && ['Base', 'Build', 'Sharpen'].includes(session.category)) return session.category;
  const s = (session.intensity || '').toLowerCase();
  if (s.includes('speed') || s.includes('race') || s.includes('anaerobic')) return 'Sharpen';
  if (s.includes('threshold') || s.includes('endurance') || s.includes('build')) return 'Build';
  return 'Base';
}

function isSafeForStrength(day, swimMap) {
  const idx = ALL_DAYS.indexOf(day);
  if (idx < 0 || swimMap[day]) return false; // must be a non-swim day
  const prevCat = idx > 0 ? swimMap[ALL_DAYS[idx - 1]] : null;
  const nextCat = idx < 6 ? swimMap[ALL_DAYS[idx + 1]] : null;
  if (prevCat === 'Sharpen' || nextCat === 'Sharpen') return false;
  if (prevCat && nextCat) return false; // sandwiched between any two swim days
  return true;
}

function isAdjacentToSharpen(day, swimMap) {
  const idx = ALL_DAYS.indexOf(day);
  if (idx < 0) return true;
  const prevCat = idx > 0 ? swimMap[ALL_DAYS[idx - 1]] : null;
  const nextCat = idx < 6 ? swimMap[ALL_DAYS[idx + 1]] : null;
  return prevCat === 'Sharpen' || nextCat === 'Sharpen';
}

function swimMapForWeek(sessions) {
  return Object.fromEntries(
    (sessions || []).map(s => [normalizeDay(s.day), resolveSessionCategory(s)])
  );
}

// Build the S&R assignment list for a single week.
// Returns [{ day, type }] — day may be a swim day (Recovery/Mobility post-swim).
function scheduleWeek(swimMap, isRecoveryWeek) {
  const swimDays    = ALL_DAYS.filter(d =>  swimMap[d]);
  const nonSwimDays = ALL_DAYS.filter(d => !swimMap[d]);
  const sharpenDays = swimDays.filter(d => swimMap[d] === 'Sharpen');
  const buildDays   = swimDays.filter(d => swimMap[d] === 'Build');
  const baseDays    = swimDays.filter(d => swimMap[d] === 'Base');
  const isHeavyWeek = sharpenDays.length >= 2;

  const usedDays   = new Set();
  const assignments = [];

  function assign(day, type) {
    if (!day || usedDays.has(day)) return;
    assignments.push({ day, type });
    usedDays.add(day);
  }

  function firstUnused(candidates) {
    return candidates.find(d => !usedDays.has(d)) ?? null;
  }

  // Assigns up to `max` strength sessions from `candidates`, skipping days
  // already used or directly adjacent to an already-assigned strength day.
  // Returns the number actually assigned.
  function assignStrength(candidates, max) {
    let count = 0;
    for (const d of candidates) {
      if (count >= max) break;
      if (usedDays.has(d)) continue;
      const dIdx = ALL_DAYS.indexOf(d);
      const adjacentToStrength = assignments.some(
        a => a.type === 'strength' && Math.abs(ALL_DAYS.indexOf(a.day) - dIdx) === 1
      );
      if (!adjacentToStrength) {
        assign(d, 'strength');
        count++;
      }
    }
    return count;
  }

  // Tiered strength candidates (each tier relaxes one constraint):
  //   1. Strict: not adjacent to Sharpen AND not sandwiched between swim days
  //   2. Relaxed: not adjacent to Sharpen (drops sandwiching check)
  //   3. Last resort: any non-swim day
  function strengthCandidates() {
    const strict   = nonSwimDays.filter(d => isSafeForStrength(d, swimMap));
    if (strict.length) return strict;
    const relaxed = nonSwimDays.filter(d => !isAdjacentToSharpen(d, swimMap));
    if (relaxed.length) return relaxed;
    return nonSwimDays;
  }

  // ── Recovery week (weeks 4 / 8 / 12): light load + 1 strength ─────────────
  if (isRecoveryWeek) {
    assign(firstUnused([...baseDays, ...nonSwimDays]), 'mobility');
    assign(firstUnused([...sharpenDays, ...buildDays, ...nonSwimDays]), 'recovery');
    assignStrength(strengthCandidates(), 1);
    return assignments;
  }

  // ── Normal week ─────────────────────────────────────────────────────────────

  // Recovery: post-swim on hard days (biggest benefit).
  assign(firstUnused([...sharpenDays, ...buildDays, ...nonSwimDays]), 'recovery');

  // For heavy weeks (2+ Sharpen), add a second recovery on the other hard day.
  if (isHeavyWeek) {
    assign(firstUnused([...sharpenDays, ...buildDays]), 'recovery');
  }

  // Mobility: best on Base swim days, otherwise a non-Sharpen-adjacent rest day.
  assign(
    firstUnused([
      ...baseDays,
      ...nonSwimDays.filter(d => !isAdjacentToSharpen(d, swimMap)),
      ...nonSwimDays,
    ]),
    'mobility'
  );

  // Strength: up to 2 (or 1 on heavy weeks), never consecutive, at least 1 guaranteed.
  const maxStrength = isHeavyWeek ? 1 : 2;
  const assigned = assignStrength(strengthCandidates(), maxStrength);
  if (assigned === 0) assignStrength(nonSwimDays, 1);

  return assignments;
}

// Build a 12-week S&R schedule, reading each week's actual swim categories
// so Strength never lands next to Sharpen, and Recovery/Mobility co-locate
// with the swim sessions they complement.
export function buildSRWeeks(plan, library) {
  if (!plan?.weeks?.length) return [];

  const weekSwimMaps = plan.weeks.map(w => swimMapForWeek(w.sessions));
  const counters = { strength: 0, mobility: 0, recovery: 0 };

  return Array.from({ length: 12 }, (_, wi) => {
    const isRecoveryWeek = wi === 3 || wi === 7 || wi === 11;
    const swimMap    = weekSwimMaps[wi] ?? weekSwimMaps[0] ?? {};
    const assignments = scheduleWeek(swimMap, isRecoveryWeek);

    const sessions = assignments
      .map(({ day, type }) => {
        const lib = library[type] ?? [];
        if (!lib.length) return null;
        const workout = lib[counters[type] % lib.length];
        counters[type]++;
        return { ...workout, day, sr_category: type };
      })
      .filter(Boolean)
      .sort((a, b) => (DAY_TO_IDX[a.day] ?? 7) - (DAY_TO_IDX[b.day] ?? 7));

    return { week: wi + 1, sessions };
  });
}

// Returns today's S&R session or the next upcoming one, with a whenLabel.
export function getTodayOrNextSR(srWeeks) {
  if (!srWeeks?.length) return null;
  const dow       = new Date().getDay();
  const todayIdx  = dow === 0 ? 6 : dow - 1;
  const todayAbbr = ALL_DAYS[todayIdx];
  const thisWeek  = srWeeks[0]?.sessions ?? [];

  const todaySess = thisWeek.find(s => s.day === todayAbbr);
  if (todaySess) return { ...todaySess, whenLabel: 'Today' };

  const upcoming = thisWeek
    .filter(s => (DAY_TO_IDX[s.day] ?? 0) > todayIdx)
    .sort((a, b) => (DAY_TO_IDX[a.day] ?? 0) - (DAY_TO_IDX[b.day] ?? 0));
  if (upcoming[0]) return { ...upcoming[0], whenLabel: `Next: ${upcoming[0].day}` };

  const nextWeekFirst = srWeeks[1]?.sessions?.[0];
  return nextWeekFirst ? { ...nextWeekFirst, whenLabel: `Next: ${nextWeekFirst.day}` } : null;
}
