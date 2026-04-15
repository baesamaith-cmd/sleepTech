// SleepTech MVP - Client-side JavaScript
// No tokens stored here - all API calls go to serverless backend

const API_BASE = (window.API_BASE_URL && window.API_BASE_URL !== 'YOUR_VERCEL_APP')
  ? window.API_BASE_URL.replace(/\/$/, '')
  : 'https://sleep-tech-api.vercel.app';

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

function getDateKey() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

async function loadPreviousSummary(target) {
  const card = document.getElementById('previousSummaryCard');
  const text = document.getElementById('previousSummaryText');
  if (!card || !text || !target) return;

  try {
    const response = await fetch(`${API_BASE}/api/latest-summary?for=${target}`);
    if (!response.ok) return;
    const result = await response.json();
    if (!result?.found || !result?.summary) return;
    text.textContent = result.summary;
    card.classList.remove('is-hidden');
  } catch {
    // keep summary hidden on failure
  }
}

async function loadPatternInsights() {
  const coachingCard = document.getElementById('patternInsightsCard');
  const buildingCard = document.getElementById('patternBuildingCard');
  if (!coachingCard && !buildingCard) return;

  try {
    const response = await fetch(`${API_BASE}/api/pattern-insights`);
    if (!response.ok) return;
    const result = await response.json();

    if (result.status === 'building') {
      if (buildingCard) {
        const insightEl = document.getElementById('buildingInsight');
        const recEl = document.getElementById('buildingRecommendation');

        if (insightEl) insightEl.textContent = result.insight;
        if (recEl) recEl.textContent = result.today_action;

        buildingCard.classList.remove('is-hidden');
      }
    } else if (result.status === 'ready') {
      if (coachingCard) {
        const headlineEl = document.getElementById('coachingHeadline');
        const insightEl = document.getElementById('coachingInsight');
        const recEl = document.getElementById('coachingRecommendation');
        const actionEl = document.getElementById('coachingAction');
        const confEl = document.getElementById('coachingConfidence');

        if (headlineEl) headlineEl.textContent = result.headline;
        if (insightEl) insightEl.textContent = result.insight;
        if (recEl) recEl.textContent = result.recommendation;
        if (actionEl) actionEl.textContent = result.today_action;
        if (confEl) confEl.textContent = result.confidence_note;

        coachingCard.classList.remove('is-hidden');
      }
    }
  } catch {
    // keep cards hidden on failure
  }
}

async function loadBedtimeRecommendation() {
  const card = document.getElementById('recommendationCard');
  if (!card) return;

  const caffeine = document.querySelector('input[name="caffeine"]:checked')?.value === 'yes';
  const exercise = document.querySelector('input[name="exercise"]:checked')?.value === 'yes';
  const nap = document.querySelector('input[name="nap"]:checked')?.value === 'yes';

  const params = new URLSearchParams();
  if (caffeine) params.append('caffeine', 'true');
  if (exercise) params.append('exercise', 'true');
  if (nap) params.append('nap', 'true');

  try {
    const response = await fetch(`${API_BASE}/api/bedtime-recommendation?${params.toString()}`);
    if (!response.ok) return;
    const result = await response.json();

    if (result.show_recommendation && result.recommended_bedtime_start) {
      document.getElementById('bedtimeWindow').textContent = `${result.recommended_bedtime_start} ~ ${result.recommended_bedtime_end}`;
      document.getElementById('bedtimeReason').textContent = result.bedtime_reason;
      document.getElementById('bedtimeTip').textContent = result.bedtime_tip || '';
      document.getElementById('confidenceNote').textContent = result.uncertainty_note || '';

      card.classList.remove('is-hidden');
    }
  } catch {
    // keep card hidden on failure
  }
}

