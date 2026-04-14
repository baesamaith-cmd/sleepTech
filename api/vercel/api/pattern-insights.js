function addCors(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://baesamaith-cmd.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function isoDate(date) {
  return date.toISOString().split('T')[0];
}

function parseTime(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function calculateDuration(sleepTime, wakeTime) {
  if (!sleepTime || !wakeTime) return null;
  const sleepMins = parseTime(sleepTime);
  const wakeMins = parseTime(wakeTime);
  if (wakeMins >= sleepMins) return wakeMins - sleepMins;
  return (24 * 60 - sleepMins) + wakeMins;
}

function getMean(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function getStd(arr) {
  if (arr.length < 2) return null;
  const mean = getMean(arr);
  const squaredDiffs = arr.map(x => Math.pow(x - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / arr.length);
}

function getCorrelation(arr1, arr2) {
  if (arr1.length !== arr2.length || arr1.length < 3) return null;
  const mean1 = getMean(arr1);
  const mean2 = getMean(arr2);
  const std1 = getStd(arr1);
  const std2 = getStd(arr2);
  if (!std1 || !std2) return null;
  
  let sum = 0;
  for (let i = 0; i < arr1.length; i++) {
    sum += ((arr1[i] - mean1) / std1) * ((arr2[i] - mean2) / std2);
  }
  return sum / (arr1.length - 1);
}

async function fetchRecentFiles(owner, repo, token, days = 7) {
  const records = [];
  const now = new Date();
  
  for (let i = 1; i <= days; i++) {
    const date = isoDate(new Date(now.getTime() - i * 24 * 60 * 60 * 1000));
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/sleep-data/${date}.json`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json'
          }
        }
      );
      
      if (response.status === 404) continue;
      if (!response.ok) throw new Error(`Failed to fetch ${date}`);
      
      const data = await response.json();
      const decoded = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
      records.push({ date, ...decoded });
    } catch {
      continue;
    }
  }
  
  return records;
}

function analyzePatterns(records) {
  const bedtimeMinutes = [];
  const sleepDurations = [];
  const qualities = [];
  const caffeineDays = [];
  const napDays = [];
  
  const bedtimeMins = [];
  const qualityWithCaffeine = { with: [], without: [] };
  const qualityWithNap = { with: [], without: [] };
  const bedtimeWithCaffeine = { with: [], without: [] };
  const bedtimeWithNap = { with: [], without: [] };
  
  for (const rec of records) {
    const morning = rec.entries?.morning;
    const evening = rec.entries?.evening;
    
    if (morning?.sleep_time) {
      const mins = parseTime(morning.sleep_time);
      bedtimeMins.push(mins);
      bedtimeMinutes.push(mins);
    }
    
    if (morning?.sleep_time && morning?.wake_time) {
      const dur = calculateDuration(morning.sleep_time, morning.wake_time);
      if (dur) {
        sleepDurations.push(dur);
        if (evening) {
          if (evening.caffeine) qualityWithCaffeine.with.push(morning.sleep_quality || 3);
          else qualityWithCaffeine.without.push(morning.sleep_quality || 3);
          
          if (evening.caffeine) bedtimeWithCaffeine.with.push(parseTime(morning.sleep_time));
          else bedtimeWithCaffeine.without.push(parseTime(morning.sleep_time));
        }
      }
    }
    
    if (morning?.sleep_quality) {
      qualities.push(morning.sleep_quality);
      if (evening) {
        if (evening.nap) qualityWithNap.with.push(morning.sleep_quality);
        else qualityWithNap.without.push(morning.sleep_quality);
        
        if (evening.nap) bedtimeWithNap.with.push(parseTime(morning.sleep_time));
        else bedtimeWithNap.without.push(parseTime(morning.sleep_time));
      }
    }
    
    if (evening) {
      if (evening.caffeine) caffeineDays.push(rec.date);
      if (evening.nap) napDays.push(rec.date);
    }
  }
  
  const avgBedtimeMins = getMean(bedtimeMinutes);
  const bedtimeStd = getStd(bedtimeMinutes);
  const avgDuration = getMean(sleepDurations);
  const avgQuality = getMean(qualities);
  
  const qualityCaffeineCorr = qualityWithCaffeine.with.length >= 2 && qualityWithCaffeine.without.length >= 2
    ? getMean(qualityWithCaffeine.with) - getMean(qualityWithCaffeine.without)
    : 0;
  
  const qualityNapCorr = qualityWithNap.with.length >= 2 && qualityWithNap.without.length >= 2
    ? getMean(qualityWithNap.with) - getMean(qualityWithNap.without)
    : 0;
  
  const bedtimeCaffeineCorr = bedtimeWithCaffeine.with.length >= 2 && bedtimeWithCaffeine.without.length >= 2
    ? getMean(bedtimeWithCaffeine.with) - getMean(bedtimeWithCaffeine.without)
    : 0;
  
  const bedtimeNapCorr = bedtimeWithNap.with.length >= 2 && bedtimeWithNap.without.length >= 2
    ? getMean(bedtimeWithNap.with) - getMean(bedtimeWithNap.without)
    : 0;
  
  return {
    recordCount: records.length,
    avgBedtimeMins,
    bedtimeStd,
    avgDuration,
    avgQuality,
    qualityCaffeineCorr,
    qualityNapCorr,
    bedtimeCaffeineCorr,
    bedtimeNapCorr,
    caffeineDayCount: caffeineDays.length,
    napDayCount: napDays.length
  };
}

function formatBedtime(mins) {
  if (mins === null) return null;
  const normalizedMins = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalizedMins / 60);
  const m = normalizedMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function generateCoaching(analysis) {
  const {
    recordCount,
    avgBedtimeMins,
    bedtimeStd,
    avgDuration,
    avgQuality,
    qualityCaffeineCorr,
    qualityNapCorr,
    bedtimeCaffeineCorr,
    bedtimeNapCorr,
    caffeineDayCount,
    napDayCount
  } = analysis;
  
  if (recordCount < 3) {
    return {
      status: 'building',
      headline: '기록을 모으는 중',
      insight: `현재 ${recordCount}일치 기록이 있네요. ${3 - recordCount}일 더 모으면 패턴을 볼 수 있어요.`,
      recommendation: '오늘도 아침, 저녁 기록을 이어서 남겨보세요.',
      today_action: '아침 또는 저녁 체크인 한 번',
      confidence_note: '데이터가 쌓이면 더 정밀한 조언을 드릴게요.',
      data_needed: 3 - recordCount
    };
  }
  
  const insights = [];
  const recommendations = [];
  let todayAction = '';
  let confidenceScore = 'low';
  const recentDays = recordCount >= 3 && recordCount < 7 ? '최근 기록 기준' : '최근';
  const recordLabel = recordCount >= 7 ? '최근 기록을 종합해 보면' : `${recentDays} 보면`;
  
  if (bedtimeStd !== null && bedtimeStd > 45) {
    const prefix = recordCount >= 3 && recordCount < 7 ? '최근 3일 기록 기준으로' : '';
    insights.push(`${prefix} 취침 시간이 매일 많이 달라지고 있어요.`.replace(/^\s+/, ''));
    recommendations.push('취침 시간을 정해진 범위(1시간 이내)로 맞추면 수면 질이 개선될 수 있어요.');
    todayAction = '오늘 정한 취침 시간에 맞춰 스마트폰을 끄고 침대에 누워보세요.';
    confidenceScore = recordCount >= 7 ? 'medium-high' : 'medium';
  }
  
  if (avgBedtimeMins !== null && (avgBedtimeMins > 23 * 60 || avgBedtimeMins < 6 * 60)) {
    const bedtimeStr = formatBedtime(avgBedtimeMins);
    if (avgQuality !== null && avgQuality < 3) {
      const prefix = recordCount >= 3 && recordCount < 7 ? '최근 기록 기준으로는' : '';
      insights.push(`${prefix} 평균 취침 시간이 ${bedtimeStr} 정도로 다소 늦고, 수면 질도 낮아요.`.replace(/^\s+/, ''));
      recommendations.push('취침 시간을 조금 앞당기면 컨디션이 더 나아질 수 있어요.');
      if (!todayAction) todayAction = '오늘은 평소보다 30분 일찍 잠을 들어가는 것을 목표로 해보세요.';
      confidenceScore = recordCount >= 7 ? 'medium-high' : 'medium';
    }
  }
  
  if (avgDuration !== null && avgDuration < 6.5 * 60) {
    const prefix = recordCount >= 3 && recordCount < 7 ? '최근 며칠은' : '';
    insights.push(`${prefix} 평균 수면 시간이 ${Math.round(avgDuration / 60 * 10) / 10}시간으로 조금 부족해요.`.replace(/^\s+/, ''));
    recommendations.push('수면 시간이 부족하면 낮에 피로감이 누적될 수 있어요.');
    if (!todayAction) todayAction = '오늘은 충분히 자는 것을 최우선으로 해보세요.';
    if (confidenceScore === 'low') confidenceScore = recordCount >= 7 ? 'medium-high' : 'medium';
  }
  
  if (qualityCaffeineCorr < -0.5 && caffeineDayCount >= 2) {
    const prefix = recordCount >= 3 && recordCount < 7 ? '최근 기록 기준으로는' : '';
    insights.push(`${prefix} 카페인 섭취 후 수면 질이 낮아지는 경향이 보여요.`.replace(/^\s+/, ''));
    recommendations.push('카페인 섭취 후 충분히 시간이 지난 후 잠을 드는 것이 좋을 수 있어요.');
    if (!todayAction) todayAction = '오늘 저녁에는 카페인 음료를 피하고, 가능하다면 오후 3시 이후는 카페인 제품을 멀리해 보세요.';
    confidenceScore = recordCount >= 7 ? 'medium-high' : 'medium';
  }
  
  if (bedtimeCaffeineCorr > 30 && caffeineDayCount >= 2) {
    const prefix = recordCount >= 3 && recordCount < 7 ? '최근 기록 기준으로는' : '';
    insights.push(`${prefix} 카페인 섭취일이 그렇지 않은 날보다 취침 시간이 조금 밀리는 편이에요.`.replace(/^\s+/, ''));
    recommendations.push('카페인 섭취 시간을 더 일찍 조정하면 취침 시간을 안정시킬 수 있어요.');
    if (confidenceScore === 'low') confidenceScore = recordCount >= 7 ? 'medium-high' : 'medium';
  }
  
  if (qualityNapCorr < -0.5 && napDayCount >= 2) {
    const prefix = recordCount >= 3 && recordCount < 7 ? '최근 기록을 보면' : '';
    insights.push(`${prefix} 낮잠을 잔 날에 수면 질이 낮아지는 경향이 보여요.`.replace(/^\s+/, ''));
    recommendations.push('낮잠 시간을 짧게(30분 이내)하거나 너무 늦게 자지 않으면 도움이 될 수 있어요.');
    confidenceScore = recordCount >= 7 ? 'medium-high' : 'medium';
  }
  
  if (bedtimeNapCorr > 30 && napDayCount >= 2) {
    const prefix = recordCount >= 3 && recordCount < 7 ? '최근 기록을 보면' : '';
    insights.push(`${prefix} 낮잠을 잔 날이 그렇지 않은 날보다 취침 시간이 늦어지는 경향이 있어요.`.replace(/^\s+/, ''));
    recommendations.push('낮잠을 일찍 마치면 밤 취침 시간에 영향을 덜 줘요.');
    confidenceScore = recordCount >= 7 ? 'medium-high' : 'medium';
  }
  
  if (insights.length === 0) {
    insights.push('최근 기록을 보면 전반적으로 수면 패턴이 안정적인 편이에요.');
    recommendations.push('현재 루틴을 그대로 유지하면서 가끔 변화를 주는 것도 좋을 수 있어요.');
    todayAction = '오늘도 아침, 저녁 기록을 차근차근 남겨보세요.';
    confidenceScore = recordCount >= 7 ? 'high' : 'medium';
  }
  
  const headline = insights.length > 0 
    ? insights[0].replace(/.$/, '요.')
    : '안정적인 수면 패턴';
  
  let confidenceNote;
  if (recordCount >= 7) {
    confidenceNote = confidenceScore === 'high'
      ? '데이터가 충분해서 더 확실한 조언이에요.'
      : '데이터를 종합해보니 이런 흐름이 보여요.';
  } else {
    confidenceNote = confidenceScore === 'medium-high'
      ? '일부 데이터에서 패턴이 보여요.'
      : '데이터가 좀 더 쌓이면 더 정확한 조언이 가능할 거예요.';
  }
  
  return {
    status: 'ready',
    headline,
    insight: insights.join(' '),
    recommendation: recommendations.join(' '),
    today_action: todayAction || '오늘도 기록을 이어 가세요.',
    confidence_note: confidenceNote,
    record_count: recordCount,
    avg_bedtime: formatBedtime(avgBedtimeMins),
    avg_duration_hours: avgDuration ? Math.round(avgDuration / 60 * 10) / 10 : null,
    avg_quality: avgQuality ? Math.round(avgQuality * 10) / 10 : null
  };
}

export default async function handler(req, res) {
  addCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
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