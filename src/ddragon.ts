// Data Dragon: 챔피언 이미지/한글 이름, 프로필 아이콘
// 원본은 버전을 9.24.2 로 박아 두어서 새 챔피언 이미지가 깨졌다 → 최신 버전을 조회해서 사용

const BASE = 'https://ddragon.leagueoflegends.com';

type ChampionData = { id: string; key: string; name: string };

let cached: { version: string; champions: Map<string, ChampionData>; at: number } | null = null;
const TTL = 6 * 60 * 60 * 1000;

async function load() {
  if (cached && Date.now() - cached.at < TTL) return cached;
  const versions = await fetch(`${BASE}/api/versions.json`, { cf: { cacheTtl: 3600 } }).then((r) => r.json<string[]>());
  const version = versions[0];
  const json = await fetch(`${BASE}/cdn/${version}/data/ko_KR/champion.json`, { cf: { cacheTtl: 86400 } }).then((r) =>
    r.json<{ data: Record<string, ChampionData> }>(),
  );
  const champions = new Map<string, ChampionData>();
  for (const c of Object.values(json.data)) champions.set(c.key, c);
  cached = { version, champions, at: Date.now() };
  return cached;
}

export type DDragon = {
  version: string;
  championImg: (championId: number) => string;
  championName: (championId: number) => string;
  profileIcon: (iconId: number) => string;
};

export async function ddragon(): Promise<DDragon> {
  const { version, champions } = await load();
  // match-v5 의 championName 은 "FiddleSticks" 처럼 Data Dragon id 와 다를 때가 있어 championId 로 찾는다
  return {
    version,
    championImg: (id) => `${BASE}/cdn/${version}/img/champion/${champions.get(String(id))?.id ?? 'Aatrox'}.png`,
    championName: (id) => champions.get(String(id))?.name ?? String(id),
    profileIcon: (id) => `${BASE}/cdn/${version}/img/profileicon/${id}.png`,
  };
}

const RUNE_STYLES: Record<number, string> = {
  8000: '7201_Precision',
  8100: '7200_Domination',
  8200: '7202_Sorcery',
  8300: '7203_Whimsy',
  8400: '7204_Resolve',
};

export const runeStyleImg = (style: number) =>
  `${BASE}/cdn/img/perk-images/Styles/${RUNE_STYLES[style] ?? '7201_Precision'}.png`;

const LOCAL_EMBLEMS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];

// 2023년에 추가된 에메랄드 티어는 원본 이미지가 없어서 Community Dragon 이미지를 쓴다
export function emblemImg(tier: string) {
  if (LOCAL_EMBLEMS.includes(tier)) {
    const name = tier.charAt(0) + tier.slice(1).toLowerCase();
    return `/static/img/emblems/Emblem_${name}.png`;
  }
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${tier.toLowerCase()}.png`;
}
