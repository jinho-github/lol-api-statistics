// 티어 / 라인 공통 정의

export const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_KO: Record<string, string> = {
  IRON: '아이언',
  BRONZE: '브론즈',
  SILVER: '실버',
  GOLD: '골드',
  PLATINUM: '플래티넘',
  EMERALD: '에메랄드',
  DIAMOND: '다이아몬드',
  MASTER: '마스터',
  GRANDMASTER: '그랜드마스터',
  CHALLENGER: '챌린저',
};

// 티어표/비교 기준에 쓰는 구간. 하위 티어 유저를 위한 사이트라 아래쪽을 촘촘하게 나눈다
export const TIER_GROUPS = [
  { key: 'all', label: '전체', tiers: null },
  { key: 'low', label: '아이언–실버', tiers: ['IRON', 'BRONZE', 'SILVER'] },
  { key: 'mid', label: '골드–플래티넘', tiers: ['GOLD', 'PLATINUM'] },
  { key: 'high', label: '에메랄드–다이아', tiers: ['EMERALD', 'DIAMOND'] },
  { key: 'apex', label: '마스터+', tiers: ['MASTER', 'GRANDMASTER', 'CHALLENGER'] },
] as const;
export type TierGroupKey = (typeof TIER_GROUPS)[number]['key'];

export const tierGroup = (key: string | undefined) => TIER_GROUPS.find((g) => g.key === key) ?? TIER_GROUPS[0];
export const groupOfTier = (tier: string | null | undefined) =>
  TIER_GROUPS.find((g) => g.tiers && tier && (g.tiers as readonly string[]).includes(tier)) ?? TIER_GROUPS[0];

export const POSITIONS = [
  { key: 'TOP', label: '탑' },
  { key: 'JUNGLE', label: '정글' },
  { key: 'MIDDLE', label: '미드' },
  { key: 'BOTTOM', label: '원딜' },
  { key: 'UTILITY', label: '서포터' },
] as const;
export type Position = (typeof POSITIONS)[number]['key'];

export const POSITION_KO: Record<string, string> = Object.fromEntries(POSITIONS.map((p) => [p.key, p.label]));
export const isPosition = (p: string | undefined): p is Position => POSITIONS.some((x) => x.key === p);

// 표본이 적은 챔피언의 승률을 50% 쪽으로 당겨서 순위가 튀지 않게 한다 (베이지안 평균)
export const adjustedWinRate = (wins: number, games: number, prior = 30) => (wins + prior * 0.5) / (games + prior);

export function grade(adj: number) {
  if (adj >= 0.53) return 'S';
  if (adj >= 0.515) return 'A';
  if (adj >= 0.5) return 'B';
  if (adj >= 0.485) return 'C';
  return 'D';
}

export const pct = (v: number | null | undefined, digits = 1) => (v == null || !isFinite(v) ? '–' : `${(v * 100).toFixed(digits)}%`);
