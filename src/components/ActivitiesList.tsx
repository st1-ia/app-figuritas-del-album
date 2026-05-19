import React from 'react';
import { ActivityLog } from '../App';
import { Clock, History } from 'lucide-react';

export default function ActivitiesList({ activities }: { activities: ActivityLog[] }) {
  return (
    <div className="w-full max-w-xl mx-auto p-4 pb-24">
      <div className="bg-[#111] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-[#333] overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="flex items-center justify-center gap-3 mb-8">
            <History className="text-[#00FF00]" size={28} />
            <h2 className="text-2xl font-display uppercase tracking-wider text-white text-center">Historial de Actividad</h2>
        </div>
        
        {activities.length === 0 ? (
          <div className="text-center text-gray-500 py-10 font-sans text-sm">
            Aún no hay actividades registradas.
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((act) => {
              const date = new Date(act.timestamp);
              const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const dateString = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
              
              return (
                <div key={act.id} className="p-4 bg-[#1a1a1a] rounded-lg border border-[#333] flex items-start gap-4">
                  <div className="mt-1 bg-[#222] p-2 rounded-full border border-[#444]">
                    <Clock size={16} className="text-[#00FF00]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-sans text-white mb-1 leading-relaxed">{act.text}</p>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
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
