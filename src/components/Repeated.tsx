import React, { useState, useMemo } from 'react';
import { WORLD_CUP_TEAMS, getAllStickers, StickerDef } from '../data/stickers';
import { ChevronDown, ChevronRight, Search, X, Copy, CheckCircle2, Plus, Minus, Users, HelpCircle, PackageOpen } from 'lucide-react';

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
    <div className="w-full max-w-4xl mx-auto pb-24 text-neutral-100 font-sans px-2 sm:px-4 select-none">
      {/* Banner / Header Card */}
      <div className="px-4 py-5 sm:px-6 sm:py-6 bg-neutral-950/70 border border-neutral-900 rounded-2xl shadow-[0_0_15px_rgba(245,158,11,0.05)] mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 mb-4">
          <div className="flex flex-col w-full sm:w-auto">
            <span className="text-[9.5px] font-bold text-neutral-500 uppercase tracking-widest mb-1 font-mono">Inventario de Duplicados</span>
            <h2 className="text-2xl font-display font-black uppercase tracking-tight text-white mb-2 leading-none">Repetidas</h2>
            <button 
              onClick={copyRepeatedStickers}
              className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-300 bg-neutral-900/50 border border-neutral-850 hover:border-amber-500/50 hover:bg-amber-500/5 hover:text-amber-400 rounded-lg py-2 px-3.5 transition-all duration-200 cursor-pointer active:scale-95 shadow-2xs w-full sm:w-auto"
            >
              {copied ? <CheckCircle2 size={13} className="text-neon-green animate-pulse" /> : <Copy size={13} />}
              {copied ? 'Copiado' : 'Compartir Listado'}
            </button>
          </div>
          <div className="text-left sm:text-right flex items-center sm:items-end justify-between sm:justify-start sm:flex-col w-full sm:w-auto border-t border-neutral-900 sm:border-0 pt-2 sm:pt-0">
            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block sm:mb-1">
              Cantidad total
            </span>
            <div className="flex items-baseline gap-1 bg-neutral-900/35 border border-neutral-900 px-3 py-1 rounded-xl sm:bg-transparent sm:border-0 sm:p-0">
              <span className="text-2xl sm:text-4xl font-display font-black text-amber-500 block leading-none filter drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]">
                {totalRepeated}
              </span>
              <span className="text-[9px] text-neutral-500 font-mono font-bold uppercase ml-1">para canjear</span>
            </div>
          </div>
        </div>
        
        {/* Search tool */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={14} className="text-neutral-500" />
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-9 py-2.5 border border-neutral-850 rounded-xl bg-neutral-950/60 text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500 focus:bg-neutral-900/40 text-[16px] md:text-sm transition-all font-sans focus:shadow-[0_0_12px_rgba(245,158,11,0.15)]"
            placeholder="Buscar por país o prefijo (ej. ARG, BRA)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <X size={14} className="text-neutral-500 hover:text-neutral-300 transition-colors" />
            </button>
          )}
        </div>
      </div>

      {/* Main Teams List */}
      <div className="space-y-3">
        {filteredTeams.length === 0 ? (
          <div className="text-center py-10 text-neutral-500 font-sans border border-neutral-800 border-dashed rounded-xl bg-neutral-950/40 p-6">
            No se encontraron países para "{searchQuery}"
          </div>
        ) : (
          filteredTeams.map((team) => {
            const isExpanded = expandedTeam === team.id;
            const repeatedInTeam = getTeamRepeatedCount(team.id);
            const hasRepeated = repeatedInTeam > 0;
            const isCC = team.prefix === 'CC'; // Coca cola special
            
            const badgeBg = hasRepeated
              ? 'bg-amber-500/15 border-amber-500/35 text-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.15)] text-amber-glow'
              : 'border-neutral-805 text-neutral-500 bg-neutral-900/80';

            const bgHighlight = hasRepeated
              ? 'bg-amber-500/[0.01] hover:bg-amber-500/[0.04]'
              : 'bg-transparent hover:bg-neutral-900/35';

            const teamStickers = stickersByTeam.get(team.id) || [];

            return (
              <div key={team.id} className="bg-neutral-950/45 rounded-xl border border-neutral-900 overflow-hidden transition-all duration-250 hover:border-neutral-850 hover:shadow-[0_0_12px_rgba(0,0,0,0.5)]">
                <button
                  className={`w-full px-4 py-3.5 sm:px-5 sm:py-4 flex items-center justify-between transition-all duration-150 cursor-pointer ${bgHighlight}`}
                  onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg border text-xs font-mono font-bold transition-all duration-200 ${badgeBg}`}>
                      <span className="text-[10px] uppercase font-black">{team.prefix}</span>
                    </div>
                    <div className="flex flex-col items-start leading-tight">
                      <span className={`font-display font-semibold text-xs sm:text-sm ${hasRepeated ? 'text-amber-400 font-extrabold' : 'text-neutral-300'}`}>{team.name}</span>
                      <span className="text-[7.5px] uppercase tracking-wider text-neutral-500 font-mono font-bold mt-0.5">Grupo {team.id === 'fwc' || team.id === 'coc' ? 'Especial' : team.id.toUpperCase()}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end leading-none">
                       <span className={`text-xl font-display font-black ${hasRepeated ? 'text-amber-400' : 'text-neutral-550'}`}>
                         {repeatedInTeam}
                       </span>
                       <span className="text-[7.5px] uppercase tracking-wider text-neutral-500 font-bold mt-0.5">repetidas</span>
                    </div>
                    {isExpanded ? <ChevronDown size={14} className="text-neutral-500" /> : <ChevronRight size={14} className="text-neutral-500" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-4 bg-neutral-950/90 border-t border-neutral-900 animate-in slide-in-from-top-1 duration-200">
                    <p className="text-[8.5px] text-neutral-500 font-sans uppercase tracking-wider font-semibold mb-3">
                       🎯 Tocá un cromo de tu álbum para sumarlo a repetidas, o regulá la cantidad:
                    </p>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-10 gap-1.5 sm:gap-2">
                      {teamStickers.map((sticker) => {
                        const number = sticker.number === 0 ? '00' : sticker.number;
                        const stickerId = sticker.id;
                        const count = repeatedStickers[stickerId] || 0;
                        const isRepeated = count > 0;
                        const isOwned = ownedStickers.has(stickerId);
                        
                        const stickerStyle = isRepeated
                          ? isCC
                            ? 'bg-red-950/30 border-red-500/40 text-red-300 font-bold shadow-[0_0_6px_rgba(239,68,68,0.15)]'
                            : 'bg-amber-500/5 border-amber-500/45 text-amber-400 font-bold shadow-[0_0_8px_rgba(242,158,11,0.15)] text-amber-glow'
                          : isOwned
                            ? 'bg-neutral-950/50 border-neutral-850 hover:border-amber-500/40 hover:text-amber-400 cursor-pointer text-neutral-450 hover:shadow-[0_0_8px_rgba(242,158,11,0.1)]'
                            : 'opacity-15 cursor-not-allowed bg-neutral-900/20 border-neutral-950 text-neutral-600';

                        return (
                          <div
                            key={stickerId}
                            className={`
                              relative flex flex-col items-center justify-center p-2 rounded-lg py-2.5 border transition-all duration-150 uppercase tracking-widest overflow-hidden select-none text-xs
                              ${stickerStyle}
                            `}
                            onClick={!isRepeated && isOwned ? () => updateRepeated(stickerId, 1) : undefined}
                          >
                            <span className={`text-[7px] font-mono font-bold ${isRepeated ? (isCC ? 'text-red-400' : 'text-amber-500') : 'text-neutral-600'} mb-0.5`}>{sticker.prefix}</span>
                            <span className={`text-sm sm:text-base font-display font-black leading-none ${isRepeated ? 'text-white font-extrabold' : 'text-neutral-500'}`}>{number}</span>
                            
                            {isRepeated && (
                              <>
                                <div className="absolute top-0 right-0 px-1 py-0.2 bg-black/80 rounded-bl text-white border-l border-b border-neutral-900 leading-none">
                                  <span className="font-display font-black text-[8px]">x{count}</span>
                                </div>
                                <div className="flex gap-1.5 mt-2 z-10">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); updateRepeated(stickerId, -1); }}
                                    className="w-4.5 h-4.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300 flex items-center justify-center hover:bg-neutral-800 hover:text-white transition-all cursor-pointer shadow-xs active:scale-90"
                                  >
                                    <Minus size={8} strokeWidth={3} />
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); updateRepeated(stickerId, 1); }}
                                    className="w-4.5 h-4.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300 flex items-center justify-center hover:bg-neutral-800 hover:text-white transition-all cursor-pointer shadow-xs active:scale-90"
                                  >
                                    <Plus size={8} strokeWidth={3} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
