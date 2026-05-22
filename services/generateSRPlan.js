import Anthropic from '@anthropic-ai/sdk';

const LEVELS        = ['Casual', 'Fitness', 'Club', 'Competitive', 'Former competitive'];
const GOALS         = ['Improve general fitness', 'Cross-train or complement another sport', 'Get back into swimming after a break', 'Get faster at a stroke or distance', 'Train for an event, gala or competition', 'Train for a triathlon'];
const SESSION_LENGTHS = ['15 min', '30 min', '45 min', '60 min', '90 min', '120+ min'];

const SYSTEM = `You are an expert sports conditioning coach creating swimmer-specific strength and recovery workouts.

Return ONLY valid JSON — no markdown fences, no explanation.

Required structure:
{
  "strength": [
    {
      "id": "str_1",
      "title": "Upper Body Power",
      "muscle_group": "Upper Body",
      "duration": "35 min",
      "equipment": "Dumbbells",
      "sets": [
        { "label": "Warm-up",   "detail": "5 min band pull-aparts, arm circles" },
        { "label": "Main set",  "detail": "3×10 DB rows, 3×8 overhead press" },
        { "label": "Core",      "detail": "3×15 plank rotations, 2×20 dead bugs" },
        { "label": "Cool-down", "detail": "5 min static upper body stretch" }
      ]
    }
  ],
  "mobility": [...],
  "recovery": [...]
}

Rules:
- strength: exactly 6 workouts. muscle_group one of: "Upper Body", "Lower Body", "Core", "Full Body", "Pull Focus", "Push Focus"
- mobility: exactly 4 workouts. focus_area one of: "Hips & Glutes", "Shoulders & Thoracic", "Full Body Flow", "Hip Flexors & Quads"
- recovery: exactly 4 workouts. body_area one of: "Lower Body", "Upper Body", "Full Body", "Back & Hips"
- Each workout has exactly 4 sets with a label and detail. detail must be under 55 characters.
- Focus on swimmer-specific needs: shoulder stability, hip flexor length, ankle mobility, rotational core
- Strength workouts should use minimal equipment (bodyweight, dumbbells, or resistance bands)
- Scale intensity and duration to the swimmer's level and available session time`;

export async function generateSRPlan(meta) {
  const client = new Anthropic({
    apiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY,
    dangerouslyAllowBrowser: true,
    timeout: 60_000,
  });

  const prompt = [
    `Level: ${LEVELS[meta?.level] ?? 'Fitness'}`,
    `Goal: ${GOALS[meta?.goal] ?? 'Improve general fitness'}`,
    `Session length: ${SESSION_LENGTHS[meta?.session_length] ?? '45 min'}`,
  ].join('\n');

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 6000,
    system: SYSTEM,
    messages: [{ role: 'user', content: `Generate the S&R library for:\n\n${prompt}` }],
  });

  const raw = response.content[0]?.text ?? '';
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  return JSON.parse(jsonStr);
}
