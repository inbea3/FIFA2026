/**
 * 统一队名 canonical 形式，用于外部赛果与本地赛程匹配。
 * canonical 值与 data/schedule.json / matches.home_team 保持一致。
 */
const CANONICAL_ALIASES = {
  'South Korea': 'Korea Republic',
  'Korea Republic': 'Korea Republic',
  'Czech Republic': 'Czechia',
  Czechia: 'Czechia',
  'Bosnia & Herzegovina': 'Bosnia and Herzegovina',
  'Bosnia and Herzegovina': 'Bosnia and Herzegovina',
  USA: 'United States',
  'United States': 'United States',
  Türkiye: 'Turkiye',
  Turkiye: 'Turkiye',
  Turkey: 'Turkiye',
  'Ivory Coast': "Cote d'Ivoire",
  "Cote d'Ivoire": "Cote d'Ivoire",
  Curaçao: 'Curacao',
  Curacao: 'Curacao',
  'Cape Verde': 'Cabo Verde',
  'Cabo Verde': 'Cabo Verde',
  Iran: 'IR Iran',
  'IR Iran': 'IR Iran',
  'DR Congo': 'Congo DR',
  'Congo DR': 'Congo DR',
};

function canonicalTeamName(name) {
  if (!name) return '';
  return CANONICAL_ALIASES[name] || name;
}

function matchResultKey(date, homeTeam, awayTeam) {
  return `${date}|${canonicalTeamName(homeTeam)}|${canonicalTeamName(awayTeam)}`;
}

module.exports = {
  CANONICAL_ALIASES,
  canonicalTeamName,
  matchResultKey,
};
