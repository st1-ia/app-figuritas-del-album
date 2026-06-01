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
    <div className="w-full max-w-4xl mx-auto pb-24 text-slate-800 font-sans">
      {/* Banner Card - NOT STICKY AS PER USER REQUEST */}
      <div className="px-6 py-6 bg-white border border-slate-200 rounded-2xl shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-4">
          <div className="flex flex-col">
            <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest mb-1 font-mono">Inventario Duplicado</span>
            <h2 className="text-2xl font-display font-black uppercase tracking-tight text-slate-900 mb-2">Repeated</h2>
            <button 
              onClick={copyRepeatedStickers}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-705 bg-white border border-slate-205 rounded-lg py-2 px-3.5 hover:text-slate-950 hover:bg-slate-50 transition-all duration-250 cursor-pointer active:scale-95 shadow-2xs"
            >
              {copied ? <CheckCircle2 size={13} className="text-[#10b981]" /> : <Copy size={13} />}
              {copied ? 'Copiado' : 'Compartir Repetidas'}
            </button>
          </div>
          <div className="text-left sm:text-right flex flex-col">
            <span className="text-4xl font-display font-black text-slate-900 block leading-none">{totalRepeated}</span>
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block mt-1">Cromos listos por cambiar</span>
          </div>
        </div>
        
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={14} className="text-slate-405" />
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-9 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 placeholder-slate-405 focus:outline-none focus:border-slate-800 focus:bg-white text-[16px] md:text-sm transition-all font-sans"
            placeholder="Buscar por equipo o prefijo (ej. ARG)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <X size={14} className="text-slate-400 hover:text-slate-650 transition-colors" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {filteredTeams.length === 0 && (
          <div className="text-center py-10 text-slate-400 font-sans border border-slate-200 border-dashed rounded-xl bg-white p-6">
            No se encontraron equipos para "{searchQuery}"
          </div>
        )}
        
        {filteredTeams.map((team) => {
          const isExpanded = expandedTeam === team.id;
          const repeatedInTeam = getTeamRepeatedCount(team.id);
          const hasRepeated = repeatedInTeam > 0;
          const isCC = team.prefix === 'CC'; // Coca cola uses red
          const accentColor = hasRepeated ? 'text-slate-800' : 'text-slate-500';
          const bgAccentLight = hasRepeated ? 'bg-amber-100/30 hover:bg-amber-100/40' : 'bg-transparent hover:bg-slate-50';
          const hasRepeatedBg = hasRepeated ? bgAccentLight : '';
          const teamStickers = stickersByTeam.get(team.id) || [];

          return (
            <div key={team.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden transition-all duration-200">
              <button
                className={`w-full px-5 py-4 flex items-center justify-between transition-all duration-155 cursor-pointer hover:bg-slate-50 ${hasRepeatedBg}`}
                onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-lg border text-xs font-mono font-bold transition-all duration-200 ${hasRepeated ? `bg-amber-50 border-amber-200 text-amber-700` : 'border-slate-200 text-slate-400 bg-slate-50'}`}>
                    <span className="text-[10px] tracking-widest uppercase font-black">{team.prefix}</span>
                  </div>
                  <div className="flex flex-col items-start leading-tight">
                    <span className={`font-display font-semibold text-sm sm:text-base transition-colors ${hasRepeated ? 'text-slate-900 font-extrabold' : 'text-slate-700'}`}>{team.name}</span>
                    <span className="text-[7.5px] uppercase tracking-wider text-slate-400 font-bold font-mono mt-0.5">Grupo {team.id === 'fwc' || team.id === 'coc' ? 'Especial' : team.id.toUpperCase()}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end leading-none">
                     <span className={`text-xl font-display font-black transition-colors ${hasRepeated ? 'text-slate-900' : 'text-slate-400'}`}>
                       {repeatedInTeam}
                     </span>
                     <span className="text-[7.5px] uppercase tracking-wider text-slate-400 font-bold mt-1">repetidas</span>
                  </div>
                  {isExpanded ? <ChevronDown size={14} className="text-slate-450" /> : <ChevronRight size={14} className="text-slate-455" />}
                </div>
              </button>

              {isExpanded && (
                <div className="p-4 bg-slate-50/80 border-t border-slate-150 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-10 gap-2 animate-in slide-in-from-top-1 duration-200">
                  {teamStickers.map((sticker) => {
                    const number = sticker.number === 0 ? '00' : sticker.number;
                    const stickerId = sticker.id;
                    const count = repeatedStickers[stickerId] || 0;
                    const isRepeated = count > 0;
                    const isOwned = ownedStickers.has(stickerId);
                    
                    const stickerStyle = isRepeated
                      ? isCC
                        ? 'bg-red-55 border-red-200 text-red-700 font-bold'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold shadow-inner'
                      : isOwned
                        ? 'bg-white border-slate-200 text-slate-400 hover:border-slate-350 hover:text-slate-800 cursor-pointer'
                        : 'opacity-20 cursor-not-allowed bg-slate-100/50 border-slate-100 text-slate-300';

                    const countColorBadge = isCC ? 'bg-red-550 text-white' : 'bg-emerald-500 text-white';

                    return (
                      <div
                        key={stickerId}
                        className={`
                          relative flex flex-col items-center justify-center p-2 rounded-lg py-3.5 border transition-all duration-150 uppercase tracking-widest overflow-hidden select-none text-xs
                          ${stickerStyle}
                        `}
                        onClick={!isRepeated && isOwned ? () => updateRepeated(stickerId, 1) : undefined}
                      >
                        <span className={`text-[7px] font-mono font-bold ${isRepeated ? (isCC ? 'text-red-500' : 'text-emerald-700') : 'text-slate-400'} mb-0.5`}>{sticker.prefix}</span>
                        <span className={`text-base font-display font-black leading-none ${isRepeated ? 'text-slate-900 font-extrabold' : 'text-slate-505'}`}>{number}</span>
                        
                        {isRepeated && (
                          <>
                            <div className="absolute top-0 right-0 px-2 py-0.5 bg-slate-900 rounded-bl-sm text-white">
                              <span className="font-display font-black text-[9px]">x{count}</span>
                            </div>
                            <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-1 mt-1.5">
                              <button 
                                onClick={(e) => { e.stopPropagation(); updateRepeated(stickerId, -1); }}
                                className="w-5 h-5 rounded bg-white border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer shadow-xs active:scale-90"
                              >
                                <Minus size={8} strokeWidth={3} />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); updateRepeated(stickerId, 1); }}
                                className="w-5 h-5 rounded bg-white border border-slate-205 text-slate-600 flex items-center justify-center hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer shadow-xs active:scale-90"
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
