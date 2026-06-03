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

export function parseCodesFromString(rawInput: string): { foundPrefix: string; num: number }[] {
  const results: { foundPrefix: string; num: number }[] = [];
  const upperInput = rawInput.toUpperCase();

  const prefixes = [
    'FWC', 'MEX', 'RSA', 'KOR', 'CZE', 'CAN', 'BIH', 'QAT', 'SUI', 'BRA',
    'MAR', 'HAI', 'SCO', 'USA', 'PAR', 'AUS', 'TUR', 'GER', 'CUW', 'CIV',
    'ECU', 'NED', 'JPN', 'SWE', 'TUN', 'BEL', 'EGY', 'IRN', 'NZL', 'ESP',
    'CPV', 'KSA', 'URU', 'FRA', 'SEN', 'IRQ', 'NOR', 'ARG', 'ALG', 'AUT',
    'JOR', 'POR', 'COD', 'UZB', 'COL', 'ENG', 'CRO', 'GHA', 'PAN', 'CC'
  ];
  
  const prefixStr = prefixes.join('|');
  const regex = new RegExp(`(${prefixStr})\\s*[-_\\.]?\\s*([0-9OISBLZ]{1,2})`, 'gi');
  
  let match;
  while ((match = regex.exec(upperInput)) !== null) {
    const rawPrefix = match[1];
    const rawNumStr = match[2];
    
    const cleanNumStr = rawNumStr
      .replace(/O/g, '0')
      .replace(/Q/g, '0')
      .replace(/I/g, '1')
      .replace(/L/g, '1')
      .replace(/S/g, '5')
      .replace(/B/g, '8')
      .replace(/Z/g, '2')
      .replace(/[^0-9]/g, '');
      
    if (cleanNumStr.length > 0) {
      const num = parseInt(cleanNumStr, 10);
      const team = WORLD_CUP_TEAMS.find(t => t.prefix === rawPrefix);
      if (team) {
        const start = team.startNumber ?? 1;
        if (num >= start && num <= team.count) {
          results.push({ foundPrefix: team.prefix, num });
        }
      }
    }
  }

  // Capture standalone "00" or equivalent
  const doubleZeroRegex = /(?:\b|[^A-Z0-9])(00|OO|0O|O0)(?:\b|[^A-Z0-9])/g;
  let dzMatch;
  while ((dzMatch = doubleZeroRegex.exec(upperInput)) !== null) {
    results.push({ foundPrefix: 'FWC', num: 0 });
  }

  // Unique results to stay accurate
  const seen = new Set<string>();
  const uniqueResults: { foundPrefix: string; num: number }[] = [];
  for (const item of results) {
    const key = `${item.foundPrefix}-${item.num}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueResults.push(item);
    }
  }

  return uniqueResults;
}