async function submitForm(data, idleLabel) {
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '저장 중...';
  }

  try {
    const response = await fetch(`${API_BASE}/api/sleep-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || '제출 실패');
    }

    showMessage('success', result.message || '저장 완료!');
    return true;
  } catch (err) {
    showMessage('error', err.message || '저장에 실패했어요. 다시 시도해 주세요.');
    return false;
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = idleLabel;
    }
  }
}

function setupVoiceInputs() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const voiceButtons = document.querySelectorAll('[data-voice-target]');

  if (!voiceButtons.length) return;

  const isSupported = !!SpeechRecognition;

  voiceButtons.forEach((btn) => {
    if (!isSupported) {
      btn.disabled = true;
      btn.textContent = '🎤 브라우저 미지원';
      btn.title = '이 브라우저에서는 음성 입력을 지원하지 않아요.';
      return;
    }
    
    const targetId = btn.dataset.voiceTarget;
    const target = document.getElementById(targetId);
    if (!target) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      btn.classList.add('is-recording');
      btn.textContent = '⏺️ 듣는 중';
    };

    recognition.onend = () => {
      btn.classList.remove('is-recording');
      btn.textContent = '🎤';
    };

    recognition.onerror = () => {
      showMessage('error', '음성 입력을 처리하지 못했어요. 다시 시도하거나 직접 입력해 주세요.');
    };

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (!transcript) return;
      target.value = target.value ? `${target.value} ${transcript}` : transcript;
      showMessage('success', '음성 내용을 메모에 넣었어요. 저장 전에 한 번 확인해 주세요.');
    };

    btn.addEventListener('click', () => {
      try {
        recognition.start();
      } catch {
        showMessage('error', '음성 입력 시작에 실패했어요. 잠시 후 다시 시도해 주세요.');
      }
    });
  });
}

async function loadSummaryStats() {
  const avgSleep = document.getElementById('avgSleepValue');
  const avgQuality = document.getElementById('avgQualityValue');
  const avgEfficiency = document.getElementById('efficiencyValue');
  const feedback = document.getElementById('summaryFeedback');

  try {
    const response = await fetch(`${API_BASE}/api/summary-stats`);
    if (!response.ok) return;
    const stats = await response.json();

    if (stats.avgSleep) avgSleep.textContent = `${stats.avgSleep}시간`;
    if (stats.avgQuality) avgQuality.textContent = `${stats.avgQuality}/5`;
    if (stats.avgEfficiency) avgEfficiency.textContent = `${stats.avgEfficiency}%`;
    
    if (stats.count >= 3) {
      feedback.textContent = '최근 일주일간 안정적인 리듬을 보여주고 있어요.';
    } else if (stats.count > 0) {
      feedback.textContent = '데이터를 꾸준히 모아주세요. 조금 더 기록이 필요해요!';
    }
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadSummaryStats();
  setupVoiceInputs();

  if (document.getElementById('patternInsightsCard') || document.getElementById('patternBuildingCard')) {
    loadPatternInsights();
  }

  const morningForm = document.getElementById('morningForm');
  if (morningForm) {
    morningForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const data = {
        type: 'morning',
        date: document.getElementById('diary_date').value,
        total_sleep_time: parseFloat(document.getElementById('estimated_total_sleep_time').value),
        sleep_quality: parseInt(document.querySelector('input[name="sleep_quality"]:checked')?.value || '3', 10),
        awakenings: parseInt(document.getElementById('awakenings').value || '0', 10),
        morning_energy: parseInt(document.getElementById('morning_energy').value || '3', 10),
        memo: document.getElementById('memo').value.trim(),
        
        // optional detailed fields
        time_in_bed: document.getElementById('time_in_bed').value || null,
        lights_out_time: document.getElementById('lights_out_time').value || null,
        sleep_onset_latency: parseInt(document.getElementById('sleep_onset_latency').value || '0', 10),
        total_awake_time: parseInt(document.getElementById('total_awake_time').value || '0', 10),
        final_wake_time: document.getElementById('final_wake_time').value || null,
        out_of_bed_time: document.getElementById('out_of_bed_time').value || null,
        daytime_sleepiness: parseInt(document.getElementById('daytime_sleepiness').value || '3', 10),
        
        submitted_at: new Date().toISOString()
      };

      const ok = await submitForm(data, '아침 일지 저장');
      if (ok) morningForm.reset();
    });
  }

  const eveningForm = document.getElementById('eveningForm');
  if (eveningForm) {
    loadBedtimeRecommendation();

    const inputsToWatch = eveningForm.querySelectorAll('input[name="caffeine"], input[name="exercise"], input[name="nap"]');
    inputsToWatch.forEach(input => {
      input.addEventListener('change', loadBedtimeRecommendation);
    });

    eveningForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const data = {
        type: 'evening',
        date: document.getElementById('diary_date').value,
        caffeine: document.querySelector('input[name="caffeine"]:checked')?.value === 'yes',
        alcohol: document.querySelector('input[name="alcohol"]:checked')?.value === 'yes',
        alcohol_amount: document.querySelector('input[name="alcohol_amount"]:checked')?.value || null,
        exercise: document.querySelector('input[name="exercise"]:checked')?.value === 'yes',
        nap: document.querySelector('input[name="nap"]:checked')?.value === 'yes',
        nap_duration: parseInt(document.getElementById('nap_duration').value || '0', 10),
        memo: document.getElementById('memo').value.trim(),
        submitted_at: new Date().toISOString()
      };

      const ok = await submitForm(data, '저녁 일지 저장');
      if (ok) eveningForm.reset();
    });
  }
});
