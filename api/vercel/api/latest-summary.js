import { isoDate, getFile } from '../lib/utils';
import { formatMorningSummary, formatEveningSummary } from '../lib/formatters';

function addCors(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://baesamaith-cmd.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Secret');
}

export default async function handler(req, res) {
  addCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  if (req.headers['x-app-secret'] !== process.env.APP_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { GITHUB_TOKEN, SLEEP_DATA_REPO } = process.env;
  if (!GITHUB_TOKEN || !SLEEP_DATA_REPO) {
    return res.status(500).json({ error: 'Server configuration missing' });
  }

  const target = req.query?.for;
  if (!['morning', 'evening'].includes(target)) {
    return res.status(400).json({ error: 'for must be morning or evening' });
  }

  const [owner, repo] = SLEEP_DATA_REPO.split('/');
  const now = new Date();
  
  // Helper to fetch and parse file
  async function fetchEntry(date) {
    try {
      const file = await getFile(owner, repo, `sleep-data/${isoDate(date)}.json`, GITHUB_TOKEN);
      if (!file?.content) return null;
      return JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
    } catch {
      return null;
    }
  }

  try {
    if (target === 'evening') {
      // Preference: Today morning
      const today = new Date(now);
      const doc = await fetchEntry(today);
      const morning = doc?.entries?.morning;
      
      if (morning) {
        return res.status(200).json({
          found: true,
          kind: 'morning',
          date: isoDate(today),
          summary: formatMorningSummary(morning),
          entry: morning
        });
      }
      
      // Fallback: Yesterday morning
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayDoc = await fetchEntry(yesterday);
      const yesterdayMorning = yesterdayDoc?.entries?.morning;
      
      if (yesterdayMorning) {
        return res.status(200).json({
          found: true,
          kind: 'morning',
          date: isoDate(yesterday),
          summary: `어제 아침 기록을 바탕으로 오늘을 돌아볼게요: ${formatMorningSummary(yesterdayMorning).split(': ')[1] || formatMorningSummary(yesterdayMorning)}`,
          entry: yesterdayMorning
        });
      }

      return res.status(200).json({ found: false });
    }

    // Target: morning (Preference: Yesterday evening)
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const doc = await fetchEntry(yesterday);
    const evening = doc?.entries?.evening;
    
    if (evening) {
      return res.status(200).json({
        found: true,
        kind: 'evening',
        date: isoDate(yesterday),
        summary: formatEveningSummary(evening),
        entry: evening
      });
    }

    // Fallback: Day before yesterday evening
    const dayBefore = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const dayBeforeDoc = await fetchEntry(dayBefore);
    const dayBeforeEvening = dayBeforeDoc?.entries?.evening;

    if (dayBeforeEvening) {
      return res.status(200).json({
        found: true,
        kind: 'evening',
        date: isoDate(dayBefore),
        summary: `최근 기록된 저녁 일지 내용을 확인했어요: ${formatEveningSummary(dayBeforeEvening).split(': ')[1] || formatEveningSummary(dayBeforeEvening)}`,
        entry: dayBeforeEvening
      });
    }

    return res.status(200).json({ found: false });
  } catch (error) {
    console.error('Latest summary error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
