# sleepTech MVP Status

## 개요
sleepTech는 개인용 수면 체크인 MVP입니다.
GitHub Pages 프론트엔드와 Vercel API를 통해 아침/저녁 입력을 받고, 민감한 수면 데이터는 private GitHub repo에 날짜별 JSON으로 저장합니다.

## 라이브 주소
- 홈: https://baesamaith-cmd.github.io/sleepTech/
- 아침 입력: https://baesamaith-cmd.github.io/sleepTech/morning.html
- 저녁 입력: https://baesamaith-cmd.github.io/sleepTech/evening.html
- API base: https://sleep-tech-five.vercel.app

## 현재 핵심 기능
### 1. 아침 입력
- 날짜 (기본값 오늘, 수정 가능)
- 전날 잠든 시간
- 오늘 아침 기상 시간
- 수면 질 (1~5)
- 중간에 깬 횟수
- 아침 컨디션 (1~5)
- 메모
- 음성 입력 버튼 (메모)
- 상세 기록 (선택)
  - 침대에 들어간 시간
  - 불을 끈 시간
  - 잠들기까지 걸린 시간
  - 밤에 깨어있던 총 시간
  - 최종 기상 시간
  - 침대에서 나온 시간
  - 낮 시간 졸림 정도

### 2. 저녁 입력
- 날짜 (기본값 오늘, 수정 가능)
- 오후 4시 이후 카페인
- 음주
- 음주량 (조건부)
- 운동
- 낮잠
- 낮잠 시간 (조건부)
- 메모
- 음성 입력 버튼 (메모)
- 취침 추천 카드

### 3. 홈 화면
- 현재 시각 표시
- 최근 요약 섹션
  - 평균 수면
  - 수면 질
  - 실제 저장 데이터 개수 기반 최근 n일 요약 라벨
- 수면 코칭 카드 / 데이터 부족 카드
- 아침/저녁 입력 CTA

## 저장 구조
- private repo: `baesamaith-cmd/sleep-data-private`
- 저장 경로: `sleep-data/YYYY-MM-DD.json`

예시 구조:
```json
{
  "date": "2026-04-17",
  "entries": {
    "morning": {
      "type": "morning",
      "date": "2026-04-17",
      "sleep_time": "23:55",
      "wake_time": "06:00",
      "sleep_quality": 3,
      "awakenings": 2,
      "morning_energy": 4,
      "daytime_sleepiness": 3,
      "memo": "",
      "submitted_at": "2026-04-16T22:55:51.002Z"
    }
  },
  "metadata": {
    "last_updated_at": "2026-04-16T22:55:51.002Z",
    "source": "sleeptech-mvp"
  }
}
```

## 현재 작동 중인 API
- `POST /api/sleep-log`
  - 아침/저녁 입력 저장
- `GET /api/summary-stats`
  - 최근 요약 수치 및 저장 일수 count
- `GET /api/latest-summary?for=morning|evening`
  - 직전 요약 / fallback 요약
- `GET /api/bedtime-recommendation`
  - 저녁 취침 추천
- `GET /api/pattern-insights`
  - 최근 패턴 기반 코칭

## 최근 정리된 사항
- 아침 저장 흐름 복구 완료
- 아침은 `sleep_time`, `wake_time` 기반으로 기존 데이터와 최대한 호환
- summary-stats의 count 계산 수정 완료
- 최근 요약 라벨은 고정 7일이 아니라 실제 데이터 수 기반으로 동작하도록 수정
- latest-summary는 인접 기록이 없을 때도 더 자연스러운 fallback을 사용하도록 개선
- pattern-insights / bedtime-recommendation API 복구 완료
- 음성 입력 버튼 스타일을 주변 UI와 더 유사하게 정리

## 현재 확인된 데이터 상태
- 최근 저장 데이터는 5일 이상 누적되어 있음
- 2026-04-16 morning 저장 확인
- 2026-04-17 morning 저장 확인
- 2026-04-18 morning 저장 확인

## 남아 있을 수 있는 점검 포인트
- 브라우저 캐시 때문에 홈 최근 요약 라벨이 즉시 안 바뀌어 보일 수 있음
- `pages/` 폴더는 현재 운영 소스가 아니라 mirror/legacy 성격으로 남아 있음
- 운영 기준 파일은 root (`index.html`, `morning.html`, `evening.html`, `assets/*`) 기준으로 확인해야 함

## 운영 원칙
- active frontend는 repo root 파일 기준
- `pages/`는 당장 수정 소스 오브 트루스로 보지 않음
- 커밋/푸시는 사용자 허락 후 진행
- 완료라고 말하기 전에는 가능하면
  1. 로컬 root 파일
  2. 원격 main
  3. live Pages / live API
  를 확인
