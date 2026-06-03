import React, { useState, useMemo } from 'react';
import { WORLD_CUP_TEAMS, getAllStickers, StickerDef } from '../data/stickers';
import { ChevronDown, ChevronRight, Search, X, Copy, CheckCircle2, Trophy, LayoutGrid, FolderTree, AlignLeft } from 'lucide-react';

interface MissingProps {
  ownedStickers: Set<string>;
  toggleOwned: (id: string) => void;
}

export default function Missing({ ownedStickers, toggleOwned }: MissingProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('flat');
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const stickers = getAllStickers();
  const missingStickers = useMemo(() => {
    return stickers.filter(s => !ownedStickers.has(s.id));
  }, [stickers, ownedStickers]);

  const stickersByTeam = useMemo(() => {
    const map = new Map<string, StickerDef[]>();
    for (const s of missingStickers) {
      if (!map.has(s.teamId)) map.set(s.teamId, []);
      map.get(s.teamId)!.push(s);
    }
    return map;
  }, [missingStickers]);

  const filteredTeams = useMemo(() => {
    if (!searchQuery.trim()) return WORLD_CUP_TEAMS;
    
    const query = searchQuery.toLowerCase().trim();
    return WORLD_CUP_TEAMS.filter(
      team => 
        team.name.toLowerCase().includes(query) || 
        team.prefix.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const flatFilteredStickers = useMemo(() => {
    if (!searchQuery.trim()) return missingStickers;
    const query = searchQuery.toLowerCase().trim();
    return missingStickers.filter(s => 
      s.prefix.toLowerCase().includes(query) || 
      s.displayName.toLowerCase().includes(query) ||
      (s.number === 0 ? '00' : s.number.toString()).includes(query)
    );
  }, [missingStickers, searchQuery]);

  const copyMissingStickers = async () => {
    let missing: string[] = [];
    WORLD_CUP_TEAMS.forEach(team => {
        const teamMissing: string[] = [];
        const teamStickers = stickers.filter(s => s.teamId === team.id);
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

  const handleGroupAction = (action: 'expand' | 'collapse') => {
    if (action === 'collapse') {
      setExpandedTeam(null);
    } else {
      // expand first active team as generic or let user select, 
      // but toggleOwned on single clicks is already perfect.
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto pb-24 text-neutral-100 font-sans px-2 sm:px-4 select-none">
      {/* Summary Header banner */}
      <div className="px-4 py-5 sm:px-6 sm:py-6 bg-neutral-950/70 border border-neutral-900 rounded-2xl shadow-[0_0_15px_rgba(255,0,127,0.05)] mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 mb-4">
          <div className="flex flex-col w-full sm:w-auto">
            <span className="text-[9.5px] font-bold text-neutral-500 uppercase tracking-widest mb-1 font-mono">Listado Dinámico</span>
            <h2 className="text-2xl font-display font-black uppercase tracking-tight text-white mb-2 leading-none">Faltantes</h2>
            <button 
              onClick={copyMissingStickers}
              className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-300 bg-neutral-900/50 border border-neutral-850 hover:border-neon-cyan/50 hover:bg-neon-cyan/5 hover:text-neon-cyan rounded-lg py-2 px-3.5 transition-all duration-200 cursor-pointer active:scale-95 shadow-2xs w-full sm:w-auto"
            >
              {copied ? <CheckCircle2 size={13} className="text-neon-green animate-pulse" /> : <Copy size={13} />}
              {copied ? 'Copiado' : 'Copiar Listado'}
            </button>
          </div>
          <div className="text-left sm:text-right flex items-center sm:items-end justify-between sm:justify-start sm:flex-col w-full sm:w-auto border-t border-neutral-900 sm:border-0 pt-2 sm:pt-0">
            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block sm:mb-1">
              Por conseguir
            </span>
            <div className="flex items-baseline gap-1 bg-neutral-900/35 border border-neutral-900 px-3 py-1 rounded-xl sm:bg-transparent sm:border-0 sm:p-0">
              <span className="text-2xl sm:text-4xl font-display font-black text-neon-pink text-neon-pink-glow block leading-none">
                {missingStickers.length}
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">/ {stickers.length}</span>
            </div>
          </div>
        </div>

        {/* View mode toggle switch */}
        <div className="grid grid-cols-2 gap-1.5 bg-neutral-900/60 p-[3px] rounded-xl border border-neutral-850 mb-4">
          <button
            type="button"
            onClick={() => setViewMode('flat')}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[10px] uppercase font-display font-black tracking-wider transition-all cursor-pointer ${viewMode === 'flat' ? 'bg-neutral-800 text-neon-cyan shadow-[0_0_8px_rgba(0,243,255,0.15)] border border-neutral-750 text-neon-cyan-glow' : 'text-neutral-550 hover:text-neutral-300'}`}
          >
            <LayoutGrid size={12} />
            Vista Cuadrícula (Solo Faltantes)
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grouped')}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[10px] uppercase font-display font-black tracking-wider transition-all cursor-pointer ${viewMode === 'grouped' ? 'bg-neutral-800 text-neon-cyan shadow-[0_0_8px_rgba(0,243,255,0.15)] border border-neutral-750 text-neon-cyan-glow' : 'text-neutral-550 hover:text-neutral-300'}`}
          >
            <FolderTree size={12} />
            Agrupado por País
          </button>
        </div>

        {/* Search bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={14} className="text-neutral-500" />
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-9 py-2.5 border border-neutral-850 rounded-xl bg-neutral-950/60 text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neon-cyan focus:bg-neutral-900/40 text-[16px] md:text-sm transition-all font-sans focus:shadow-[0_0_12px_rgba(0,243,255,0.15)]"
            placeholder={viewMode === 'flat' ? "Buscar por código o número (ej: BRA, arg 10, 15)..." : "Buscar grupo o país..."}
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

      <div className="space-y-3">
        {missingStickers.length === 0 ? (
          <div className="text-center py-20 bg-neutral-950/50 border border-neon-green/35 rounded-2xl p-8 flex flex-col items-center shadow-[0_0_15px_rgba(57,255,20,0.1)]">
            <div className="w-12 h-12 rounded-full bg-neon-green/10 flex items-center justify-center border border-neon-green/45 text-neon-green mb-4 shadow-[0_0_10px_rgba(57,255,20,0.2)] animate-bounce">
              <Trophy size={20} className="stroke-[2.5]" />
            </div>
            <span className="text-xl font-display font-black text-neon-green text-neon-green-glow uppercase tracking-wide">¡Álbum Completo! 🎉</span>
            <span className="text-neutral-400 text-xs mt-1.5 text-center max-w-xs leading-relaxed font-sans">No te falta ninguna figurita en tu colección. ¡Has completado la hazaña máxima!</span>
          </div>
        ) : viewMode === 'flat' ? (
          /* FLAT GRID DISPLAY: DIRECT LIST OF ONLY MISSING STICKERS */
          flatFilteredStickers.length === 0 ? (
            <div className="text-center py-10 text-neutral-550 font-sans border border-neutral-850 border-dashed rounded-xl bg-neutral-950/45 p-6 text-xs">
              No se encontraron códigos faltantes para "{searchQuery}"
            </div>
          ) : (
            <div className="bg-neutral-950/45 rounded-2xl border border-neutral-900 p-4 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
              <p className="text-[9px] text-neutral-500 font-sans uppercase tracking-wider font-semibold mb-4 leading-normal">
                📌 Tocá cualquier figurita para añadirla rápido a tu álbum (así desaparecerá directamente de tus faltantes):
              </p>
              <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1.5 xs:gap-2">
                {flatFilteredStickers.map((sticker) => {
                  const isCC = sticker.prefix === 'CC';
                  const number = sticker.number === 0 ? '00' : sticker.number;
                  const stickerStyle = isCC
                    ? 'hover:border-red-500 hover:bg-red-950/20 text-red-300 border-red-950/35 focus:ring-1 focus:ring-red-500'
                    : 'hover:border-neon-cyan hover:bg-neon-cyan/5 text-neutral-300 border-neutral-850 focus:ring-1 focus:ring-neon-cyan';

                  return (
                    <button
                      key={sticker.id}
                      onClick={() => toggleOwned(sticker.id)}
                      className={`relative flex flex-col items-center justify-center p-2 rounded-xl py-2.5 border transition-all duration-150 uppercase tracking-widest overflow-hidden cursor-pointer bg-neutral-900/30 active:scale-95 text-xs text-neutral-455 hover:text-white ${stickerStyle}`}
                    >
                      <span className="text-[7px] font-mono font-bold text-neutral-555 leading-none mb-0.5">{sticker.prefix}</span>
                      <span className="text-[14px] font-display font-black leading-none text-neutral-100">{number}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          /* GROUPED ACCORDION VIEW */
          filteredTeams.length === 0 && searchQuery ? (
            <div className="text-center py-10 text-neutral-550 font-sans border border-neutral-850 border-dashed rounded-xl bg-neutral-950/45 p-6 text-xs">
              No se encontraron faltantes para "{searchQuery}"
            </div>
          ) : (
            filteredTeams.map((team) => {
              const isExpanded = expandedTeam === team.id;
              const teamStickers = stickersByTeam.get(team.id) || [];
              const isCC = team.prefix === 'CC';
              const isComplete = teamStickers.length === 0;

              return (
                <div key={team.id} className="bg-neutral-950/45 rounded-xl border border-neutral-900 overflow-hidden transition-all duration-205 hover:border-neutral-850 hover:shadow-[0_0_10px_rgba(0,0,0,0.4)]">
                  <button
                    className="w-full px-4 py-3.5 sm:px-5 sm:py-4 flex items-center justify-between transition-all duration-150 cursor-pointer bg-transparent hover:bg-neutral-900/35"
                    onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-lg border text-xs font-mono font-bold transition-all duration-200 ${isComplete ? 'bg-neon-green/10 border-neon-green/30 text-neon-green shadow-[0_0_8px_rgba(57,255,20,0.15)] text-neon-green-glow' : 'border-neutral-805 text-neutral-400 bg-neutral-900/80 font-mono'}`}>
                        <span className={`text-[9px] font-display tracking-wider uppercase font-black ${isComplete ? 'text-neon-green' : 'text-neutral-450'}`}>{team.prefix}</span>
                      </div>
                      <div className="flex flex-col items-start leading-tight">
                        <span className={`font-display font-semibold text-xs sm:text-sm text-neutral-200 text-left ${isComplete ? 'text-neon-green text-neon-green-glow font-black' : 'text-neutral-200'}`}>{team.name}</span>
                        {isComplete ? (
                          <span className="text-[7.5px] uppercase tracking-wider text-neon-green/90 font-mono font-bold mt-0.5 text-neon-green-glow">¡Completado! 🎉</span>
                        ) : (
                          <span className="text-[7.5px] uppercase tracking-wider text-neon-pink/85 font-mono font-bold mt-0.5">Faltan {teamStickers.length}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown size={14} className="text-neutral-500" /> : <ChevronRight size={14} className="text-neutral-500" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-4 bg-neutral-950/90 border-t border-neutral-900 animate-in slide-in-from-top-1 duration-200">
                      {isComplete ? (
                        <div className="text-center py-4 text-neutral-550 text-xs font-sans">
                          🏆 ¡No te falta ninguna figurita de <span className="text-white font-black">{team.name}</span>! Se encuentra totalmente completado.
                        </div>
                      ) : (
                        <>
                          <p className="text-[8.5px] text-neutral-500 font-sans uppercase tracking-wider font-semibold mb-3">
                             Toca un cromo para marcar que lo conseguiste:
                          </p>
                          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-10 gap-1.5 sm:gap-2">
                            {teamStickers.map((sticker) => {
                              const number = sticker.number === 0 ? '00' : sticker.number;
                              const stickerStyle = isCC
                                ? 'hover:border-red-500/50 hover:bg-red-950/20 hover:text-red-400 border-red-950/25 text-red-300'
                                : 'hover:border-neon-cyan/50 hover:bg-neon-cyan/5 hover:text-neon-cyan border-neutral-850 text-neutral-350 hover:shadow-[0_0_8px_rgba(0,243,255,0.2)]';

                              return (
                                <button
                                  key={sticker.id}
                                  onClick={() => toggleOwned(sticker.id)}
                                  className={`relative flex flex-col items-center justify-center p-2 rounded-lg py-2.5 border transition-all duration-150 uppercase tracking-widest overflow-hidden cursor-pointer bg-neutral-900/40 active:scale-95 text-xs text-neutral-400 ${stickerStyle}`}
                                >
                                  <span className="text-[7px] font-mono font-bold text-neutral-500 mb-0.5">{sticker.prefix}</span>
                                  <span className="text-sm sm:text-base font-display font-black leading-none text-neutral-100">{number}</span>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )
        )}
      </div>
    </div>
  );
}
