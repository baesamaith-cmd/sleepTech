// Vercel Function - Sleep Log API
// Stores sleep data in private GitHub repo via Contents API

function validateMorning(data) {
  const errors = [];
  if (!/^\d{2}:\d{2}$/.test(data.sleep_time || '')) errors.push('sleep_time must be HH:MM');
  if (!/^\d{2}:\d{2}$/.test(data.wake_time || '')) errors.push('wake_time must be HH:MM');
  if (!Number.isInteger(data.sleep_quality) || data.sleep_quality < 1 || data.sleep_quality > 5) {
    errors.push('sleep_quality must be an integer between 1 and 5');
  }
  if (!Number.isInteger(data.awakenings) || data.awakenings < 0) {
    errors.push('awakenings must be a non-negative integer');
  }
  return errors;
}

function validateEvening(data) {
  const errors = [];
  for (const field of ['caffeine', 'exercise', 'nap']) {
    if (typeof data[field] !== 'boolean') errors.push(`${field} must be boolean`);
  }
  if (data.expected_bedtime && !/^\d{2}:\d{2}$/.test(data.expected_bedtime)) {
    errors.push('expected_bedtime must be HH:MM');
  }
  return errors;
}

async function getExistingFile(owner, repo, path, token) {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json'
    }
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to read existing file: ${error}`);
  }

  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { GITHUB_TOKEN, SLEEP_DATA_REPO, GITHUB_DATA_BRANCH = 'main' } = process.env;
  if (!GITHUB_TOKEN || !SLEEP_DATA_REPO) {
    return res.status(500).json({ error: 'Server configuration missing' });
  }

  const data = req.body || {};
  const { date, type, submitted_at } = data;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }
  if (!['morning', 'evening'].includes(type)) {
    return res.status(400).json({ error: 'type must be morning or evening' });
  }
  if (!submitted_at) {
    return res.status(400).json({ error: 'submitted_at is required' });
  }

  const validationErrors = type === 'morning' ? validateMorning(data) : validateEvening(data);
  if (validationErrors.length > 0) {
    return res.status(400).json({ error: validationErrors.join('; ') });
  }

  const [owner, repo] = SLEEP_DATA_REPO.split('/');
  if (!owner || !repo) {
    return res.status(500).json({ error: 'SLEEP_DATA_REPO must be owner/repo' });
  }

  const filePath = `sleep-data/${date}.json`;

  try {
    const existingFile = await getExistingFile(owner, repo, filePath, GITHUB_TOKEN);
    let dayDocument = {
      date,
      entries: {},
      metadata: {
        last_updated_at: submitted_at,
        source: 'sleeptech-mvp'
      }
    };

    if (existingFile?.content) {
      const decoded = Buffer.from(existingFile.content, 'base64').toString('utf8');
      dayDocument = JSON.parse(decoded);
    }

    dayDocument.date = date;
    dayDocument.entries = dayDocument.entries || {};
    dayDocument.entries[type] = {
      ...data,
      type,
      date
    };
    dayDocument.metadata = {
      ...(dayDocument.metadata || {}),
      last_updated_at: submitted_at,
      source: 'sleeptech-mvp'
    };

    const putBody = {
      message: `sleep-log: update ${date} ${type}`,
      content: Buffer.from(JSON.stringify(dayDocument, null, 2)).toString('base64'),
      branch: GITHUB_DATA_BRANCH
    };

    if (existingFile?.sha) putBody.sha = existingFile.sha;

    const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(putBody)
    });

    if (!putRes.ok) {
      const error = await putRes.text();
      throw new Error(`Failed to save to GitHub: ${error}`);
    }

    return res.status(200).json({
      success: true,
      message: `${type} log saved for ${date}`,
      path: filePath
    });
  } catch (error) {
    console.error('Sleep log error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
