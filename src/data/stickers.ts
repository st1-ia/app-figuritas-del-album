export interface TeamDef {
  id: string;
  name: string;
  prefix: string;
  count: number;
  startNumber?: number;
}

export const WORLD_CUP_TEAMS: TeamDef[] = [
  { id: 'fwc', name: 'Especiales / FIFA', prefix: 'FWC', count: 19, startNumber: 0 },
  // Group A
  { id: 'mex', name: 'Mexico', prefix: 'MEX', count: 20 },
  { id: 'rsa', name: 'South Africa', prefix: 'RSA', count: 20 },
  { id: 'kor', name: 'Korea Republic', prefix: 'KOR', count: 20 },
  { id: 'cze', name: 'Czechia', prefix: 'CZE', count: 20 },
  // Group B
  { id: 'can', name: 'Canada', prefix: 'CAN', count: 20 },
  { id: 'bih', name: 'Bosnia-Herzegovina', prefix: 'BIH', count: 20 },
  { id: 'qat', name: 'Qatar', prefix: 'QAT', count: 20 },
  { id: 'sui', name: 'Switzerland', prefix: 'SUI', count: 20 },
  // Group C
  { id: 'bra', name: 'Brazil', prefix: 'BRA', count: 20 },
  { id: 'mar', name: 'Morocco', prefix: 'MAR', count: 20 },
  { id: 'hai', name: 'Haiti', prefix: 'HAI', count: 20 },
  { id: 'sco', name: 'Scotland', prefix: 'SCO', count: 20 },
  // Group D
  { id: 'usa', name: 'USA', prefix: 'USA', count: 20 },
  { id: 'par', name: 'Paraguay', prefix: 'PAR', count: 20 },
  { id: 'aus', name: 'Australia', prefix: 'AUS', count: 20 },
  { id: 'tur', name: 'Türkiye', prefix: 'TUR', count: 20 },
  // Group E
  { id: 'ger', name: 'Germany', prefix: 'GER', count: 20 },
  { id: 'cuw', name: 'Curaçao', prefix: 'CUW', count: 20 },
  { id: 'civ', name: 'Côte d\'Ivoire', prefix: 'CIV', count: 20 },
  { id: 'ecu', name: 'Ecuador', prefix: 'ECU', count: 20 },
  // Group F
  { id: 'ned', name: 'Netherlands', prefix: 'NED', count: 20 },
  { id: 'jpn', name: 'Japan', prefix: 'JPN', count: 20 },
  { id: 'swe', name: 'Sweden', prefix: 'SWE', count: 20 },
  { id: 'tun', name: 'Tunisia', prefix: 'TUN', count: 20 },
  // Group G
  { id: 'bel', name: 'Belgium', prefix: 'BEL', count: 20 },
  { id: 'egy', name: 'Egypt', prefix: 'EGY', count: 20 },
  { id: 'irn', name: 'IR Iran', prefix: 'IRN', count: 20 },
  { id: 'nzl', name: 'New Zealand', prefix: 'NZL', count: 20 },
  // Group H
  { id: 'esp', name: 'Spain', prefix: 'ESP', count: 20 },
  { id: 'cpv', name: 'Cabo Verde', prefix: 'CPV', count: 20 },
  { id: 'ksa', name: 'Saudi Arabia', prefix: 'KSA', count: 20 },
  { id: 'uru', name: 'Uruguay', prefix: 'URU', count: 20 },
  // Group I
  { id: 'fra', name: 'France', prefix: 'FRA', count: 20 },
  { id: 'sen', name: 'Senegal', prefix: 'SEN', count: 20 },
  { id: 'irq', name: 'Iraq', prefix: 'IRQ', count: 20 },
  { id: 'nor', name: 'Norway', prefix: 'NOR', count: 20 },
  // Group J
  { id: 'arg', name: 'Argentina', prefix: 'ARG', count: 20 },
  { id: 'alg', name: 'Algeria', prefix: 'ALG', count: 20 },
  { id: 'aut', name: 'Austria', prefix: 'AUT', count: 20 },
  { id: 'jor', name: 'Jordan', prefix: 'JOR', count: 20 },
  // Group K
  { id: 'por', name: 'Portugal', prefix: 'POR', count: 20 },
  { id: 'cod', name: 'Congo DR', prefix: 'COD', count: 20 },
  { id: 'uzb', name: 'Uzbekistan', prefix: 'UZB', count: 20 },
  { id: 'col', name: 'Colombia', prefix: 'COL', count: 20 },
  // Group L
  { id: 'eng', name: 'England', prefix: 'ENG', count: 20 },
  { id: 'cro', name: 'Croatia', prefix: 'CRO', count: 20 },
  { id: 'gha', name: 'Ghana', prefix: 'GHA', count: 20 },
  { id: 'pan', name: 'Panama', prefix: 'PAN', count: 20 },
  // Especiales / Patrocinadores
  { id: 'coc', name: 'Coca-Cola', prefix: 'CC', count: 14 },
];

export interface StickerDef {
  id: string;      // e.g. "ARG-10"
  prefix: string;  // e.g. "ARG"
  number: number;  // e.g. 10
  displayName: string; // e.g. "ARG 10"
  teamId: string;
}

export const getAllStickers = (): StickerDef[] => {
  const stickers: StickerDef[] = [];
  WORLD_CUP_TEAMS.forEach(team => {
    const start = team.startNumber ?? 1;
    for (let i = start; i <= team.count; i++) {
      const isZeroZero = i === 0 && team.prefix === 'FWC';
      stickers.push({
        id: isZeroZero ? '00' : `${team.prefix}-${i}`,
        prefix: isZeroZero ? '00' : team.prefix,
        number: i,
        displayName: isZeroZero ? '00' : `${team.prefix} ${i}`,
        teamId: team.id
      });
    }
  });
  return stickers;
};
