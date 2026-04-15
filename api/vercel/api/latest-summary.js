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
  const today = isoDate(now);
  const yesterday = isoDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));

  try {
    if (target === 'evening') {
      const file = await getFile(owner, repo, `sleep-data/${today}.json`, GITHUB_TOKEN);
      if (!file?.content) return res.status(200).json({ found: false });
      const decoded = Buffer.from(file.content, 'base64').toString('utf8');
      const doc = JSON.parse(decoded);
      const morning = doc?.entries?.morning;
      if (!morning) return res.status(200).json({ found: false });

      return res.status(200).json({
        found: true,
        kind: 'morning',
        date: today,
        summary: formatMorningSummary(morning),
        entry: morning
      });
    }

    const file = await getFile(owner, repo, `sleep-data/${yesterday}.json`, GITHUB_TOKEN);
    if (!file?.content) return res.status(200).json({ found: false });
    const decoded = Buffer.from(file.content, 'base64').toString('utf8');
    const doc = JSON.parse(decoded);
    const evening = doc?.entries?.evening;
    if (!evening) return res.status(200).json({ found: false });

    return res.status(200).json({
      found: true,
      kind: 'evening',
      date: yesterday,
      summary: formatEveningSummary(evening),
      entry: evening
    });
  } catch (error) {
    console.error('Latest summary error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
