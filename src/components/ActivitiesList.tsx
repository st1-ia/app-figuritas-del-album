import React from 'react';
import { ActivityLog } from '../App';
import { Clock, History } from 'lucide-react';

export default function ActivitiesList({ activities }: { activities: ActivityLog[] }) {
  return (
    <div className="w-full max-w-xl mx-auto p-4 pb-24">
      <div className="bg-zinc-900/60 backdrop-blur-xl rounded-3xl border border-zinc-800/80 shadow-[0_24px_64px_rgba(0,0,0,0.65)] overflow-hidden p-8 animate-in fade-in zoom-in-95 duration-300 mt-6 relative">
        {/* Glow detail background */}
        <div className="absolute -top-10 -left-10 w-24 h-24 bg-[#00FFFF]/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col items-center justify-center text-center gap-2 mb-8">
            <History className="text-[#00FFFF]" size={36} />
            <h2 className="text-3xl font-display uppercase tracking-wider text-white">Actividad</h2>
            <p className="text-xs text-zinc-400 font-sans max-w-xs">El registro en tiempo real de tus movimientos e intercambios</p>
        </div>
        
        {activities.length === 0 ? (
          <div className="text-center text-zinc-500 py-12 font-sans text-xs">
            Aún no hay actividades registradas en esta sesión.
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((act) => {
              const date = new Date(act.timestamp);
              const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const dateString = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
              
              return (
                <div key={act.id} className="p-4 bg-zinc-950/40 rounded-2xl border border-zinc-800/85 flex items-start gap-4 hover:border-zinc-700/80 transition-all">
                  <div className="mt-0.5 bg-zinc-900 p-2.5 rounded-full border border-zinc-800">
                    <Clock size={14} className="text-[#00FF00]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-sans text-zinc-200 mb-1 leading-relaxed">{act.text}</p>
                    <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">
                       {dateString} - {timeString}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
