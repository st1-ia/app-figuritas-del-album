import React, { useState, useMemo } from 'react';
import { WORLD_CUP_TEAMS, getAllStickers, StickerDef } from '../data/stickers';
import { ChevronDown, ChevronRight, Search, X, Copy, CheckCircle2, Trophy } from 'lucide-react';

interface MissingProps {
  ownedStickers: Set<string>;
  toggleOwned: (id: string) => void;
}

export default function Missing({ ownedStickers, toggleOwned }: MissingProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
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
    const activeTeams = WORLD_CUP_TEAMS.filter(team => stickersByTeam.has(team.id));
    if (!searchQuery.trim()) return activeTeams;
    
    const query = searchQuery.toLowerCase().trim();
    return activeTeams.filter(
      team => 
        team.name.toLowerCase().includes(query) || 
        team.prefix.toLowerCase().includes(query)
    );
  }, [searchQuery, stickersByTeam]);

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

  return (
    <div className="w-full max-w-4xl mx-auto pb-24 text-neutral-100 font-sans">
      {/* Summary Header banner */}
      <div className="px-6 py-6 bg-neutral-950/70 border border-neutral-900 rounded-2xl shadow-[0_0_15px_rgba(255,0,127,0.05)] neon-glow-card mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-4">
          <div className="flex flex-col">
            <span className="text-[9.5px] font-bold text-neutral-500 uppercase tracking-widest mb-1 font-mono">Listado Dinámico</span>
            <h2 className="text-2xl font-display font-black uppercase tracking-tight text-white mb-2">Faltantes</h2>
            <button 
              onClick={copyMissingStickers}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-300 bg-neutral-900/50 border border-neutral-850 hover:border-neon-cyan/50 hover:bg-neon-cyan/5 hover:text-neon-cyan rounded-lg py-2 px-3.5 transition-all duration-200 cursor-pointer active:scale-95 shadow-2xs"
            >
              {copied ? <CheckCircle2 size={13} className="text-neon-green animate-pulse" /> : <Copy size={13} />}
              {copied ? 'Copiado' : 'Copiar Listado'}
            </button>
          </div>
          <div className="text-left sm:text-right flex flex-col">
            <span className="text-4xl font-display font-black text-neon-pink text-neon-pink-glow block leading-none animate-pulse">
              {missingStickers.length}
            </span>
            <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider block mt-1">
              figuritas por conseguir
            </span>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={14} className="text-neutral-500" />
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-9 py-2.5 border border-neutral-850 rounded-xl bg-neutral-950/60 text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neon-cyan focus:bg-neutral-900/40 text-[16px] md:text-sm transition-all font-sans focus:shadow-[0_0_12px_rgba(0,243,255,0.15)]"
            placeholder="Buscar equipo faltante..."
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
          <div className="text-center py-20 bg-neutral-950/50 border border-neon-green/35 rounded-2xl p-8 flex flex-col items-center shadow-[0_0_15px_rgba(57,255,20,0.1)] animate-pulse">
            <div className="w-12 h-12 rounded-full bg-neon-green/10 flex items-center justify-center border border-neon-green/45 text-neon-green mb-4 animate-bounce shadow-[0_0_10px_rgba(57,255,20,0.2)]">
              <Trophy size={20} className="stroke-[2.5]" />
            </div>
            <span className="text-xl font-display font-black text-neon-green text-neon-green-glow uppercase tracking-wide">¡Álbum Completo! 🎉</span>
            <span className="text-neutral-400 text-xs mt-1.5 text-center max-w-xs leading-relaxed">No te falta ninguna figurita en tu colección. ¡Has completado la hazaña máxima!</span>
          </div>
        ) : filteredTeams.length === 0 && searchQuery ? (
          <div className="text-center py-10 text-neutral-500 font-sans border border-neutral-850 border-dashed rounded-xl bg-neutral-950/45 p-6">
            No se encontraron faltantes para "{searchQuery}"
          </div>
        ) : (
          filteredTeams.map((team) => {
            const isExpanded = expandedTeam === team.id;
            const teamStickers = stickersByTeam.get(team.id) || [];
            const isCC = team.prefix === 'CC';

            return (
              <div key={team.id} className="bg-neutral-950/45 rounded-xl border border-neutral-900 overflow-hidden transition-all duration-200 hover:border-neutral-850 hover:shadow-[0_0_10px_rgba(0,0,0,0.4)]">
                <button
                  className="w-full px-5 py-4 flex items-center justify-between transition-all duration-150 cursor-pointer bg-transparent hover:bg-neutral-900/35"
                  onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg border border-neutral-800 text-neutral-400 bg-neutral-900/80 font-mono">
                      <span className="text-[10px] font-display tracking-wider uppercase font-black">{team.prefix}</span>
                    </div>
                    <div className="flex flex-col items-start leading-tight">
                      <span className="font-display font-semibold text-sm sm:text-base text-neutral-200 text-left">{team.name}</span>
                      <span className="text-[7.5px] uppercase tracking-wider text-neon-pink/80 font-mono font-bold mt-0.5">Faltan {teamStickers.length}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {isExpanded ? <ChevronDown size={14} className="text-neutral-500" /> : <ChevronRight size={14} className="text-neutral-500" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-4 bg-neutral-950/90 border-t border-neutral-900 animate-in slide-in-from-top-1 duration-200">
                    <p className="text-[8.5px] text-neutral-500 font-sans uppercase tracking-wider font-semibold mb-3">
                       Toca un cromo para marcar que lo conseguiste:
                    </p>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-10 gap-2">
                       {teamStickers.map((sticker) => {
                        const number = sticker.number === 0 ? '00' : sticker.number;
                        const stickerStyle = isCC
                          ? 'hover:border-red-500/50 hover:bg-red-950/20 hover:text-red-400'
                          : 'hover:border-neon-green/50 hover:bg-neon-green/5 hover:text-neon-green hover:shadow-[0_0_8px_rgba(57,255,20,0.2)]';

                        return (
                          <button
                            key={sticker.id}
                            onClick={() => toggleOwned(sticker.id)}
                            className={`relative flex flex-col items-center justify-center p-2 rounded-lg py-2.5 border transition-all duration-150 uppercase tracking-widest overflow-hidden cursor-pointer bg-neutral-900/40 border-neutral-850 active:scale-95 text-xs text-neutral-400 ${stickerStyle}`}
                          >
                            <span className="text-[7px] font-mono font-bold text-neutral-500 mb-0.5">{sticker.prefix}</span>
                            <span className="text-base font-display font-black leading-none text-neutral-200">{number}</span>
                          </button>
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
