import React, { useState, useMemo } from 'react';
import { WORLD_CUP_TEAMS, getAllStickers, StickerDef } from '../data/stickers';
import { Check, ChevronDown, ChevronRight, Search, X, Copy, CheckCircle2 } from 'lucide-react';

interface AlbumProps {
  ownedStickers: Set<string>;
  toggleOwned: (id: string) => void;
}

export default function Album({ ownedStickers, toggleOwned }: AlbumProps) {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(WORLD_CUP_TEAMS[0].id);
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
      <div className="px-4 py-8 bg-[#111] shadow-2xl sticky top-0 z-10 border-b border-[#333] mb-6 top-[72px]">
        <div className="flex justify-between items-end mb-4">
          <div className="flex flex-col">
            <h2 className="text-4xl font-display uppercase tracking-tight text-white mb-2">Mi Álbum</h2>
            <button 
              onClick={copyMissingStickers}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00FF00] hover:text-white transition-colors bg-[#00FF00]/10 hover:bg-[#00FF00]/20 py-2 px-3 rounded-lg w-fit"
            >
              {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
              {copied ? 'Copiado al portapapeles' : 'Copiar Faltantes'}
            </button>
          </div>
          <div className="text-right">
            <span className="text-3xl font-display text-[#00FF00] block leading-none">{ownedStickers.size}</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">de {stickers.length} cromos</span>
          </div>
        </div>
        <div className="mt-2 w-full bg-[#222] rounded-full h-1 overflow-hidden relative mb-5">
          <div 
            className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-[#00FF00] to-[#00FFFF] transition-all duration-700 ease-out"
            style={{ width: `${(ownedStickers.size / stickers.length) * 100}%` }}
          ></div>
        </div>
        
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-500" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-10 py-3 border border-[#333] rounded-lg leading-5 bg-[#1a1a1a] text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#00FF00] focus:border-[#00FF00] sm:text-sm transition-colors"
            placeholder="Buscar por equipo o prefijo (ej. ARG)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <X size={18} className="text-gray-500 hover:text-white transition-colors" />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 space-y-4">
        {filteredTeams.length === 0 && (
          <div className="text-center py-10 text-gray-500">
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
          const bgAccentLight = isCC ? 'bg-[#F40009]/20' : 'bg-[#00FF00]/20';
          const bgAccentHover = isCC ? 'hover:bg-[#F40009]/10' : 'hover:bg-[#00FF00]/10';

          return (
            <div key={team.id} className="bg-[#151515] rounded-xl overflow-hidden border border-[#2a2a2a] transition-all">
              <button
                className={`w-full px-5 py-5 flex items-center justify-between transition-colors ${bgAccentHover} ${isComplete ? bgAccentLight : ''}`}
                onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${isComplete ? `border-transparent ${bgAccentLight} ${accentColor}` : 'border-[#333] text-gray-400'}`}>
                    {isComplete ? <Check size={20} className="stroke-[3]" /> : <span className="text-xs font-display tracking-wider uppercase">{team.prefix}</span>}
                  </div>
                  <span className={`font-semibold text-lg ${isComplete ? 'text-white' : 'text-gray-300'}`}>{team.name}</span>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end">
                     <span className={`text-xl font-display leading-none ${isComplete ? accentColor : 'text-white'}`}>
                       {ownedInTeam}
                     </span>
                     <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">de {teamStickers.length}</span>
                  </div>
                  {isExpanded ? <ChevronDown size={24} className="text-gray-500" /> : <ChevronRight size={24} className="text-gray-500" />}
                </div>
              </button>

              {isExpanded && (
                <div className="p-5 bg-black border-t border-[#222] grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3">
                  {teamStickers.map((sticker) => {
                    const number = sticker.number === 0 ? '00' : sticker.number;
                    const stickerId = sticker.id;
                    const isOwned = ownedStickers.has(stickerId);
                    
                    const stickerColorClass = isCC ? 'from-[#F40009]/20 to-[#F40009]/5 border-[#F40009]' : 'from-[#00FF00]/20 to-[#00FF00]/5 border-[#00FF00]';
                    const checkColorClass = isCC ? 'bg-[#F40009] text-white' : 'bg-[#00FF00] text-black';

                    return (
                      <button
                        key={stickerId}
                        onClick={() => toggleOwned(stickerId)}
                        className={`
                          relative flex flex-col items-center justify-center p-2 rounded-lg py-4 border-2 transition-all duration-200 uppercase tracking-wider overflow-hidden
                          ${isOwned 
                            ? `bg-gradient-to-b ${stickerColorClass} scale-105 shadow-[0_0_15px_rgba(0,255,0,0.15)]` 
                            : 'bg-[#111] border-[#333] text-gray-600 hover:border-[#555] hover:text-gray-400'}
                        `}
                      >
                        <span className={`text-[9px] font-bold ${isOwned ? (isCC ? 'text-[#F40009]' : 'text-[#00FF00]') : ''}`}>{sticker.prefix}</span>
                        <span className={`text-xl font-display mt-0.5 ${isOwned ? 'text-white' : ''}`}>{number}</span>
                        {isOwned && (
                          <div className={`absolute top-0 right-0 w-6 h-6 flex items-center justify-center rounded-bl-lg ${checkColorClass}`}>
                            <Check size={12} strokeWidth={4} />
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
