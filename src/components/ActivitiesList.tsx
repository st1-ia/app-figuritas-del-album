import React from 'react';
import { ActivityLog } from '../App';
import { Clock, History } from 'lucide-react';

export default function ActivitiesList({ activities }: { activities: ActivityLog[] }) {
  return (
    <div className="w-full max-w-xl mx-auto p-4 pb-24 text-neutral-200">
      <div className="bg-neutral-950/75 rounded-3xl border border-neutral-900 shadow-[0_0_20px_rgba(0,243,255,0.03)] overflow-hidden p-8 animate-in fade-in duration-355 mt-6 relative">
        <div className="flex flex-col items-center justify-center text-center gap-2 mb-8">
            <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neon-cyan mb-1 shadow-[0_0_8px_rgba(0,243,255,0.15)] text-neon-cyan-glow">
              <History size={24} />
            </div>
            <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest font-mono">Registro en la Nube</span>
            <h2 className="text-2xl font-display font-black uppercase tracking-wider text-white">Actividad</h2>
            <div className="w-12 h-0.5 bg-neon-cyan shadow-[0_0_6px_#00f3ff] mt-1.5 rounded"></div>
            <p className="text-xs text-neutral-450 font-sans mt-2 max-w-xs">El registro cronológico en tiempo real de tus movimientos, agregados e intercambios</p>
        </div>
        
        {activities.length === 0 ? (
          <div className="text-center text-neutral-500 py-16 border border-neutral-850 border-dashed rounded-2xl p-6 font-sans text-xs">
            Aún no hay actividades registradas en esta colección. ¡Comienza escaneando o editando tu álbum!
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((act) => {
              const date = new Date(act.timestamp);
              const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const dateString = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
              
              return (
                <div key={act.id} className="p-4 bg-neutral-950/80 rounded-2xl border border-neutral-900 flex items-start gap-4 hover:border-neutral-850 transition-all duration-300">
                  <div className="mt-0.5 bg-neutral-900 p-2.5 rounded-xl border border-neutral-850 shrink-0 text-neon-cyan">
                    <Clock size={13} />
                  </div>
                  <div className="flex-1 leading-normal">
                    <p className="text-xs font-sans text-neutral-300 mb-1.5 leading-relaxed">{act.text}</p>
                    <span className="text-[9px] font-mono font-bold text-neutral-500 uppercase tracking-widest block">
                       {dateString} • {timeString}
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
