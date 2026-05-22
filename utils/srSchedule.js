export const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_TO_IDX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

function normalizeDay(d) {
  if (!d) return '';
  const abbr = d.slice(0, 3);
  return abbr.charAt(0).toUpperCase() + abbr.slice(1).toLowerCase();
}

// Distributes S&R sessions across non-swim days.
// 4+ available days → 2 strength, 1 mobility, 1 recovery spread evenly.
// Recovery weeks (4, 8, 12) swap strength sessions for recovery.
export function buildSRWeeks(plan, library) {
  const swimDays = new Set(
    (plan?.weeks?.[0]?.sessions ?? []).map(s => normalizeDay(s.day))
  );
  const availDays = ALL_DAYS.filter(d => !swimDays.has(d));
  if (!availDays.length) return [];

  const n = availDays.length;
  let template;
  if (n === 1) {
    template = [{ day: availDays[0], type: 'strength' }];
  } else if (n === 2) {
    template = [
      { day: availDays[0], type: 'strength' },
      { day: availDays[1], type: 'recovery' },
    ];
  } else if (n === 3) {
    template = [
      { day: availDays[0], type: 'strength' },
      { day: availDays[1], type: 'mobility' },
      { day: availDays[2], type: 'recovery' },
    ];
  } else {
    const step = Math.max(1, Math.floor(n / 4));
    template = [
      { day: availDays[0],                          type: 'strength' },
      { day: availDays[Math.min(step, n - 1)],      type: 'strength' },
      { day: availDays[Math.min(step * 2, n - 1)],  type: 'mobility' },
      { day: availDays[n - 1],                       type: 'recovery' },
    ];
  }

  return Array.from({ length: 12 }, (_, wi) => {
    const isRecoveryWeek = wi === 3 || wi === 7 || wi === 11;
    const sessions = template.map(({ day, type }) => {
      const effectiveType = isRecoveryWeek && type === 'strength' ? 'recovery' : type;
      const lib = library[effectiveType] ?? [];
      if (!lib.length) return null;
      return { ...lib[wi % lib.length], day, sr_category: effectiveType };
    }).filter(Boolean);
    return { week: wi + 1, sessions };
  });
}

// Returns today's session or the next upcoming one, with a 'whenLabel'.
export function getTodayOrNextSR(srWeeks) {
  if (!srWeeks?.length) return null;
  const dow = new Date().getDay(); // 0=Sun … 6=Sat
  const todayIdx = dow === 0 ? 6 : dow - 1; // Mon=0 … Sun=6
  const todayAbbr = ALL_DAYS[todayIdx];
  const thisWeek = srWeeks[0]?.sessions ?? [];

  const todaySess = thisWeek.find(s => s.day === todayAbbr);
  if (todaySess) return { ...todaySess, whenLabel: 'Today' };

  const upcoming = thisWeek
    .filter(s => (DAY_TO_IDX[s.day] ?? 0) > todayIdx)
    .sort((a, b) => (DAY_TO_IDX[a.day] ?? 0) - (DAY_TO_IDX[b.day] ?? 0));
  if (upcoming[0]) return { ...upcoming[0], whenLabel: `Next: ${upcoming[0].day}` };

  const nextWeekFirst = srWeeks[1]?.sessions?.[0];
  return nextWeekFirst ? { ...nextWeekFirst, whenLabel: `Next: ${nextWeekFirst.day}` } : null;
}
