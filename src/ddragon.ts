// Data Dragon: 챔피언/아이템/룬/소환사 주문 정적 데이터
// 원본은 버전을 9.24.2 로 박아 두어서 새 챔피언 이미지가 깨졌다 → 최신 버전을 조회해서 사용

const BASE = 'https://ddragon.leagueoflegends.com';

export type ChampionInfo = {
  id: string; // "Ahri" (이미지/URL 용)
  key: string; // "103" (match-v5 championId)
  name: string; // "아리"
  title: string;
  tags: string[]; // Fighter, Mage, Assassin, Marksman, Support, Tank
  info: { attack: number; defense: number; magic: number; difficulty: number };
};

export type ChampionFull = ChampionInfo & {
  blurb: string;
  allytips: string[];
  enemytips: string[];
  passive: { name: string; description: string; image: { full: string } };
  spells: { id: string; name: string; description: string; image: { full: string } }[];
};

type Item = { name: string; gold: { total: number; purchasable: boolean }; into?: string[]; tags: string[]; maps: Record<string, boolean> };
type Rune = { id: number; key: string; name: string; icon: string };
type RuneStyle = Rune & { slots: { runes: Rune[] }[] };
type Spell = { key: string; name: string; image: { full: string } };

type Static = {
  version: string;
  champions: Map<number, ChampionInfo>;
  byId: Map<string, ChampionInfo>;
  items: Record<string, Item>;
  runes: Map<number, Rune>;
  spells: Map<number, Spell>;
  at: number;
};

let cached: Static | null = null;
const TTL = 6 * 60 * 60 * 1000;

const getJson = <T>(url: string, ttl: number) => fetch(url, { cf: { cacheTtl: ttl, cacheEverything: true } }).then((r) => r.json<T>());

async function load(): Promise<Static> {
  if (cached && Date.now() - cached.at < TTL) return cached;
  const version = (await getJson<string[]>(`${BASE}/api/versions.json`, 3600))[0];
  const cdn = `${BASE}/cdn/${version}/data/ko_KR`;
  const [champ, item, runes, spell] = await Promise.all([
    getJson<{ data: Record<string, ChampionInfo> }>(`${cdn}/champion.json`, 86400),
    getJson<{ data: Record<string, Item> }>(`${cdn}/item.json`, 86400),
    getJson<RuneStyle[]>(`${cdn}/runesReforged.json`, 86400),
    getJson<{ data: Record<string, Spell> }>(`${cdn}/summoner.json`, 86400),
  ]);
  const champions = new Map<number, ChampionInfo>();
  const byId = new Map<string, ChampionInfo>();
  for (const c of Object.values(champ.data)) {
    champions.set(Number(c.key), c);
    byId.set(c.id.toLowerCase(), c);
  }
  const runeMap = new Map<number, Rune>();
  for (const style of runes) {
    runeMap.set(style.id, style);
    for (const slot of style.slots) for (const r of slot.runes) runeMap.set(r.id, r);
  }
  const spells = new Map<number, Spell>();
  for (const s of Object.values(spell.data)) spells.set(Number(s.key), s);
  cached = { version, champions, byId, items: item.data, runes: runeMap, spells, at: Date.now() };
  return cached;
}

export type DDragon = Awaited<ReturnType<typeof ddragon>>;

export async function ddragon() {
  const s = await load();
  const cdn = `${BASE}/cdn/${s.version}`;
  return {
    version: s.version,
    patch: s.version.split('.').slice(0, 2).join('.'),
    champions: [...s.champions.values()],
    champion: (id: number) => s.champions.get(id),
    championBySlug: (slug: string) => s.byId.get(slug.toLowerCase()),
    // match-v5 의 championName 은 "FiddleSticks" 처럼 Data Dragon id 와 다를 때가 있어 championId 로 찾는다
    championImg: (id: number) => `${cdn}/img/champion/${s.champions.get(id)?.id ?? 'Aatrox'}.png`,
    championName: (id: number) => s.champions.get(id)?.name ?? `#${id}`,
    championSlug: (id: number) => s.champions.get(id)?.id ?? String(id),
    profileIcon: (id: number) => `${cdn}/img/profileicon/${id}.png`,
    item: (id: number) => s.items[String(id)],
    itemImg: (id: number) => `${cdn}/img/item/${id}.png`,
    // 완성 아이템: 더 이상 상위 아이템이 없고 일정 가격 이상 (장신구, 소모품 제외)
    isCoreItem: (id: number) => {
      const it = s.items[String(id)];
      if (!it || !it.gold.purchasable || it.tags.includes('Trinket') || it.tags.includes('Consumable')) return false;
      if (it.tags.includes('Boots')) return !it.into?.length && it.gold.total >= 900;
      return !it.into?.length && it.gold.total >= 2000;
    },
    isBoots: (id: number) => !!s.items[String(id)]?.tags.includes('Boots'),
    rune: (id: number) => s.runes.get(id),
    runeImg: (id: number) => {
      const r = s.runes.get(id);
      return r ? `${BASE}/cdn/img/${r.icon}` : '';
    },
    spell: (id: number) => s.spells.get(id),
    spellImg: (id: number) => {
      const sp = s.spells.get(id);
      return sp ? `${cdn}/img/spell/${sp.image.full}` : '';
    },
    abilityImg: (file: string) => `${cdn}/img/spell/${file}`,
    passiveImg: (file: string) => `${cdn}/img/passive/${file}`,
    async championFull(slug: string): Promise<ChampionFull | null> {
      const info = s.byId.get(slug.toLowerCase());
      if (!info) return null;
      const json = await getJson<{ data: Record<string, ChampionFull> }>(`${cdn}/data/ko_KR/champion/${info.id}.json`, 86400);
      return json.data[info.id] ?? null;
    },
  };
}

const LOCAL_EMBLEMS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];

// 2023년에 추가된 에메랄드 티어는 원본 이미지가 없어서 Community Dragon 이미지를 쓴다
export function emblemImg(tier: string) {
  if (LOCAL_EMBLEMS.includes(tier)) {
    const name = tier.charAt(0) + tier.slice(1).toLowerCase();
    return `/static/img/emblems/Emblem_${name}.png`;
  }
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${tier.toLowerCase()}.png`;
}
