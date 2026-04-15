function isTime(value) {
  return /^\d{2}:\d{2}$/.test(value || '');
}

function isBlank(value) {
  return value === undefined || value === null || value === '';
}

function validateScale(value, field) {
  return Number.isInteger(value) && value >= 1 && value <= 5 ? null : `${field} must be an integer between 1 and 5`;
}

function validateMorning(data) {
  const errors = [];
  for (const field of ['time_in_bed', 'lights_out_time', 'final_wake_time', 'out_of_bed_time']) {
    if (!isBlank(data[field]) && !isTime(data[field])) errors.push(`${field} must be HH:MM`);
  }

  if (!isBlank(data.sleep_onset_latency) && (!Number.isInteger(data.sleep_onset_latency) || data.sleep_onset_latency < 0)) {
    errors.push('sleep_onset_latency must be a non-negative integer');
  }
  if (!isBlank(data.awakenings) && (!Number.isInteger(data.awakenings) || data.awakenings < 0)) {
    errors.push('awakenings must be a non-negative integer');
  }
  if (!isBlank(data.total_awake_time) && (!Number.isInteger(data.total_awake_time) || data.total_awake_time < 0)) {
    errors.push('total_awake_time must be a non-negative integer');
  }

  if (!isBlank(data.estimated_total_sleep_time) && (typeof data.estimated_total_sleep_time !== 'number' || data.estimated_total_sleep_time < 0)) {
    errors.push('estimated_total_sleep_time must be a non-negative number');
  }

  if (!isBlank(data.sleep_quality)) {
    const error = validateScale(data.sleep_quality, 'sleep_quality');
    if (error) errors.push(error);
  }
  if (!isBlank(data.morning_energy)) {
    const error = validateScale(data.morning_energy, 'morning_energy');
    if (error) errors.push(error);
  }
  if (!isBlank(data.daytime_sleepiness)) {
    const error = validateScale(data.daytime_sleepiness, 'daytime_sleepiness');
    if (error) errors.push(error);
  }

  return errors;
}

function validateEvening(data) {
  const errors = [];
  for (const field of ['caffeine', 'alcohol', 'nap', 'exercise']) {
    if (typeof data[field] !== 'boolean') errors.push(`${field} must be boolean`);
  }

  if (data.expected_bedtime && !isTime(data.expected_bedtime)) {
    errors.push('expected_bedtime must be HH:MM');
  }

  if (!['none', 'light', 'moderate', 'high'].includes(data.caffeine_amount || '')) {
    errors.push('caffeine_amount must be none, light, moderate, or high');
  }

  if (!['none', 'light', 'moderate', 'high'].includes(data.alcohol_amount || '')) {
    errors.push('alcohol_amount must be none, light, moderate, or high');
  }

  if (!Number.isInteger(data.nap_duration) || data.nap_duration < 0) {
    errors.push('nap_duration must be a non-negative integer');
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
  res.setHeader('Access-Control-Allow-Origin', 'https://baesamaith-cmd.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Secret');

  if (req.method === 'OPTIONS') return res.status(200).end();
  
  if (req.headers['x-app-secret'] !== process.env.APP_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { GITHUB_TOKEN, SLEEP_DATA_REPO, GITHUB_DATA_BRANCH = 'main' } = process.env;
  if (!GITHUB_TOKEN || !SLEEP_DATA_REPO) {
    return res.status(500).json({ error: 'Server configuration missing' });
  }

  const data = req.body || {};
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
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
