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

async function submitForm(data, idleLabel) {
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
  }

  try {
    const response = await fetch(`${API_BASE}/api/sleep-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Submission failed');
    }

    showMessage('success', result.message || 'Submitted successfully!');
    return true;
  } catch (err) {
    showMessage('error', err.message || 'Failed to submit. Please try again.');
    return false;
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = idleLabel;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const morningForm = document.getElementById('morningForm');
  if (morningForm) {
    morningForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const data = {
        type: 'morning',
        date: getDateKey(),
        sleep_time: document.getElementById('sleep_time').value,
        wake_time: document.getElementById('wake_time').value,
        sleep_quality: parseInt(document.querySelector('input[name="sleep_quality"]:checked')?.value || '3', 10),
        awakenings: parseInt(document.getElementById('awakenings').value || '0', 10),
        memo: document.getElementById('memo').value.trim(),
        submitted_at: new Date().toISOString()
      };

      const ok = await submitForm(data, 'Save Morning Log');
      if (ok) morningForm.reset();
    });
  }

  const eveningForm = document.getElementById('eveningForm');
  if (eveningForm) {
    eveningForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const data = {
        type: 'evening',
        date: getDateKey(),
        caffeine: document.querySelector('input[name="caffeine"]:checked')?.value === 'yes',
        exercise: document.querySelector('input[name="exercise"]:checked')?.value === 'yes',
        nap: document.querySelector('input[name="nap"]:checked')?.value === 'yes',
        stress_or_condition: document.getElementById('stress_or_condition').value.trim(),
        expected_bedtime: document.getElementById('expected_bedtime').value,
        memo: document.getElementById('memo').value.trim(),
        submitted_at: new Date().toISOString()
      };

      const ok = await submitForm(data, 'Save Evening Log');
      if (ok) eveningForm.reset();
    });
  }
});
