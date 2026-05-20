import Anthropic from '@anthropic-ai/sdk';

const GOALS = [
  'Improve general fitness',
  'Cross-train or complement another sport',
  'Get back into swimming after a break',
  'Get faster at a stroke or distance',
  'Train for an event, gala or competition',
  'Train for a triathlon',
];
const TRAINING_DAYS = ['1–2 days per week', '3–4 days per week', '5–7 days per week'];
const SESSION_LENGTHS = ['15 minutes', '30 minutes', '45 minutes', '60 minutes', '90 minutes', '120+ minutes'];
const POOL_LENGTHS = ['25m pool (short course)', '50m pool (long course / Olympic)', 'Both 25m and 50m'];
const CONTINUOUS_DISTANCES = ['25m', '50m', '100m', '200m', '400m', '800m+'];
const LEVELS = ['Casual', 'Fitness', 'Club', 'Competitive', 'Former competitive'];

function formatProfile(answers) {
  const dob = answers.dob
    ? `${answers.dob.day}/${answers.dob.month}/${answers.dob.year}`
    : 'not provided';

  const eventDate = answers.event_date
    ? `${answers.event_date.month}/${answers.event_date.year}`
    : null;

  const strokes = answers.strokes
    ? Object.entries(answers.strokes)
        .filter(([, dists]) => dists.length > 0)
        .map(([stroke, dists]) => `${stroke}: ${dists.join(', ')}`)
        .join('; ')
    : 'not specified';

  let timesText = 'none — estimate paces';
  if (answers.has_times === 0 && answers.event_times) {
    const times = [];
    for (const [stroke, dists] of Object.entries(answers.event_times)) {
      for (const [dist, time] of Object.entries(dists)) {
        if (time && time.trim()) times.push(`${stroke} ${dist}: ${time.trim()}`);
      }
    }
    timesText = times.length > 0 ? times.join(', ') : 'none entered — estimate paces';
  }

  return [
    `Name: ${answers.name}`,
    `Date of birth: ${dob}`,
    `Goal: ${GOALS[answers.goal] || 'not specified'}`,
    eventDate ? `Event date: ${eventDate}` : null,
    `Training frequency: ${TRAINING_DAYS[answers.training_days] || 'not specified'}`,
    `Swim days: ${(answers.swim_days || []).join(', ')}`,
    `Session length: ${SESSION_LENGTHS[answers.session_length] || 'not specified'}`,
    `Pool: ${POOL_LENGTHS[answers.pool_length] || 'not specified'}`,
    `Equipment: ${(answers.equipment || []).join(', ') || 'none'}`,
    `Can swim continuously: ${CONTINUOUS_DISTANCES[answers.continuous_distance] || 'not specified'}`,
    `Level: ${LEVELS[answers.level] || 'not specified'}`,
    `Strokes & distances: ${strokes}`,
    `Recent times: ${timesText}`,
  ]
    .filter(Boolean)
    .join('\n');
}

const SYSTEM_PROMPT = `You are an expert swimming coach. Generate a personalised 12-week training plan as JSON.

Return ONLY valid JSON — no markdown fences, no explanation, no text before or after.

Required structure:
{
  "weeks": [
    {
      "week": 1,
      "theme": "Foundation",
      "sessions": [
        {
          "day": "Mon",
          "title": "Easy Aerobic",
          "category": "Base",
          "intensity": "Easy",
          "distance": "2000m",
          "duration": "40 min",
          "sets": [
            { "label": "Warm-up",   "detail": "400m easy FR" },
            { "label": "Pre-set",   "detail": "4×50m kick @2:00" },
            { "label": "Main set",  "detail": "8×100m @ CSS+5s :20 rest" },
            { "label": "Cool-down", "detail": "200m easy choice" }
          ]
        }
      ]
    }
  ]
}

Rules:
- Include exactly 12 weeks.
- Sessions must only fall on the swimmer's stated swim days.
- Each session must include "category": one of "Base", "Build", or "Sharpen":
  - "Base": aerobic base building, recovery, and technique-focused sessions
  - "Build": threshold, endurance, stroke-specific, kick/pull, and drill sessions
  - "Sharpen": speed, anaerobic capacity, and race-pace sessions
- Use proper swimming notation: e.g. "6×100m @ 1:45, :20 rest" or "4×50m FR kick @2:00".
- Keep each "detail" string under 55 characters.
- Progress volume and intensity across 12 weeks; weeks 4, 8, and 12 are recovery weeks.
- Always include Warm-up and Cool-down sets.
- Scale distances to fit within the stated session length.`;

export async function generatePlan(answers) {
  const client = new Anthropic({
    apiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY,
    dangerouslyAllowBrowser: true,
    timeout: 180000,
  });

  const profileText = formatProfile(answers);

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Generate a 12-week training plan for this swimmer:\n\n${profileText}`,
      },
    ],
  });

  const message = await stream.finalMessage();
  const raw = message.content[0]?.text ?? '';

  // Strip accidental markdown fencing the model sometimes adds
  const jsonStr = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  const parsed = JSON.parse(jsonStr);
  // The model occasionally wraps the response in a top-level key like { "plan": { "weeks": [...] } }
  if (Array.isArray(parsed.weeks)) return parsed;
  const nested = Object.values(parsed).find((v) => v && Array.isArray(v.weeks));
  return nested ?? parsed;
}
