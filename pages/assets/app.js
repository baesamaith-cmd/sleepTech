const API_BASE = (window.API_BASE_URL && window.API_BASE_URL !== 'YOUR_VERCEL_APP')
  ? window.API_BASE_URL.replace(/\/$/, '')
  : 'https://sleep-tech-api.vercel.app';

const DIARY_STORAGE_KEY = 'sleeptech-cbti-diary-v1';

function showMessage(type, text) {
  const msgEl = document.getElementById('message');
  if (!msgEl) return;
  msgEl.className = `message ${type}`;
  msgEl.textContent = text;
  msgEl.style.display = 'block';
  setTimeout(() => {
    msgEl.style.display = 'none';
  }, 5000);
}

function getTodayDateKey() {
  return new Date().toISOString().split('T')[0];
}

function setDefaultDate() {
  const input = document.getElementById('diary_date');
  if (input && !input.value) input.value = getTodayDateKey();
}

function loadDiaryStore() {
  try {
    return JSON.parse(localStorage.getItem(DIARY_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveDiaryStore(store) {
  localStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(store));
}

function updateLocalDiaryEntry(type, payload) {
  const store = loadDiaryStore();
  const date = payload.date;
  store[date] = store[date] || { date, entries: {} };
  store[date].entries[type] = payload;
  saveDiaryStore(store);
}

function minutesFromTime(time) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function durationBetween(start, end) {
  const startMins = minutesFromTime(start);
  const endMins = minutesFromTime(end);
  if (startMins === null || endMins === null) return null;
  let delta = endMins - startMins;
  if (delta < 0) delta += 24 * 60;
  return delta;
}

function getRecentRecords(limit = 7) {
  const store = loadDiaryStore();
  return Object.values(store)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

function calculateMetrics(records) {
  const complete = records.filter((record) => record.entries?.morning);
  if (!complete.length) {
    return {
      avgSleepHours: null,
      avgQuality: null,
      avgTimeInBedHours: null,
      efficiency: null
    };
  }

  let totalSleepHours = 0;
  let totalQuality = 0;
  let totalTimeInBedHours = 0;
  let efficiencySamples = 0;

  complete.forEach((record) => {
    const morning = record.entries.morning;
    const sleepHours = Number(morning.estimated_total_sleep_time || 0);
    const timeInBedMins = durationBetween(morning.time_in_bed, morning.out_of_bed_time);

    totalSleepHours += sleepHours;
    totalQuality += Number(morning.sleep_quality || 0);

    if (timeInBedMins !== null) {
      totalTimeInBedHours += timeInBedMins / 60;
      if (sleepHours > 0 && timeInBedMins > 0) efficiencySamples += (sleepHours * 60) / timeInBedMins;
    }
  });

  return {
    avgSleepHours: totalSleepHours / complete.length,
    avgQuality: totalQuality / complete.length,
    avgTimeInBedHours: totalTimeInBedHours / complete.length,
    efficiency: efficiencySamples ? (efficiencySamples / complete.length) * 100 : null
  };
}

function renderDashboard() {
  const avgSleepValue = document.getElementById('avgSleepValue');
  if (!avgSleepValue) return;

  const records = getRecentRecords(7);
  const metrics = calculateMetrics(records);
  const avgQualityValue = document.getElementById('avgQualityValue');
  const avgBedValue = document.getElementById('avgBedValue');
  const efficiencyValue = document.getElementById('efficiencyValue');
  const trendList = document.getElementById('trendList');
  const trendEmpty = document.getElementById('trendEmpty');

  avgSleepValue.textContent = metrics.avgSleepHours ? `${metrics.avgSleepHours.toFixed(1)}h` : '--';
  avgQualityValue.textContent = metrics.avgQuality ? `${metrics.avgQuality.toFixed(1)}/5` : '--';
  avgBedValue.textContent = metrics.avgTimeInBedHours ? `${metrics.avgTimeInBedHours.toFixed(1)}h` : '--';
  efficiencyValue.textContent = metrics.efficiency ? `${Math.round(metrics.efficiency)}%` : '--';

  if (!trendList || !trendEmpty) return;
  trendList.innerHTML = '';

  if (!records.length) {
    trendEmpty.style.display = 'block';
    return;
  }

  trendEmpty.style.display = 'none';
  records.forEach((record) => {
    const morning = record.entries?.morning;
    const evening = record.entries?.evening;
    const row = document.createElement('div');
    row.className = 'trend-row';
    row.innerHTML = `
      <strong>${record.date}</strong>
      <div class="helper-text">Sleep: ${morning?.estimated_total_sleep_time ? `${morning.estimated_total_sleep_time}h` : '—'} · Quality: ${morning?.sleep_quality || '—'}/5 · Bedtime plan: ${evening?.expected_bedtime || '—'} · Nap: ${evening?.nap_duration ?? '—'} min</div>
    `;
    trendList.appendChild(row);
  });
}

async function fetchLatestSummary() {
  const msgEl = document.getElementById('message');
  if (!msgEl) return;

  try {
    const response = await fetch(`${API_BASE}/api/latest-summary?for=evening`);
    if (!response.ok) return;
    const data = await response.json();
    if (data.found && data.summary) {
      msgEl.className = 'message success';
      msgEl.textContent = data.summary;
      msgEl.style.display = 'block';
      setTimeout(() => { msgEl.style.display = 'none'; }, 8000);
    }
  } catch {
    // ignore missing summary endpoint failures
  }
}

async function fetchBedtimeRecommendation() {
  const card = document.getElementById('recommendationCard');
  if (!card) return;

  try {
    const response = await fetch(`${API_BASE}/api/bedtime-recommendation`);
    if (!response.ok) return;
    const data = await response.json();
    if (data.found === false && !data.show_recommendation) return;

    const timeValue = data.recommended_bedtime_start
      ? `${data.recommended_bedtime_start} ~ ${data.recommended_bedtime_end}`
      : '--';

    document.getElementById('bedtimeWindow').textContent = timeValue;
    document.getElementById('bedtimeReason').textContent = data.bedtime_reason || data.info_message || 'Use this as a gentle guide, not a hard rule.';
    document.getElementById('bedtimeTip').textContent = data.bedtime_tip || '';
    document.getElementById('confidenceNote').textContent = data.confidence_note || data.uncertainty_note || '';
    card.classList.remove('is-hidden');
  } catch {
    // ignore recommendation fetch failures
  }
}

async function submitForm(data, idleLabel) {
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }

  try {
    const response = await fetch(`${API_BASE}/api/sleep-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Submission failed');

    showMessage('success', result.message || 'Saved successfully');
    return true;
  } catch (err) {
    showMessage('error', err.message || 'Failed to save. Please try again.');
    return false;
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = idleLabel;
    }
  }
}

function setupMorningForm() {
  const morningForm = document.getElementById('morningForm');
  if (!morningForm) return;

  setDefaultDate();

  morningForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const data = {
      type: 'morning',
      date: document.getElementById('diary_date').value || getTodayDateKey(),
      time_in_bed: document.getElementById('time_in_bed').value,
      lights_out_time: document.getElementById('lights_out_time').value,
      sleep_onset_latency: parseInt(document.getElementById('sleep_onset_latency').value || '0', 10),
      awakenings: parseInt(document.getElementById('awakenings').value || '0', 10),
      total_awake_time: parseInt(document.getElementById('total_awake_time').value || '0', 10),
      final_wake_time: document.getElementById('final_wake_time').value,
      out_of_bed_time: document.getElementById('out_of_bed_time').value,
      estimated_total_sleep_time: parseFloat(document.getElementById('estimated_total_sleep_time').value || '0'),
      sleep_quality: parseInt(document.querySelector('input[name="sleep_quality"]:checked')?.value || '3', 10),
      morning_energy: parseInt(document.getElementById('morning_energy').value || '3', 10),
      daytime_sleepiness: parseInt(document.getElementById('daytime_sleepiness').value || '3', 10),
      memo: document.getElementById('memo').value.trim(),
      submitted_at: new Date().toISOString()
    };

    const ok = await submitForm(data, 'Save morning diary');
    if (!ok) return;

    updateLocalDiaryEntry('morning', data);
    morningForm.reset();
    setDefaultDate();
  });
}

function setupEveningForm() {
  const eveningForm = document.getElementById('eveningForm');
  if (!eveningForm) return;

  setDefaultDate();
  fetchBedtimeRecommendation();

  eveningForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const caffeineAmount = document.getElementById('caffeine_amount').value;
    const alcoholAmount = document.getElementById('alcohol_amount').value;
    const napDuration = parseInt(document.getElementById('nap_duration').value || '0', 10);

    const data = {
      type: 'evening',
      date: document.getElementById('diary_date').value || getTodayDateKey(),
      caffeine: caffeineAmount !== 'none',
      caffeine_amount: caffeineAmount,
      alcohol: alcoholAmount !== 'none',
      alcohol_amount: alcoholAmount,
      nap: napDuration > 0,
      nap_duration: napDuration,
      exercise: document.querySelector('input[name="exercise"]:checked')?.value === 'yes',
      stress_or_condition: document.getElementById('stress_or_condition').value.trim(),
      expected_bedtime: document.getElementById('expected_bedtime').value,
      memo: document.getElementById('memo').value.trim(),
      submitted_at: new Date().toISOString()
    };

    const ok = await submitForm(data, 'Save evening diary');
    if (!ok) return;

    updateLocalDiaryEntry('evening', data);
    eveningForm.reset();
    setDefaultDate();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderDashboard();
  fetchLatestSummary();
  setupMorningForm();
  setupEveningForm();
});
