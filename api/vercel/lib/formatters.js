export function formatMorningSummary(morning) {
  return `지난 밤 ${morning.total_sleep_time || '?'}시간 주무셨군요. 수면 질은 ${morning.sleep_quality || 3}/5점이었어요.`;
}

export function formatEveningSummary(evening) {
  return `오늘 저녁 일지를 작성하셨어요. ${evening.exercise ? '운동도 하셨네요!' : ''} 좋은 밤 되세요.`;
}
