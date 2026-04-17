export function isoDate(date) {
  return date.toISOString().split('T')[0];
}

export async function getFile(owner, repo, path, token) {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json'
    }
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to read file: ${await response.text()}`);
  }
  return response.json();
}

export async function fetchRecentFiles(owner, repo, token, days) {
  const now = new Date();
  const filePromises = Array.from({ length: days }).map((_, i) => {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    return getFile(owner, repo, `sleep-data/${isoDate(d)}.json`, token);
  });
  
  const files = await Promise.all(filePromises);
  return files.filter(f => f && f.content).map(f => JSON.parse(Buffer.from(f.content, 'base64').toString('utf8')));
}

export function analyzePatterns(records) {
  const entries = records.flatMap(r => Object.values(r.entries || {}));
  const morningEntries = entries.filter(e => e.type === 'morning');
  
  if (morningEntries.length === 0) return { status: 'building' };
  
  const avgQuality = morningEntries.reduce((acc, e) => acc + (e.sleep_quality || 3), 0) / morningEntries.length;
  
  return {
    status: 'ready',
    headline: avgQuality >= 4 ? '좋은 수면 리듬을 유지하고 있어요!' : '수면 리듬을 조금 더 다듬어 볼까요?',
    insight: `최근 ${morningEntries.length}일간 평균 수면 질은 ${avgQuality.toFixed(1)}점이에요.`,
    recommendation: avgQuality >= 4 ? '지금처럼만 꾸준히 기록해 보세요.' : '잠들기 전 30분, 스마트폰을 멀리하는 것부터 시작해 볼까요?',
    today_action: '오늘 저녁에는 따뜻한 차 한 잔 어떠세요?',
    confidence_note: '기록이 쌓일수록 더 정확한 조언을 드릴 수 있어요.'
  };
}

export function generateCoaching(analysis) {
  if (analysis.status === 'building') {
    return {
      status: 'building',
      insight: '아직 데이터가 모이는 중이에요.',
      today_action: '오늘 아침과 저녁 일지를 모두 기록해 보세요!'
    };
  }
  return analysis;
}

export function calculateBedtimeRecommendation(yesterdayMorning, todayEvening) {
  let start = '22:00';
  let end = '00:00';
  let reason = '평소 수면 기록을 바탕으로 추천해 드려요.';
  let tip = '오늘 밤, 15분만 일찍 누워보세요.';

  if (todayEvening?.caffeine) {
    start = '23:00';
    end = '01:00';
    reason = '오늘 카페인을 섭취하셨군요. 평소보다 조금 늦게 잠들 수 있어요.';
    tip = '따뜻한 물로 샤워하고 몸을 이완시켜 주세요.';
  }

  return {
    recommended_bedtime_start: start,
    recommended_bedtime_end: end,
    bedtime_reason: reason,
    bedtime_tip: tip
  };
}
