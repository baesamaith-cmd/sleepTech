export function analyzeRecentData(dataPoints, type) {
  const validPoints = dataPoints.filter(d => d !== null);
  if (validPoints.length === 0) return { summary: null, confidence: 'low' };

  if (type === 'morning') {
    const totalSleep = validPoints.reduce((acc, d) => acc + (parseFloat(d.total_sleep_time) || 0), 0);
    const avgSleep = (totalSleep / validPoints.length).toFixed(1);
    
    if (validPoints.length === 1) {
      return { 
        summary: `최근 기록된 지난 밤 수면은 ${validPoints[0].total_sleep_time}시간이었어요.`,
        confidence: 'medium'
      };
    }
    return {
      summary: `최근 ${validPoints.length}일 동안 평균 ${avgSleep}시간 주무셨어요.`,
      confidence: 'high'
    };
  }

  if (type === 'evening') {
    const exerciseDays = validPoints.filter(d => d.exercise).length;
    if (exerciseDays > 0) {
      return {
        summary: `최근 ${validPoints.length}일 중 ${exerciseDays}일 동안 운동하셨네요. 활기찬 저녁이에요!`,
        confidence: 'medium'
      };
    }
    return {
      summary: `최근 ${validPoints.length}일 동안 꾸준히 저녁 일지를 작성해주셨어요.`,
      confidence: 'medium'
    };
  }

  return { summary: null, confidence: 'low' };
}
