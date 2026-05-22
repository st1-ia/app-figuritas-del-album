import React, { useState, useMemo } from 'react';
import { WORLD_CUP_TEAMS, getAllStickers, StickerDef } from '../data/stickers';
import { Check, ChevronDown, ChevronRight, Search, X, Copy, CheckCircle2 } from 'lucide-react';

interface AlbumProps {
  ownedStickers: Set<string>;
  toggleOwned: (id: string) => void;
}

export default function Album({ ownedStickers, toggleOwned }: AlbumProps) {
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

  const getTeamProgress = (teamId: string) => {
    const teamStickers = stickersByTeam.get(teamId) || [];
    let ownedCount = 0;
    for (const s of teamStickers) {
      if (ownedStickers.has(s.id)) ownedCount++;
    }
    return ownedCount;
  };

  const copyMissingStickers = async () => {
    let missing: string[] = [];
    WORLD_CUP_TEAMS.forEach(team => {
        const teamMissing: string[] = [];
        const teamStickers = stickersByTeam.get(team.id) || [];
        for (const s of teamStickers) {
            if (!ownedStickers.has(s.id)) {
                teamMissing.push(s.number === 0 ? '00' : s.number.toString());
            }
        }
        if (teamMissing.length > 0) {
            missing.push(`${team.prefix}: ${teamMissing.join(', ')}`);
        }
    });

    const textToCopy = missing.length > 0
      ? `Me faltan estas figuritas:\n\n${missing.join('\n')}`
      : `¡Ya tengo todas las figuritas! 🎉`;

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
            <h2 className="text-3xl font-display uppercase tracking-wider text-white mb-2">Mi Álbum</h2>
            <button 
              onClick={copyMissingStickers}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00FF00] hover:text-white transition-all bg-[#00FF00]/10 hover:bg-[#00FF00]/20 py-2.5 px-4 rounded-xl border border-[#00FF00]/20 w-fit cursor-pointer active:scale-95"
            >
              {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
              {copied ? 'Copiado al portapapeles' : 'Copiar Faltantes'}
            </button>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-4xl font-display text-[#00FF00] block leading-none drop-shadow-[0_0_12px_rgba(0,255,0,0.4)]">{ownedStickers.size}</span>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mt-1">de {stickers.length} cromos coleccionados</span>
          </div>
        </div>
        
        <div className="mt-3 w-full bg-zinc-950 rounded-full h-2.5 overflow-hidden relative mb-6 border border-zinc-800/60">
          <div 
            className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-[#00FF00] via-[#00FFFF] to-[#00FF00] bg-[length:200%_auto] animate-[shimmer_3s_infinite_linear] transition-all duration-700 ease-out rounded-full"
            style={{ width: `${(ownedStickers.size / stickers.length) * 100}%` }}
          ></div>
        </div>
        
        <div className="relative">
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
          const teamStickers = stickersByTeam.get(team.id) || [];
          const ownedInTeam = getTeamProgress(team.id);
          const isComplete = ownedInTeam === teamStickers.length;
          const isCC = team.prefix === 'CC'; // Coca cola uses red
          const accentColor = isCC ? 'text-[#F40009]' : 'text-[#00FF00]';
          const bgAccentLight = isCC ? 'bg-[#F40009]/15' : 'bg-[#00FF00]/12';
          const bgAccentHover = isCC ? 'hover:bg-zinc-800/40' : 'hover:bg-zinc-800/40';

          return (
            <div key={team.id} className="bg-zinc-900/40 rounded-2xl overflow-hidden border border-zinc-800/80 transition-all duration-300 hover:border-zinc-700/80 hover:shadow-lg">
              <button
                className={`w-full px-5 py-5 flex items-center justify-between transition-all duration-200 cursor-pointer ${bgAccentHover} ${isComplete ? bgAccentLight : ''}`}
                onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${isComplete ? `border-transparent ${bgAccentLight} ${accentColor}` : 'border-zinc-800 text-zinc-400 BG-zinc-900'}`}>
                    {isComplete ? <Check size={20} className="stroke-[3]" /> : <span className="text-xs font-display tracking-wider uppercase">{team.prefix}</span>}
                  </div>
                  <span className={`font-semibold text-base sm:text-lg transition-colors ${isComplete ? 'text-white' : 'text-zinc-300'}`}>{team.name}</span>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end">
                     <span className={`text-xl font-display leading-none transition-colors ${isComplete ? accentColor : 'text-white'}`}>
                       {ownedInTeam}
                     </span>
                     <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">de {teamStickers.length}</span>
                  </div>
                  {isExpanded ? <ChevronDown size={22} className="text-zinc-500" /> : <ChevronRight size={22} className="text-zinc-500" />}
                </div>
              </button>

              {isExpanded && (
                <div className="p-5 bg-zinc-950/60 border-t border-zinc-800 grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3">
                  {teamStickers.map((sticker) => {
                    const number = sticker.number === 0 ? '00' : sticker.number;
                    const stickerId = sticker.id;
                    const isOwned = ownedStickers.has(stickerId);
                    
                    const stickerColorClass = isCC 
                      ? 'from-[#F40009]/15 to-[#F40009]/3 border-[#F40009]/60 hover:from-[#F40009]/20 shadow-[0_0_15px_rgba(244,0,9,0.15)]' 
                      : 'from-[#00FF00]/15 to-transparent border-[#00FF00]/60 hover:from-[#00FF00]/20 shadow-[0_0_15px_rgba(0,255,0,0.15)]';
                    const checkColorClass = isCC ? 'bg-[#F40009] text-white' : 'bg-[#00FF00] text-black';

                    return (
                      <button
                        key={stickerId}
                        onClick={() => toggleOwned(stickerId)}
                        className={`
                          relative flex flex-col items-center justify-center p-2 rounded-xl py-4 border-2 transition-all duration-200 uppercase tracking-wider overflow-hidden cursor-pointer active:scale-95
                          ${isOwned 
                            ? `bg-gradient-to-b ${stickerColorClass} scale-102 font-bold` 
                            : 'bg-zinc-950/40 border-zinc-800/80 text-zinc-500 hover:border-zinc-700/80 hover:text-zinc-300 hover:bg-zinc-900/60'}
                        `}
                      >
                        <span className={`text-[8px] font-bold ${isOwned ? (isCC ? 'text-[#F40009]' : 'text-[#00FF00]') : 'text-zinc-600'}`}>{sticker.prefix}</span>
                        <span className={`text-xl font-display mt-0.5 ${isOwned ? 'text-white' : 'text-zinc-400'}`}>{number}</span>
                        {isOwned && (
                          <div className={`absolute top-0 right-0 w-5.5 h-5.5 flex items-center justify-center rounded-bl-lg ${checkColorClass}`}>
                            <Check size={10} strokeWidth={4} />
                          </div>
                        )}
                      </button>
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
