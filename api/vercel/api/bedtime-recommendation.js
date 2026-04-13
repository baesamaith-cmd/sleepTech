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
  let baseBedtimeMinutes = 23.5 * 60;
  let hasValidWakeTime = false;

  if (yesterdayMorning?.wake_time) {
    const wakeMins = parseTime(yesterdayMorning.wake_time);
    baseBedtimeMinutes = wakeMins - (7.5 * 60);
    if (baseBedtimeMinutes < 0) baseBedtimeMinutes += 24 * 60;
    hasValidWakeTime = true;
  }

  let adjustmentMinutes = 0;
  let reason = '';

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

    if (quality <= 2 || awakenings >= 2) {
      adjustmentMinutes = -30;
      reason = '어제 컨디션이 조금 아쉬웠네요. 충분히 쉬는 것이 도움돼요';
    } else if (sleepDurationMinutes > 0 && sleepDurationMinutes < 6 * 60) {
      adjustmentMinutes = -15;
      reason = '어제 수면 시간이 부족했으니 오늘은 일찍 쉬어보세요';
    } else if (sleepDurationMinutes > 0 && sleepDurationMinutes < 7 * 60) {
      adjustmentMinutes = -15;
      reason = '최근 수면이 조금 부족했던 것 같아요';
    }
  }

  if (todayEvening && !reason) {
    const hadNap = todayEvening.nap;
    const hadCaffeine = todayEvening.caffeine;

    if (hadNap || hadCaffeine) {
      if (adjustmentMinutes <= -15) {
        adjustmentMinutes += 15;
        if (adjustmentMinutes > -15) adjustmentMinutes = -15;
      } else {
        adjustmentMinutes = 15;
      }
      reason = hadNap && hadCaffeine 
        ? '낮잠과 카페인 섭취로 인해 조금 늦어도 괜찮아요'
        : hadNap 
          ? '낮잠을 쉬셨으니 조금 늦어도 괜찮아요'
          : '카페인 섭취가 있어서 조금 늦춰도 돼요';
    }
  }

  if (reason === '') {
    if (hasValidWakeTime) {
      reason = '어제 기상 시간을 기준으로 추천드려요';
    } else {
      reason = '평소 패턴을 바탕으로 추천드려요';
    }
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
    bedtime_reason: reason
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
      ...recommendation,
      uncertainty_note: hasYesterdayMorning ? uncertaintyNote : null
    });
  } catch (error) {
    console.error('Bedtime recommendation error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}