function addCors(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://baesamaith-cmd.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function getFile(owner, repo, path, token) {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json'
    }
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to read file: ${error}`);
  }

  return response.json();
}

function isoDate(value) {
  return value.toISOString().split('T')[0];
}

function formatTime(hours, minutes) {
  const h = String(hours).padStart(2, '0');
  const m = String(minutes).padStart(2, '0');
  return `${h}:${m}`;
}

function parseTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function calculateBedtimeRecommendation(yesterdayMorning, todayEvening) {
  const TARGET_WAKE_HOUR = 7;
  const TARGET_WAKE_MINUTE = 0;
  const TARGET_SLEEP_DURATION_HOURS = 7.5;

  let baseBedtimeMinutes = (TARGET_WAKE_HOUR * 60 + TARGET_WAKE_MINUTE) - (TARGET_SLEEP_DURATION_HOURS * 60);
  if (baseBedtimeMinutes < 0) baseBedtimeMinutes += 24 * 60;

  let adjustmentMinutes = 0;
  let reason = '';
  let tip = '';

  if (yesterdayMorning) {
    const quality = yesterdayMorning.sleep_quality || 3;
    const awakenings = yesterdayMorning.awakenings || 0;
    
    let sleepDurationMinutes = 0;
    if (yesterdayMorning.sleep_time && yesterdayMorning.wake_time) {
      const sleepMins = parseTime(yesterdayMorning.sleep_time);
      const wakeMins = parseTime(yesterdayMorning.wake_time);
      sleepDurationMinutes = wakeMins >= sleepMins 
        ? wakeMins - sleepMins 
        : (24 * 60 - sleepMins) + wakeMins;
    }

    const isPoorSleep = quality <= 2 || awakenings >= 2 || sleepDurationMinutes < 6 * 60;

    if (isPoorSleep) {
      if (quality <= 2) {
        adjustmentMinutes = -30;
        reason = '어제 수면 질이 낮아 충분히 쉬어주는 것이 좋겠습니다';
        tip = '컨디션에 따라 조기 취침도 괜찮아요';
      } else if (awakenings >= 2) {
        adjustmentMinutes = -30;
        reason = '어제 각성이 잦았으니 더 일찍 쉬는 것이 도움됩니다';
        tip = '오늘은 충분히 휴식해 보세요';
      } else if (sleepDurationMinutes < 6 * 60) {
        adjustmentMinutes = -15;
        reason = '어제 수면 시간이 짧았으니 충분히 취침해 보세요';
        tip = '오늘은 일찍 쉬는 것을 추천드려요';
      }
    }

    if (reason === '' && yesterdayMorning.sleep_time) {
      const avgSleep = 7.5 * 60;
      if (sleepDurationMinutes < avgSleep - 30) {
        adjustmentMinutes = -15;
        reason = '최근 수면 시간이 다소 부족합니다';
        tip = '조금 더 일찍 취침해 보세요';
      }
    }
  }

  if (todayEvening) {
    const hadNap = todayEvening.nap;
    const hadCaffeine = todayEvening.caffeine;

    if ((hadNap || hadCaffeine) && adjustmentMinutes >= -15) {
      adjustmentMinutes += 15;
      if (!reason) {
        reason = hadNap && hadCaffeine 
          ? '낮잠과 카페인 섭취로 인해 조금 늦어져도 괜찮아요'
          : hadNap 
            ? '낮잠을 쉬셨으니 조금 늦어도 괜찮아요'
            : '카페인 섭취가 있으므로 조금 늦춰도 됩니다';
        tip = '컨디션을 보면서 조금씩 조정해도 괜찮아요';
      }
    }
  }

  if (reason === '') {
    reason = '최근 기록을 기준으로한 초기 추천입니다';
    tip = '컨디션에 따라 조정해도 괜찮아요';
  }

  const finalBedtimeStartMinutes = baseBedtimeMinutes + adjustmentMinutes;
  const finalBedtimeEndMinutes = finalBedtimeStartMinutes + 30;

  const startH = Math.floor(((finalBedtimeStartMinutes % (24 * 60)) + (24 * 60)) % (24 * 60) / 60);
  const startM = ((finalBedtimeStartMinutes % (24 * 60)) + (24 * 60)) % (24 * 60) % 60;
  const endH = Math.floor(((finalBedtimeEndMinutes % (24 * 60)) + (24 * 60)) % (24 * 60) / 60);
  const endM = ((finalBedtimeEndMinutes % (24 * 60)) + (24 * 60)) % (24 * 60) % 60;

  return {
    recommended_bedtime_start: formatTime(startH, startM),
    recommended_bedtime_end: formatTime(endH, endM),
    bedtime_reason: reason,
    bedtime_tip: tip,
    confidence_note: '추천은 최근 기록을 기반으로 합니다'
  };
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

    const recommendation = calculateBedtimeRecommendation(yesterdayMorning, todayEveningFromQuery);

    return res.status(200).json({
      found: !!yesterdayMorning,
      date: today,
      yesterday_date: yesterday,
      has_evening_inputs: !!todayEveningFromQuery,
      ...recommendation
    });
  } catch (error) {
    console.error('Bedtime recommendation error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}