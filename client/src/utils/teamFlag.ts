import isoMap from '../constants/teamIso.json';

const ISO_MAP = isoMap as Record<string, string>;

export function getTeamIsoCode(name: string, nameZh?: string) {
  return ISO_MAP[name] || ISO_MAP[nameZh || ''] || null;
}

/** flagcdn 小尺寸国旗图（Windows 下比 emoji 可靠） */
export function getTeamFlagUrl(name: string, nameZh?: string, width = 40) {
  const iso = getTeamIsoCode(name, nameZh);
  if (!iso) return null;
  return `https://flagcdn.com/w${width}/${iso}.png`;
}
