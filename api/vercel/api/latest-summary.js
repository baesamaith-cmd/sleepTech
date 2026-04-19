import { isoDate, getFile } from '../lib/utils';
import { formatMorningSummary, formatEveningSummary } from '../lib/formatters';
import { analyzeRecentData } from '../lib/analytics';

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
    const window = 7;
    const fetchRecent = async (targetType) => {
      const points = [];
      for (let i = 0; i < window; i++) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const doc = await fetchEntry(d);
        if (doc?.entries?.[targetType]) points.push(doc.entries[targetType]);
      }
      return points;
    };

    if (target === 'evening') {
      const morningPoints = await fetchRecent('morning');
      const analysis = analyzeRecentData(morningPoints, 'morning');
      
      if (analysis.summary) {
        return res.status(200).json({
          found: true,
          kind: 'morning',
          summary: analysis.confidence === 'low' ? `기록을 조금씩 채워보세요. ${analysis.summary}` : analysis.summary,
          confidence: analysis.confidence
        });
      }
      return res.status(200).json({ found: false });
    }

    const eveningPoints = await fetchRecent('evening');
    const analysis = analyzeRecentData(eveningPoints, 'evening');
    
    if (analysis.summary) {
      return res.status(200).json({
        found: true,
        kind: 'evening',
        summary: analysis.confidence === 'low' ? `기록을 조금씩 채워보세요. ${analysis.summary}` : analysis.summary,
        confidence: analysis.confidence
      });
    }

    return res.status(200).json({ found: false });
  } catch (error) {
    console.error('Latest summary error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
