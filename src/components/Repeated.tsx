import React, { useState, useMemo } from 'react';
import { WORLD_CUP_TEAMS, getAllStickers, StickerDef } from '../data/stickers';
import { Check, ChevronDown, ChevronRight, Search, X, Copy, CheckCircle2, Plus, Minus } from 'lucide-react';

interface RepeatedProps {
  ownedStickers: Set<string>;
  repeatedStickers: Record<string, number>;
  updateRepeated: (id: string, delta: number) => void;
}

export default function Repeated({ ownedStickers, repeatedStickers, updateRepeated }: RepeatedProps) {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  
  const stickers = getAllStickers();
  const stickersByTeam = useMemo(() => {
    const map = new Map<string, StickerDef[]>();
    for (const s of stickers) {
      if (!map.has(s.teamId)) map.set(s.teamId, []);
      map.get(s.teamId)!.push(s);
    }
    return map;
  }, [stickers]);

  const totalRepeated = Object.values(repeatedStickers).reduce((acc, count) => acc + count, 0);
  
  const getTeamRepeatedCount = (teamId: string) => {
    let repeatedCount = 0;
    const teamStickers = stickersByTeam.get(teamId) || [];
    for (const s of teamStickers) {
      repeatedCount += (repeatedStickers[s.id] || 0);
    }
    return repeatedCount;
  };

  const copyRepeatedStickers = async () => {
    let repeated: string[] = [];
    WORLD_CUP_TEAMS.forEach(team => {
        const teamRepeated: string[] = [];
        const teamStickers = stickersByTeam.get(team.id) || [];
        for (const s of teamStickers) {
            const count = repeatedStickers[s.id] || 0;
            if (count > 0) {
                const number = s.number === 0 ? '00' : s.number.toString();
                teamRepeated.push(count > 1 ? `${number} (x${count})` : `${number}`);
            }
        }
        if (teamRepeated.length > 0) {
            repeated.push(`${team.prefix}: ${teamRepeated.join(', ')}`);
        }
    });

    const textToCopy = repeated.length > 0
      ? `Estas son mis figuritas repetidas para cambiar:\n\n${repeated.join('\n')}`
      : `Por el momento no tengo figuritas repetidas.`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const filteredTeams = useMemo(() => {
    if (!searchQuery.trim()) return WORLD_CUP_TEAMS;
    
    const query = searchQuery.toLowerCase().trim();
    return WORLD_CUP_TEAMS.filter(
      team => 
        team.name.toLowerCase().includes(query) || 
        team.prefix.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  return (
    <div className="w-full max-w-4xl mx-auto pb-24">
      {/* Premium Dashboard Banner */}
      <div className="px-6 py-6 bg-zinc-900/60 backdrop-blur-xl shadow-2xl rounded-2xl border border-zinc-800/80 mb-8 sticky top-[72px] z-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-5">
          <div className="flex flex-col">
            <h2 className="text-3xl font-display uppercase tracking-wider text-white mb-2">Repetidas</h2>
            <button 
              onClick={copyRepeatedStickers}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00FF00] hover:text-white transition-all bg-[#00FF00]/10 hover:bg-[#00FF00]/20 py-2.5 px-4 rounded-xl border border-[#00FF00]/20 w-fit cursor-pointer active:scale-95"
            >
              {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
              {copied ? 'Copiado al portapapeles' : 'Compartir Repetidas'}
            </button>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-4xl font-display text-[#00FF00] block leading-none drop-shadow-[0_0_12px_rgba(0,255,0,0.4)]">{totalRepeated}</span>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mt-1">Cromos repetidos listos para cambiar</span>
          </div>
        </div>
        
        <div className="relative mt-4">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search size={18} className="text-zinc-500" />
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-10 py-3.5 border border-zinc-800 rounded-xl bg-zinc-950/70 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#00FF00] focus:ring-1 focus:ring-[#00FF00] text-sm transition-all font-sans"
            placeholder="Buscar por equipo o prefijo (ej. ARG)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center"
            >
              <X size={18} className="text-zinc-500 hover:text-white transition-colors" />
            </button>
          )}
        </div>
      </div>

      <div className="px-2 space-y-4">
        {filteredTeams.length === 0 && (
          <div className="text-center py-10 text-zinc-500 font-sans">
            No se encontraron equipos para "{searchQuery}"
          </div>
        )}
        
        {filteredTeams.map((team) => {
          const isExpanded = expandedTeam === team.id;
          const repeatedInTeam = getTeamRepeatedCount(team.id);
          const hasRepeated = repeatedInTeam > 0;
          const isCC = team.prefix === 'CC'; // Coca cola uses red
          const accentColor = isCC ? 'text-[#F40009]' : 'text-[#00FF00]';
          const bgAccentLight = isCC ? 'bg-[#F40009]/15' : 'bg-[#00FF00]/12';
          const bgAccentHover = isCC ? 'hover:bg-zinc-800/40' : 'hover:bg-zinc-800/40';
          const teamStickers = stickersByTeam.get(team.id) || [];

          return (
            <div key={team.id} className="bg-zinc-900/40 rounded-2xl overflow-hidden border border-zinc-800/80 transition-all duration-300 hover:border-zinc-700/80 hover:shadow-lg">
              <button
                className={`w-full px-5 py-5 flex items-center justify-between transition-all duration-200 cursor-pointer ${bgAccentHover} ${hasRepeated ? bgAccentLight : ''}`}
                onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${hasRepeated ? `border-transparent ${bgAccentLight} ${accentColor}` : 'border-zinc-800 text-zinc-500'}`}>
                    <span className="text-xs font-display tracking-wider uppercase">{team.prefix}</span>
                  </div>
                  <span className={`font-semibold text-base sm:text-lg transition-colors ${hasRepeated ? 'text-white' : 'text-zinc-300'}`}>{team.name}</span>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end">
                     <span className={`text-xl font-display leading-none transition-colors ${hasRepeated ? accentColor : 'text-white'}`}>
                       {repeatedInTeam}
                     </span>
                     <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">repetidas</span>
                  </div>
                  {isExpanded ? <ChevronDown size={22} className="text-zinc-500" /> : <ChevronRight size={22} className="text-zinc-500" />}
                </div>
              </button>

              {isExpanded && (
                <div className="p-5 bg-zinc-950/60 border-t border-zinc-800 grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3">
                  {teamStickers.map((sticker) => {
                    const number = sticker.number === 0 ? '00' : sticker.number;
                    const stickerId = sticker.id;
                    const count = repeatedStickers[stickerId] || 0;
                    const isRepeated = count > 0;
                    const isOwned = ownedStickers.has(stickerId);
                    
                    const stickerColorClass = isCC 
                      ? 'from-[#F40009]/15 to-transparent border-[#F40009]/60 hover:from-[#F40009]/20 shadow-[0_0_15px_rgba(244,0,9,0.15)]' 
                      : 'from-[#00FF00]/15 to-transparent border-[#00FF00]/60 hover:from-[#00FF00]/20 shadow-[0_0_15px_rgba(0,255,0,0.15)]';
                    const checkColorClass = isCC ? 'bg-[#F40009] text-white' : 'bg-[#00FF00] text-black';

                    return (
                      <div
                        key={stickerId}
                        className={`
                          relative flex flex-col items-center justify-center p-2 rounded-xl py-4 border-2 transition-all duration-200 uppercase tracking-wider overflow-hidden
                          ${isRepeated 
                            ? `bg-gradient-to-b ${stickerColorClass} scale-102 font-bold` 
                            : `bg-zinc-950/30 border-zinc-850 text-zinc-600 ${isOwned ? 'hover:border-zinc-700/80 hover:text-zinc-300 cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
                        `}
                        onClick={!isRepeated && isOwned ? () => updateRepeated(stickerId, 1) : undefined}
                      >
                        <span className={`text-[8px] font-bold ${isRepeated ? (isCC ? 'text-[#F40009]' : 'text-[#00FF00]') : 'text-zinc-600'}`}>{sticker.prefix}</span>
                        <span className={`text-xl font-display mt-0.5 ${isRepeated ? 'text-white' : 'text-zinc-500'}`}>{number}</span>
                        
                        {isRepeated && (
                          <>
                            <div className={`absolute top-0 right-0 px-2 py-0.5 flex items-center justify-center rounded-bl-lg ${checkColorClass}`}>
                              <span className="font-display font-bold text-xs">x{count}</span>
                            </div>
                            <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-2 mt-2">
                              <button 
                                onClick={(e) => { e.stopPropagation(); updateRepeated(stickerId, -1); }}
                                className="w-5.5 h-5.5 rounded-full bg-zinc-900/90 border border-zinc-800 flex items-center justify-center text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all cursor-pointer"
                              >
                                <Minus size={10} strokeWidth={3} />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); updateRepeated(stickerId, 1); }}
                                className="w-5.5 h-5.5 rounded-full bg-zinc-900/90 border border-zinc-800 flex items-center justify-center text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all cursor-pointer"
                              >
                                <Plus size={10} strokeWidth={3} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
