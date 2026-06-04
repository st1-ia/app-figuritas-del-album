import React, { useState, useMemo } from 'react';
import { WORLD_CUP_TEAMS, getAllStickers, StickerDef } from '../data/stickers';
import { BarChart3, TrendingUp, Award, BookOpen, Users, CheckCircle2, ChevronDown, ChevronRight, PieChart, Activity, Info } from 'lucide-react';

interface ChartsViewProps {
  ownedStickers: Set<string>;
  repeatedStickers: Record<string, number>;
}

export default function ChartsView({ ownedStickers, repeatedStickers }: ChartsViewProps) {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  
  const stickers = getAllStickers();
  const totalStickers = stickers.length;
  const totalOwned = ownedStickers.size;
  const totalMissing = totalStickers - totalOwned;
  
  const totalRepeated = useMemo(() => {
    return Object.values(repeatedStickers).reduce((acc, count) => acc + count, 0);
  }, [repeatedStickers]);

  const stickersByTeam = useMemo(() => {
    const map = new Map<string, StickerDef[]>();
    for (const s of stickers) {
      if (!map.has(s.teamId)) map.set(s.teamId, []);
      map.get(s.teamId)!.push(s);
    }
    return map;
  }, [stickers]);

  // Compute stats for Groups
  const GROUPS_DEF = useMemo(() => [
    { name: "Grupo A", ids: ["mex", "rsa", "kor", "cze"] },
    { name: "Grupo B", ids: ["can", "bih", "qat", "sui"] },
    { name: "Grupo C", ids: ["bra", "mar", "hai", "sco"] },
    { name: "Grupo D", ids: ["usa", "par", "aus", "tur"] },
    { name: "Grupo E", ids: ["ger", "cuw", "civ", "ecu"] },
    { name: "Grupo F", ids: ["ned", "jpn", "swe", "tun"] },
    { name: "Grupo G", ids: ["bel", "egy", "irn", "nzl"] },
    { name: "Grupo H", ids: ["esp", "cpv", "ksa", "uru"] },
    { name: "Grupo I", ids: ["fra", "sen", "irq", "nor"] },
    { name: "Grupo J", ids: ["arg", "alg", "aut", "jor"] },
    { name: "Grupo K", ids: ["por", "cod", "uzb", "col"] },
    { name: "Grupo L", ids: ["eng", "cro", "gha", "pan"] },
    { name: "Especiales", ids: ["fwc", "coc"] }
  ], []);

  const groupStats = useMemo(() => {
    return GROUPS_DEF.map(g => {
      let total = 0;
      let owned = 0;
      let repeated = 0;
      
      g.ids.forEach(teamId => {
        const teamStickers = stickersByTeam.get(teamId) || [];
        total += teamStickers.length;
        teamStickers.forEach(s => {
          if (ownedStickers.has(s.id)) owned += 1;
          repeated += (repeatedStickers[s.id] || 0);
        });
      });

      const percent = total > 0 ? (owned / total) * 100 : 0;
      const key = g.name.toLowerCase().replace(/\s+/g, '-');

      return {
        key,
        name: g.name,
        teamIds: g.ids,
        total,
        owned,
        repeated,
        percent: parseFloat(percent.toFixed(1)),
        isComplete: owned === total && total > 0
      };
    });
  }, [GROUPS_DEF, stickersByTeam, ownedStickers, repeatedStickers]);

  // General metrics
  const completedTeamsCount = useMemo(() => {
    let count = 0;
    WORLD_CUP_TEAMS.forEach(team => {
      const teamStickers = stickersByTeam.get(team.id) || [];
      const ownedInTeam = teamStickers.filter(s => ownedStickers.has(s.id)).length;
      if (ownedInTeam === teamStickers.length && teamStickers.length > 0) {
        count++;
      }
    });
    return count;
  }, [stickersByTeam, ownedStickers]);

  // Group with highest/lowest progress
  const bestAndWorstGroups = useMemo(() => {
    const sorted = [...groupStats].sort((a, b) => b.percent - a.percent);
    return {
      best: sorted[0],
      worst: sorted[sorted.length - 1]
    };
  }, [groupStats]);

  // Completion percentages for circular charts
  const completionPercent = totalStickers > 0 ? (totalOwned / totalStickers) * 100 : 0;
  const formattedPercent = completionPercent.toFixed(1);

  return (
    <div className="w-full max-w-4xl mx-auto pb-24 text-neutral-100 font-sans px-2 sm:px-4 select-none animate-in fade-in duration-300">
      
      {/* Page Header */}
      <div className="px-5 py-6 bg-neutral-950/70 border border-neutral-900 rounded-2xl shadow-[0_0_15px_rgba(0,243,255,0.05)] neon-glow-card mb-6">
        <span className="text-[9.5px] font-bold text-neutral-500 uppercase tracking-widest mb-1 font-mono block">Estadísticas & Visualizaciones</span>
        <h2 className="text-2xl font-display font-black uppercase tracking-tight text-white flex items-center gap-2">
          Gráficos de Progreso
          <span className="text-[10px] bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 py-0.5 px-2 rounded-full font-mono font-bold uppercase tracking-wider text-neon-cyan-glow">Analítica</span>
        </h2>
        <p className="text-neutral-450 text-xs mt-1.5 leading-relaxed font-sans max-w-2xl">
          Análisis en tiempo real de tu avance en el álbum, distribución por fases clasificatorias de la copa y balance de figuritas repetidas en inventario.
        </p>
      </div>

      {/* Bento Grid Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
        
        {/* Core Gauge Card */}
        <div className="md:col-span-4 bg-neutral-950/45 border border-neutral-900 rounded-2xl p-5 flex flex-col items-center justify-center text-center relative overflow-hidden group hover:border-neutral-850 transition-all duration-200">
          <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest font-mono mb-4">Porcentaje de Llenado</span>
          
          <div className="relative w-36 h-36 flex items-center justify-center">
            {/* SVG Ring */}
            <svg className="w-full h-full transform -rotate-180" viewBox="0 0 100 100">
              <path
                d="M 20,80 A 40,40 0 1,1 80,80"
                fill="none"
                className="stroke-neutral-900/40"
                strokeWidth="7"
                strokeLinecap="round"
              />
              <path
                d="M 20,80 A 40,40 0 1,1 80,80"
                fill="none"
                className="stroke-neon-cyan transition-all duration-1000 ease-out"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray="188.4"
                strokeDashoffset={188.4 - (188.4 * (completionPercent / 100))}
                style={{ filter: 'drop-shadow(0 0 6px rgba(0, 243, 255, 0.45))' }}
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center -mt-2">
              <span className="text-3xl font-display font-black text-white leading-none text-neon-cyan-glow">{formattedPercent}%</span>
              <span className="text-[7.5px] text-neutral-500 font-mono font-bold uppercase tracking-widest mt-1.5">Completado</span>
            </div>
          </div>

          <div className="w-full grid grid-cols-3 gap-2 mt-2 pt-4 border-t border-neutral-900 text-center">
            <div>
              <span className="text-base font-display font-black text-neon-green text-neon-green-glow">{totalOwned}</span>
              <span className="text-[7px] text-neutral-500 uppercase font-mono block mt-0.5">Pegadas</span>
            </div>
            <div className="border-x border-neutral-900">
              <span className="text-base font-display font-black text-neon-pink text-neon-pink-glow">{totalMissing}</span>
              <span className="text-[7px] text-neutral-500 uppercase font-mono block mt-0.5">Faltan</span>
            </div>
            <div>
              <span className="text-base font-display font-black text-amber-500">{totalRepeated}</span>
              <span className="text-[7px] text-neutral-500 uppercase font-mono block mt-0.5">Duplicados</span>
            </div>
          </div>
        </div>

        {/* Quick Insights Slider Bento Card */}
        <div className="md:col-span-8 bg-neutral-950/45 border border-neutral-900 rounded-2xl p-5 flex flex-col justify-between hover:border-neutral-850 transition-all duration-200">
          <div>
            <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest font-mono mb-3 block">Métricas Estratégicas</span>
            <h3 className="text-lg font-display font-bold text-white mb-4 flex items-center gap-1.5">
              <TrendingUp size={16} className="text-neon-cyan" />
              Resumen Curado del Álbum
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-neutral-900/30 p-3 rounded-xl border border-neutral-905">
                <span className="text-[7.5px] uppercase font-mono text-neutral-500 block mb-0.5">Máxima Eficiencia</span>
                <span className="text-white font-display font-extrabold text-sm block truncate">
                  {bestAndWorstGroups.best?.name}
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="h-1.5 bg-neutral-950 rounded-full flex-1 overflow-hidden">
                    <div className="bg-neon-green h-full" style={{ width: `${bestAndWorstGroups.best?.percent}%` }}></div>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-neon-green">
                    {bestAndWorstGroups.best?.percent}%
                  </span>
                </div>
              </div>

              <div className="bg-neutral-900/30 p-3 rounded-xl border border-neutral-905">
                <span className="text-[7.5px] uppercase font-mono text-neutral-500 block mb-0.5">Foco de Atención</span>
                <span className="text-white font-display font-extrabold text-sm block truncate">
                  {bestAndWorstGroups.worst?.name}
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="h-1.5 bg-neutral-950 rounded-full flex-1 overflow-hidden">
                    <div className="bg-neon-pink h-full" style={{ width: `${bestAndWorstGroups.worst?.percent}%` }}></div>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-neon-pink">
                    {bestAndWorstGroups.worst?.percent}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-900 flex flex-wrap gap-y-2 items-center justify-between text-[11px] text-neutral-450">
            <span className="flex items-center gap-1">
              <CheckCircle2 size={12} className="text-neon-greenshrink-0" />
              Grupos completos de naciones: <strong className="text-white font-bold ml-0.5">{completedTeamsCount} / {WORLD_CUP_TEAMS.length - 2}</strong>
            </span>
            <span className="text-[10px] bg-neutral-900 border border-neutral-800 py-1 px-2.5 rounded-lg text-neutral-400 font-mono">
              Total Inventario: {totalOwned + totalRepeated} Cromos
            </span>
          </div>
        </div>
      </div>

      {/* Main Charts Block - Group Stage Progress */}
      <div className="bg-neutral-950/45 border border-neutral-900 rounded-2xl p-5 mb-6 hover:border-neutral-850 transition-all">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-6">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-neon-cyan/5 border border-neon-cyan/30 text-neon-cyan">
              <BarChart3 size={15} />
            </span>
            <div>
              <h3 className="text-sm font-display font-bold text-white uppercase tracking-wider">Distribución por Grupo</h3>
              <p className="text-[8px] uppercase tracking-wider text-neutral-500 font-mono mt-0.5">Avance ponderado según zona de clasificación</p>
            </div>
          </div>
          <span className="text-[8.5px] font-mono tracking-widest uppercase font-bold text-neutral-500 bg-neutral-900/60 py-1 px-2 rounded-lg border border-neutral-850">
            Pase de Grupos A-L y Especiales
          </span>
        </div>

        {/* Dynamic bar charts */}
        <div className="space-y-4">
          {groupStats.map((g) => {
            const isSelected = selectedGroup === g.key;
            const barFillColor = g.isComplete 
              ? 'bg-gradient-to-r from-neon-green to-emerald-400 shadow-[0_0_8px_#39ff14]'
              : g.key === 'especiales'
                ? 'bg-gradient-to-r from-amber-500 to-red-600 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                : 'bg-gradient-to-r from-neon-cyan to-blue-500 shadow-[0_0_8px_rgba(0,243,255,0.4)]';

            return (
              <div key={g.key} className="bg-neutral-900/20 border border-neutral-900 rounded-xl p-3 hover:bg-neutral-900/40 transition-colors">
                <button
                  onClick={() => setSelectedGroup(isSelected ? null : g.key)}
                  className="w-full flex items-center justify-between text-left cursor-pointer mb-2"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] w-20 font-display font-bold text-neutral-200 tracking-wide uppercase ${g.isComplete ? 'text-neon-green text-neon-green-glow' : ''}`}>
                      {g.name}
                    </span>
                    <span className="text-[8.5px] px-1.5 py-0.5 bg-neutral-950/70 rounded border border-neutral-850 text-neutral-500 font-mono">
                      {g.owned}/{g.total}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-mono font-black ${g.isComplete ? 'text-neon-green text-neon-green-glow' : 'text-neutral-300'}`}>
                      {g.percent}%
                    </span>
                    {isSelected ? <ChevronDown size={12} className="text-neutral-500" /> : <ChevronRight size={12} className="text-neutral-500" />}
                  </div>
                </button>

                {/* Progress bar container */}
                <div className="w-full bg-neutral-950 rounded-full h-2.5 p-[1px] border border-neutral-900 mb-1 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-750 ease-out ${barFillColor}`}
                    style={{ width: `${Math.max(1.5, g.percent)}%` }}
                  />
                </div>

                {/* Expanded single team break down inside this group */}
                {isSelected && (
                  <div className="mt-3 pt-3 border-t border-neutral-900/60 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in slide-in-from-top-1 duration-200">
                    {g.teamIds.map(teamId => {
                      const team = WORLD_CUP_TEAMS.find(t => t.id === teamId);
                      if (!team) return null;
                      const teamStickers = stickersByTeam.get(teamId) || [];
                      const ownedInTeam = teamStickers.filter(s => ownedStickers.has(s.id)).length;
                      const hasRepeatedInTeam = teamStickers.filter(s => (repeatedStickers[s.id] || 0) > 0).length;
                      const tPct = teamStickers.length > 0 ? (ownedInTeam / teamStickers.length) * 100 : 0;
                      
                      return (
                        <div key={teamId} className="bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-850/60 flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-display font-semibold text-neutral-200">{team.name}</span>
                            <span className="text-[10px] font-mono text-neutral-500">{ownedInTeam} / {teamStickers.length}</span>
                          </div>
                          
                          <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden mb-1.5">
                            <div 
                              className="h-full bg-neon-cyan" 
                              style={{ width: `${tPct}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[7px] text-neutral-500 uppercase font-mono font-bold">
                            <span>Completado: {tPct.toFixed(0)}%</span>
                            {hasRepeatedInTeam > 0 && <span className="text-amber-500">Tiene repetidas</span>}
                          </div>
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

      {/* Grid Heatmap Visual Card */}
      <div className="bg-neutral-950/45 border border-neutral-900 rounded-2xl p-5 hover:border-neutral-850 transition-all">
        <div className="flex items-center gap-2 mb-4">
          <span className="p-1.5 rounded-lg bg-neon-cyan/5 border border-neon-cyan/30 text-neon-cyan">
            <Activity size={15} />
          </span>
          <div>
            <h3 className="text-sm font-display font-bold text-white uppercase tracking-wider">Matriz de Colección Colectiva</h3>
            <p className="text-[8px] uppercase tracking-wider text-neutral-500 font-mono mt-0.5">Mini-bloques de densidad que reflejan el estado del cromo</p>
          </div>
        </div>

        <p className="text-[9px] text-neutral-500 mb-3 uppercase tracking-wider font-semibold">
          💡 Leyenda: 🟩 Obtenido (Verde)  |  ⬛ Faltante (Gris oscuro)  |  🟨 Tiene Repetidas (Amarillo/Naranja)
        </p>

        {/* Matrix representation of all stickers */}
        <div className="max-h-72 overflow-y-auto pr-1 bg-neutral-950 p-3 rounded-xl border border-neutral-900">
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-y-3 gap-x-2">
            {WORLD_CUP_TEAMS.map((team) => {
              const teamStickers = stickersByTeam.get(team.id) || [];
              
              return (
                <div key={team.id} className="flex flex-col gap-1 col-span-1">
                  <span className="text-[8px] font-mono font-black text-neutral-500 uppercase truncate" title={team.name}>
                    {team.prefix}
                  </span>
                  
                  <div className="flex flex-wrap gap-[2px]">
                    {teamStickers.map(s => {
                      const isOwned = ownedStickers.has(s.id);
                      const isRepeated = (repeatedStickers[s.id] || 0) > 0;
                      
                      let bgClass = 'bg-neutral-900 border border-neutral-850';
                      let title = `${s.prefix} ${s.number === 0 ? '00' : s.number} - Faltante`;
                      
                      if (isOwned) {
                        bgClass = 'bg-neon-green/80 shadow-[0_0_2px_#39ff14]';
                        title = `${s.prefix} ${s.number === 0 ? '00' : s.number} - Obtenida`;
                      }
                      if (isRepeated) {
                        bgClass = 'bg-amber-500 shadow-[0_0_2px_#ffbf00]';
                        title = `${s.prefix} ${s.number === 0 ? '00' : s.number} - Repetida (x${repeatedStickers[s.id]})`;
                      }

                      return (
                        <div
                          key={s.id}
                          className={`w-1.5 h-1.5 rounded-xs transition-colors ${bgClass}`}
                          title={title}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}
