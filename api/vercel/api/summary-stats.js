function addCors(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://baesamaith-cmd.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  addCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { GITHUB_TOKEN, SLEEP_DATA_REPO } = process.env;
  if (!GITHUB_TOKEN || !SLEEP_DATA_REPO) {
    return res.status(500).json({ error: 'Config missing' });
  }

  const [owner, repo] = SLEEP_DATA_REPO.split('/');
  
  try {
    // Fetch files from the last 7 days (simplified for now to just list files)
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/sleep-data`, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
    });
    
    if (!response.ok) throw new Error('Failed to fetch data');
    const files = await response.json();
    
    // Get last 7 days of filenames
    const now = new Date();
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      return `${d.toISOString().split('T')[0]}.json`;
    });

    const dataPromises = files
      .filter(f => last7Days.includes(f.name))
      .map(async (f) => {
        const fileRes = await fetch(f.download_url, { headers: { Authorization: `Bearer ${GITHUB_TOKEN}` } });
        return fileRes.json();
      });

    const results = await Promise.all(dataPromises);
    
    // Calculate stats
    let totalSleep = 0;
    let sleepCount = 0;
    let totalQuality = 0;
    let qualityCount = 0;
    let totalBed = 0; // Assuming bed_time or time_in_bed
    let bedCount = 0;
    let totalEfficiency = 0; // Based on quality * 20 (simple approximation)
    let efficiencyCount = 0;

    results.forEach(day => {
      const morning = day.entries?.morning;
      if (morning) {
        if (morning.total_sleep_time) {
          totalSleep += morning.total_sleep_time;
          sleepCount++;
        }
        if (morning.sleep_quality) {
          totalQuality += morning.sleep_quality;
          qualityCount++;
          totalEfficiency += (morning.sleep_quality * 20);
          efficiencyCount++;
        }
      }
    });

    res.status(200).json({
      avgSleep: sleepCount > 0 ? (totalSleep / sleepCount).toFixed(1) : null,
      avgQuality: qualityCount > 0 ? (totalQuality / qualityCount).toFixed(1) : null,
      avgEfficiency: efficiencyCount > 0 ? (totalEfficiency / efficiencyCount).toFixed(0) : null,
      count: sleepCount
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
