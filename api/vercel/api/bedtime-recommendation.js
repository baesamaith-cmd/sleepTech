import { isoDate, getFile, calculateBedtimeRecommendation } from '../lib/utils';

function addCors(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://baesamaith-cmd.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Secret');
}

export default async function handler(req, res) {
  addCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { GITHUB_TOKEN, SLEEP_DATA_REPO } = process.env;
  if (!GITHUB_TOKEN || !SLEEP_DATA_REPO) {
    return res.status(500).json({ error: 'Server configuration missing' });
  }

  const [owner, repo] = SLEEP_DATA_REPO.split('/');
  const now = new Date();
  const today = isoDate(now);
  const yesterday = isoDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));

  const caffeine = req.query.caffeine === 'true';
  const exercise = req.query.exercise === 'true';
  const nap = req.query.nap === 'true';
  const stressOrCondition = req.query.stress || '';

  const todayEveningFromQuery = (caffeine || exercise || nap || stressOrCondition)
    ? { caffeine, exercise, nap, stress_or_condition: stressOrCondition }
    : null;

  try {
    const yesterdayFile = await getFile(owner, repo, `sleep-data/${yesterday}.json`, GITHUB_TOKEN);

    let yesterdayMorning = null;

    if (yesterdayFile?.content) {
      const decoded = JSON.parse(Buffer.from(yesterdayFile.content, 'base64').toString('utf8'));
      yesterdayMorning = decoded?.entries?.morning || null;
    }

    const hasYesterdayMorning = !!yesterdayMorning;
    const recommendation = calculateBedtimeRecommendation(yesterdayMorning, todayEveningFromQuery);
    const uncertaintyNote = '매일 컨디션에 따라 달라질 수 있어요.';

    return res.status(200).json({
      found: !!yesterdayMorning,
      date: today,
      yesterday_date: yesterday,
      has_evening_inputs: !!todayEveningFromQuery,
      show_recommendation: hasYesterdayMorning,
      info_message: hasYesterdayMorning ? null : '취침 추천을 받으려면 조금 더 많은 기록이 필요해요. 오늘도 잊지 않고 기록해 보세요.',
      recommended_bedtime_start: recommendation.recommended_bedtime_start,
      recommended_bedtime_end: recommendation.recommended_bedtime_end,
      bedtime_reason: recommendation.bedtime_reason,
      bedtime_tip: hasYesterdayMorning ? recommendation.bedtime_tip : null,
      uncertainty_note: hasYesterdayMorning ? uncertaintyNote : null
    });
  } catch (error) {
    console.error('Bedtime recommendation error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
