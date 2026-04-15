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

  const { GITHUB_TOKEN, SLEEP_DATA_REPO, GITHUB_DATA_BRANCH = 'main' } = process.env;
  if (!GITHUB_TOKEN || !SLEEP_DATA_REPO) {
    return res.status(500).json({ error: 'Server configuration missing' });
  }

  const [owner, repo] = SLEEP_DATA_REPO.split('/');

  try {
    const records = await fetchRecentFiles(owner, repo, GITHUB_TOKEN, 7);
    const analysis = analyzePatterns(records);
    const coaching = generateCoaching(analysis);

    return res.status(200).json({
      success: true,
      ...coaching
    });
  } catch (error) {
    console.error('Pattern insights error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}