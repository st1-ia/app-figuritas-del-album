import React, { useState, useMemo } from 'react';
import { WORLD_CUP_TEAMS, getAllStickers, StickerDef } from '../data/stickers';
import { Check, ChevronDown, ChevronRight, Search, X, Copy, CheckCircle2, TrendingUp, Trophy, Library, Percent, FileQuestion, Users, Sparkles } from 'lucide-react';
import Missing from './Missing';
import Repeated from './Repeated';
import { motion, AnimatePresence } from 'motion/react';

interface AlbumProps {
  ownedStickers: Set<string>;
  repeatedStickers: Record<string, number>;
  toggleOwned: (id: string, forceStatus?: boolean, sourceContext?: string) => void;
  updateRepeated: (id: string, delta: number, sourceContext?: string) => void;
  isOnline?: boolean;
}

export default function Album({ ownedStickers, repeatedStickers, toggleOwned, updateRepeated, isOnline = true }: AlbumProps) {
  const [subTab, setSubTab] = useState<'all' | 'missing' | 'repeated'>('all');
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

  // Comprehensive statistic outputs
  const stats = useMemo(() => {
    const total = stickers.length;
    const owned = ownedStickers.size;
    const missing = total - owned;
    const ownedPercent = total > 0 ? ((owned / total) * 100).toFixed(1) : '0';
    const missingPercent = total > 0 ? ((missing / total) * 100).toFixed(1) : '0';

    // Sum of duplicates
    let duplicatesCount = 0;
    if (repeatedStickers) {
      Object.values(repeatedStickers).forEach(count => {
        duplicatesCount += (count || 0);
      });
    }

    // Fully completed sections/teams out of 50 total sections
    let completedGroupsCount = 0;
    WORLD_CUP_TEAMS.forEach(team => {
      const teamStickers = stickersByTeam.get(team.id) || [];
      const ownedInTeam = teamStickers.filter(s => ownedStickers.has(s.id)).length;
      if (ownedInTeam === teamStickers.length && teamStickers.length > 0) {
        completedGroupsCount++;
      }
    });

    // FIFA Especial / FWC specific progress
    const fwcStickers = stickersByTeam.get('fwc') || [];
    const fwcOwned = fwcStickers.filter(s => ownedStickers.has(s.id)).length;
    const fwcPct = fwcStickers.length > 0 ? ((fwcOwned / fwcStickers.length) * 100).toFixed(0) : '0';

    // Coca Cola / CC specific progress
    const cocStickers = stickersByTeam.get('coc') || [];
    const cocOwned = cocStickers.filter(s => ownedStickers.has(s.id)).length;
    const cocPct = cocStickers.length > 0 ? ((cocOwned / cocStickers.length) * 100).toFixed(0) : '0';

    return {
      total,
      owned,
      missing,
      ownedPercent,
      missingPercent,
      duplicatesCount,
      completedGroupsCount,
      fwcOwned,
      fwcTotal: fwcStickers.length,
      fwcPct,
      cocOwned,
      cocTotal: cocStickers.length,
      cocPct
    };
  }, [stickers, ownedStickers, repeatedStickers, stickersByTeam]);

  return (
    <div className="w-full max-w-4xl mx-auto pb-24 text-neutral-100 font-sans">
      
      {/* Selector de subapartados con píldora animada deslizante */}
      <div className="flex bg-neutral-950/80 p-1 rounded-xl border border-neutral-900 mb-6 max-w-md mx-auto shadow-md relative">
        <button
          onClick={() => setSubTab('all')}
          className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs leading-none uppercase font-display font-black tracking-wider transition-colors duration-250 cursor-pointer select-none ${
            subTab === 'all'
              ? 'text-white'
              : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          {subTab === 'all' && (
            <motion.div
              layoutId="activeSubTabPill"
              className="absolute inset-0 bg-neutral-900 border border-neutral-800 rounded-lg shadow-[0_0_8px_rgba(0,243,255,0.15)]"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
          <span className="relative z-25 flex items-center gap-1.5 text-neon-cyan">
            <Library size={13} />
            Álbum
          </span>
        </button>
        <button
          onClick={() => setSubTab('missing')}
          className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs leading-none uppercase font-display font-black tracking-wider transition-colors duration-250 cursor-pointer select-none ${
            subTab === 'missing'
              ? 'text-white'
              : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          {subTab === 'missing' && (
            <motion.div
              layoutId="activeSubTabPill"
              className="absolute inset-0 bg-neutral-900 border border-neutral-800 rounded-lg shadow-[0_0_8px_rgba(255,0,127,0.15)]"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
          <span className={`relative z-25 flex items-center gap-1.5 ${subTab === 'missing' ? 'text-neon-pink' : 'text-neutral-450'}`}>
            <FileQuestion size={13} />
            Faltantes
          </span>
        </button>
        <button
          onClick={() => setSubTab('repeated')}
          className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs leading-none uppercase font-display font-black tracking-wider transition-colors duration-250 cursor-pointer select-none ${
            subTab === 'repeated'
              ? 'text-white'
              : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          {subTab === 'repeated' && (
            <motion.div
              layoutId="activeSubTabPill"
              className="absolute inset-0 bg-neutral-900 border border-neutral-800 rounded-lg shadow-[0_0_8px_rgba(245,158,11,0.15)]"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
          <span className={`relative z-25 flex items-center gap-1.5 ${subTab === 'repeated' ? 'text-amber-500' : 'text-neutral-450'}`}>
            <Copy size={13} />
            Repetidas
          </span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={subTab}
          initial={{ opacity: 0, y: 12, scale: 0.995 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.995 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {subTab === 'missing' ? (
            <Missing ownedStickers={ownedStickers} toggleOwned={toggleOwned} />
          ) : subTab === 'repeated' ? (
            <Repeated ownedStickers={ownedStickers} repeatedStickers={repeatedStickers} updateRepeated={updateRepeated} />
          ) : (
            <div>
              {/* Banner / Header Card - STRICTLY NOT STICKY AS PER USER REQUEST */}
              <div className="px-6 py-6 bg-neutral-950/70 border border-neutral-900 rounded-2xl shadow-[0_0_15px_rgba(0,243,255,0.05)] neon-glow-card mb-6">
                
                {/* iOS PWA Atajo Acceso Rápido Promoción */}
                <div className="mb-5 p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/40 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs leading-relaxed relative overflow-hidden">
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded-lg bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan mt-0.5">
                      <Sparkles size={14} className="animate-pulse" />
                    </div>
                    <div>
                      <span className="font-bold text-white block text-sm">⚡ Carga Figuritas al Instante (Atajos iPhone)</span>
                      <span className="text-neutral-400 text-[11px] block mt-0.5">Agrega figuritas directamente desde tu Pantalla de Inicio usando la app Atajos o comandos de voz de Siri sin abrir la app.</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 self-start md:self-auto">
                    <button
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('shift-tab', { detail: 'quickadd-modal' }));
                      }}
                      className="px-3.5 py-2 rounded-lg bg-neon-cyan text-black font-black font-sans uppercase text-[10px] tracking-wider hover:opacity-95 select-none cursor-pointer shadow-[0_0_12px_rgba(0,243,255,0.4)] transition-all whitespace-nowrap"
                    >
                      ⚡ Abrir Cuadrito
                    </button>
                    <button
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('shift-tab', { detail: 'quickadd' }));
                      }}
                      className="px-3.5 py-2 rounded-lg bg-transparent hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 font-bold font-sans uppercase text-[10px] tracking-wider select-none cursor-pointer transition-all whitespace-nowrap"
                    >
                      Configurar Siri/Widget
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-5">
                  <div className="flex flex-col">
                    <span className="text-[9.5px] font-bold text-neutral-500 uppercase tracking-widest mb-1 font-mono">Resumen de Colección Colectiva</span>
                    <h2 className="text-2xl font-display font-black uppercase tracking-tight text-white flex items-center gap-2">
                      Mi Álbum{' '}
                      {isOnline ? (
                        <span className="text-[10px] bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 py-0.5 px-2 rounded-full font-mono font-bold uppercase tracking-wider text-neon-cyan-glow">
                          En Línea
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-950/30 text-amber-500 border border-amber-950/45 py-0.5 px-2 rounded-full font-mono font-bold uppercase tracking-wider shadow-[0_0_8px_rgba(245,158,11,0.15)]">
                          Caché Local
                        </span>
                      )}
                    </h2>
                
                <button 
                  onClick={copyMissingStickers}
                  className="mt-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-300 hover:text-neon-cyan hover:border-neon-cyan/50 hover:bg-neon-cyan/5 bg-neutral-900/50 py-2 px-3.5 rounded-lg border border-neutral-800 w-fit cursor-pointer transition-all duration-200 active:scale-95 shadow-xs"
                >
                  {copied ? <CheckCircle2 size={13} className="text-neon-green" /> : <Copy size={13} />}
                  {copied ? 'Copiado' : 'Copiar Faltantes'}
                </button>
              </div>
              <div className="text-left sm:text-right flex flex-col">
                <span className="text-4xl font-display font-black text-neon-cyan text-neon-cyan-glow block leading-none">
                  {stats.owned}
                </span>
                <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider block mt-1">
                  de <span className="text-white font-black">{stats.total}</span> pegados ({stats.ownedPercent}%)
                </span>
              </div>
            </div>
            
            {/* Progress Bar of Completed stickers */}
            <div className="w-full bg-neutral-950 rounded-full h-2 overflow-hidden mb-6 border border-neutral-900 p-[1px]">
              <div 
                className="h-full bg-gradient-to-r from-neon-cyan to-neon-green shadow-[0_0_8px_#00f3ff] transition-all duration-750 ease-out rounded-full"
                style={{ width: `${Math.max(1.5, (stats.owned / stats.total) * 100)}%` }}
              />
            </div>

            {/* STATS DECK GRID (DIFFERENT STATISTICS) */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-4 mb-6 pt-3 border-t border-neutral-900">
              
              <div className="bg-neutral-950/45 border border-neutral-900 p-2 sm:p-3.5 rounded-xl flex flex-col justify-between hover:border-neutral-850 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[7.5px] sm:text-[9px] font-bold text-neutral-500 uppercase tracking-wider font-mono">Faltantes</span>
                  <FileQuestion size={12} className="text-neon-pink shrink-0" />
                </div>
                <div>
                  <span className="text-xs sm:text-lg md:text-xl font-display font-black text-white block truncate leading-none">
                    {stats.missing} <span className="text-[8px] sm:text-xs font-normal text-neutral-500 font-mono">({stats.missingPercent}%)</span>
                  </span>
                  <span className="text-[6.5px] sm:text-[8.5px] uppercase tracking-widest text-neutral-500 block mt-1 font-semibold leading-none">A conseguir</span>
                </div>
              </div>

              <div className="bg-neutral-950/45 border border-neutral-900 p-2 sm:p-3.5 rounded-xl flex flex-col justify-between hover:border-neutral-850 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[7.5px] sm:text-[9px] font-bold text-neutral-500 uppercase tracking-wider font-mono">Completados</span>
                  <Users size={12} className="text-neon-cyan shrink-0" />
                </div>
                <div>
                  <span className="text-xs sm:text-lg md:text-xl font-display font-black text-white block truncate leading-none">
                    {stats.completedGroupsCount} <span className="text-[8px] sm:text-xs font-normal text-neutral-500 font-mono">/ {WORLD_CUP_TEAMS.length}</span>
                  </span>
                  <span className="text-[6.5px] sm:text-[8.5px] uppercase tracking-widest text-neutral-500 block mt-1 font-semibold leading-none">Grupos 100%</span>
                </div>
              </div>

              <div className="bg-neutral-950/45 border border-neutral-900 p-2 sm:p-3.5 rounded-xl flex flex-col justify-between hover:border-neutral-850 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[7.5px] sm:text-[9px] font-bold text-neutral-500 uppercase tracking-wider font-mono">FIFA Especial</span>
                  <Trophy size={11} className="text-amber-500 shrink-0" />
                </div>
                <div>
                  <span className="text-xs sm:text-lg md:text-xl font-display font-black text-white block truncate leading-none">
                    {stats.fwcOwned} <span className="text-[8px] sm:text-xs font-normal text-neutral-500 font-mono">({stats.fwcPct}%)</span>
                  </span>
                  <span className="text-[6.5px] sm:text-[8.5px] uppercase tracking-widest text-neutral-505 block mt-1 font-semibold leading-none">Brillantes</span>
                </div>
              </div>

            </div>

            {/* Coca-Cola Specials Sub-Statistic bar */}
            <div className="mb-5 bg-neutral-950/60 p-3 sm:p-3.5 rounded-xl border border-red-950/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-[0_0_12px_rgba(239,68,68,0.05)]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.8)]"></div>
                <span className="text-[10px] sm:text-xs font-bold text-red-500 uppercase tracking-wider">Especiales Coca-Cola (CC)</span>
              </div>
              <div className="flex items-center gap-3 justify-between sm:justify-end">
                <div className="w-20 sm:w-24 bg-neutral-900 rounded-full h-1.5 overflow-hidden p-[1px] border border-red-950/60">
                  <div className="bg-red-600 h-full rounded-full shadow-[0_0_6px_#dc2626]" style={{ width: `${stats.cocPct}%` }} />
                </div>
                <span className="text-[9px] sm:text-xs font-mono font-bold text-red-500">{stats.cocOwned}/{stats.cocTotal} ({stats.cocPct}%)</span>
              </div>
            </div>

            {/* Search - MUST prevent autozoom in mobile with input font size of 16px (text-[16px]) */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={14} className="text-neutral-505" />
              </div>
              <input
                type="text"
                className="block w-full pl-9 pr-9 py-2.5 border border-neutral-850 rounded-xl bg-neutral-950/60 text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neon-cyan focus:bg-neutral-900/40 text-[16px] md:text-sm transition-all font-sans focus:shadow-[0_0_12px_rgba(0,243,255,0.15)]"
                placeholder="Buscar por equipo o prefijo (ej. ARG)..."
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
          <div className="space-y-3 animate-in fade-in duration-300">
            {filteredTeams.length === 0 && (
              <div className="text-center py-10 text-neutral-555 font-sans border border-neutral-800 border-dashed rounded-xl bg-neutral-950/40 p-6">
                No se encontraron equipos para "{searchQuery}"
              </div>
            )}
            
            {filteredTeams.map((team) => {
              const isExpanded = expandedTeam === team.id;
              const teamStickers = stickersByTeam.get(team.id) || [];
              const ownedInTeam = getTeamProgress(team.id);
              const isComplete = ownedInTeam === teamStickers.length;
              const isCC = team.prefix === 'CC'; // Coca cola uses red
              
              const accentColor = isComplete ? 'text-neon-green text-neon-green-glow font-black' : 'text-neutral-200';
              const bgAccentLight = isComplete ? 'bg-neutral-950/35 hover:bg-neutral-950/65' : 'bg-transparent hover:bg-neutral-900/35';
              const badgeCompleteBg = isComplete 
                ? 'bg-neon-green/10 border-neon-green/30 text-neon-green shadow-[0_0_8px_rgba(57,255,20,0.15)] text-neon-green-glow' 
                : 'bg-neutral-900/80 border-neutral-805 text-neutral-505';

              return (
                <div key={team.id} className="bg-neutral-950/45 rounded-xl border border-neutral-900 overflow-hidden transition-all duration-250 hover:border-neutral-850 hover:shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                  <button
                    className={`w-full px-5 py-4 flex items-center justify-between transition-all duration-150 cursor-pointer ${bgAccentLight}`}
                    onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-lg border text-xs font-mono font-bold ${badgeCompleteBg}`}>
                        {isComplete ? (
                          <Check size={14} className="stroke-[3] text-neon-green" />
                        ) : (
                          <span className="text-[10px] uppercase font-black text-neutral-505">{team.prefix}</span>
                        )}
                      </div>
                      <div className="flex flex-col items-start leading-tight">
                        <span className={`font-display font-semibold text-sm sm:text-base ${isComplete ? 'text-neon-green text-neon-green-glow font-black' : 'text-neutral-200 font-medium'}`}>{team.name}</span>
                        <span className="text-[7.5px] uppercase tracking-wider text-neutral-505 font-mono font-bold mt-0.5">Grupo {team.id === 'fwc' || team.id === 'coc' ? 'Especial' : team.id.toUpperCase()}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end leading-none">
                         <span className={`text-xl font-display font-black ${isComplete ? 'text-neon-green text-neon-green-glow' : 'text-neutral-100'}`}>
                           {ownedInTeam}
                         </span>
                         <span className="text-[7.5px] uppercase tracking-wider text-neutral-505 font-bold mt-0.5">de {teamStickers.length}</span>
                      </div>
                      {isExpanded ? <ChevronDown size={14} className="text-neutral-505" /> : <ChevronRight size={14} className="text-neutral-505" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-4 bg-neutral-950/90 border-t border-neutral-900 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-10 gap-2 animate-in slide-in-from-top-1 duration-200">
                      {teamStickers.map((sticker) => {
                        const number = sticker.number === 0 ? '00' : sticker.number;
                        const stickerId = sticker.id;
                        const isOwned = ownedStickers.has(stickerId);
                        
                        const stickerStyle = isOwned
                          ? isCC
                            ? 'bg-red-950/30 border-red-500/40 text-red-400 font-bold shadow-[0_0_6px_rgba(239,68,68,0.15)]'
                            : 'bg-neon-green/5 border-neon-green/45 text-neon-green font-bold shadow-[0_0_8px_rgba(57,255,20,0.15)] text-neon-green-glow'
                          : 'bg-neutral-950/50 border-neutral-900 text-neutral-605 hover:border-neutral-800 hover:text-neutral-400';
                        
                        const checkIconBg = isCC ? 'bg-red-650 text-white' : 'bg-neon-green text-black font-black shadow-[0_0_6px_#39ff14]';

                        return (
                          <button
                            key={stickerId}
                            onClick={() => toggleOwned(stickerId)}
                            className={`
                              relative flex flex-col items-center justify-center p-2 rounded-lg py-2.5 border transition-all duration-150 uppercase tracking-wider overflow-hidden cursor-pointer active:scale-95 text-xs
                              ${stickerStyle}
                            `}
                          >
                            <span className={`text-[7px] font-mono font-bold tracking-tight mb-0.5 ${isOwned ? (isCC ? 'text-red-400' : 'text-neon-cyan') : 'text-neutral-605'}`}>{sticker.prefix}</span>
                            <span className={`text-base font-display font-black leading-none ${isOwned ? 'text-white' : 'text-neutral-505'}`}>{number}</span>
                            
                            {isOwned && (
                              <div className={`absolute top-0 right-0 w-3.5 h-3.5 flex items-center justify-center rounded-bl-sm text-xs ${checkIconBg}`}>
                                <Check size={8} strokeWidth={4} />
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
      )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
