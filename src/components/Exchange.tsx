import React, { useState } from 'react';
import { ArrowLeftRight, CheckCircle2, AlertTriangle, HelpCircle, RefreshCw } from 'lucide-react';

interface ExchangeProps {
  executeExchange: (givenId: string, receivedId: string) => Promise<void>;
  ownedStickers: Set<string>;
}

export default function Exchange({ executeExchange, ownedStickers }: ExchangeProps) {
  const [givenPrefix, setGivenPrefix] = useState('');
  const [givenNumber, setGivenNumber] = useState('');
  
  const [receivedPrefix, setReceivedPrefix] = useState('');
  const [receivedNumber, setReceivedNumber] = useState('');

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmData, setConfirmData] = useState<{ givenId: string, receivedId: string } | null>(null);

  const performExchange = async (givenId: string, receivedId: string) => {
    try {
      await executeExchange(givenId, receivedId);
      setSuccess(true);
      setError(null);
      setGivenPrefix('');
      setGivenNumber('');
      setReceivedPrefix('');
      setReceivedNumber('');
      setConfirmData(null);
      
      setTimeout(() => setSuccess(false), 3500);
    } catch (err: any) {
      setError(err.message || "Hubo un error al realizar el intercambio.");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!givenPrefix || !givenNumber || !receivedPrefix || !receivedNumber) {
      setError("Por favor completa todos los campos del canje.");
      return;
    }

    let givenBaseId = `${givenPrefix.toUpperCase().trim()}-${givenNumber.trim()}`;
    let receivedBaseId = `${receivedPrefix.toUpperCase().trim()}-${receivedNumber.trim()}`;

    // Normalize FWC 00 inputs
    if (givenPrefix.toUpperCase().trim() === 'FWC' && (givenNumber.trim() === '0' || givenNumber.trim() === '00')) {
      givenBaseId = '00';
    }
    if (receivedPrefix.toUpperCase().trim() === 'FWC' && (receivedNumber.trim() === '0' || receivedNumber.trim() === '00')) {
      receivedBaseId = '00';
    }

    if (ownedStickers.has(receivedBaseId)) {
      setConfirmData({ givenId: givenBaseId, receivedId: receivedBaseId });
      return;
    }

    performExchange(givenBaseId, receivedBaseId);
  };

  return (
    <div className="w-full max-w-xl mx-auto p-4 pb-24 text-neutral-100 font-sans select-none">
      <div className="bg-neutral-950/70 border border-neutral-900 rounded-2xl overflow-hidden p-6 md:p-8 shadow-[0_0_15px_rgba(0,243,255,0.05)] animate-in fade-in duration-300 mt-4">
        
        <div className="flex flex-col items-center justify-center text-center mb-6">
          <span className="text-[9.5px] font-bold text-neutral-500 uppercase tracking-widest mb-1 font-mono">Registro de Canjes Directos</span>
          <h2 className="text-2xl font-display font-black uppercase tracking-tight text-white flex items-center gap-2">
            Canjear <span className="text-neon-cyan text-neon-cyan-glow">Stickers</span>
          </h2>
          <div className="w-12 h-1 bg-neon-cyan shadow-[0_0_8px_#00f3ff] mt-2 rounded-full"></div>
        </div>
        
        <p className="text-xs text-neutral-400 text-center mb-6 leading-relaxed max-w-sm mx-auto">
          Ingresá el cromo que entregás y el que recibís a cambio. El sistema descontará tu repetida, agregará la nueva figurita al álbum y actualizará tu historial.
        </p>

        {error && (
          <div className="mb-5 text-center bg-red-950/40 border border-red-500/35 text-red-305 p-3 text-xs rounded-xl font-medium shadow-[0_0_10px_rgba(239,68,68,0.1)] flex items-center justify-center gap-1.5 font-sans">
            <AlertTriangle size={13} className="text-red-500" />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 flex flex-col items-center justify-center bg-neon-green/10 border border-neon-green/35 text-neon-green p-4 text-xs rounded-xl animate-in fade-in shadow-[0_0_12px_rgba(57,255,20,0.1)]">
            <CheckCircle2 size={22} className="mb-1.5 text-neon-green animate-pulse" />
            <span className="font-bold uppercase tracking-wider">¡Canje procesado con éxito! 🎉</span>
            <span className="text-neutral-400 text-[10px] mt-0.5">El álbum y las repetidas se actualizaron de inmediato.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Card I Give */}
          <div className="p-4 bg-neutral-900/30 border border-neutral-900 rounded-2xl relative overflow-hidden group hover:border-red-500/[0.15] transition-colors">
            <div className="absolute top-0 left-0 w-1 h-full bg-red-500/80 shadow-[2px_0_6px_rgba(239,68,68,0.4)]"></div>
            <h3 className="text-[10px] font-bold uppercase text-red-500 mb-3 tracking-widest text-center flex items-center justify-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
              Cromo que Entrego
            </h3>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[8px] uppercase tracking-wider text-neutral-500 mb-1 font-mono font-bold text-center">Prefijo (ARG)</label>
                <input
                  type="text"
                  value={givenPrefix}
                  onChange={(e) => setGivenPrefix(e.target.value)}
                  className="w-full bg-neutral-950/85 border border-neutral-850 rounded-xl px-2.5 py-3 text-white uppercase font-display font-black text-lg text-center focus:border-red-500 focus:outline-none transition-all placeholder:text-neutral-700 text-[16px] md:text-lg focus:shadow-[0_0_10px_rgba(239,68,68,0.15)]"
                  placeholder="ARG"
                  maxLength={3}
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-[8px] uppercase tracking-wider text-neutral-500 mb-1 font-mono font-bold text-center">Número</label>
                <input
                  type="number"
                  value={givenNumber}
                  onChange={(e) => setGivenNumber(e.target.value)}
                  className="w-full bg-neutral-950/85 border border-neutral-850 rounded-xl px-2.5 py-3 text-white font-display font-black text-lg text-center focus:border-red-500 focus:outline-none transition-all placeholder:text-neutral-700 text-[16px] md:text-lg focus:shadow-[0_0_10px_rgba(239,68,68,0.15)]"
                  placeholder="10"
                  min="0"
                  max="99"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex justify-center -my-3.5 relative z-10 select-none">
            <div className="bg-neutral-900 border border-neutral-800 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,0,0,0.8)]">
              <ArrowLeftRight size={11} className="text-neon-cyan text-neon-cyan-glow" />
              <span className="text-[8px] uppercase tracking-widest font-mono text-neutral-450 font-black">Transacción Mutua</span>
            </div>
          </div>

          {/* Card I Receive */}
          <div className="p-4 bg-neutral-900/30 border border-neutral-900 rounded-2xl relative overflow-hidden group hover:border-emerald-500/[0.15] transition-colors">
            <div className="absolute top-0 left-0 w-1 h-full bg-neon-green shadow-[2px_0_6px_rgba(57,255,20,0.4)]"></div>
            <h3 className="text-[10px] font-bold uppercase text-neon-green text-neon-green-glow mb-3 tracking-widest text-center flex items-center justify-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse shadow-[0_0_4px_#39ff14]"></span>
              Cromo que Recibo
            </h3>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-[8px] uppercase tracking-wider text-neutral-500 mb-1 font-mono font-bold text-center">Prefijo (BRA)</label>
                <input
                  type="text"
                  value={receivedPrefix}
                  onChange={(e) => setReceivedPrefix(e.target.value)}
                  className="w-full bg-neutral-950/85 border border-neutral-850 rounded-xl px-2.5 py-3 text-white uppercase font-display font-black text-lg text-center focus:border-neon-cyan focus:outline-none transition-all placeholder:text-neutral-700 text-[16px] md:text-lg focus:shadow-[0_0_10px_rgba(0,243,255,0.15)]"
                  placeholder="BRA"
                  maxLength={3}
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-[8px] uppercase tracking-wider text-neutral-500 mb-1 font-mono font-bold text-center">Número</label>
                <input
                  type="number"
                  value={receivedNumber}
                  onChange={(e) => setReceivedNumber(e.target.value)}
                  className="w-full bg-neutral-950/85 border border-neutral-850 rounded-xl px-2.5 py-3 text-white font-display font-black text-lg text-center focus:border-neon-cyan focus:outline-none transition-all placeholder:text-neutral-700 text-[16px] md:text-lg focus:shadow-[0_0_10px_rgba(0,243,255,0.15)]"
                  placeholder="9"
                  min="0"
                  max="99"
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-3 bg-neon-cyan hover:bg-cyan-400 text-black py-4 rounded-xl font-display font-black text-xs uppercase tracking-wider transition-all duration-200 flex justify-center items-center gap-2 cursor-pointer shadow-[0_0_12px_rgba(0,243,255,0.3)] active:scale-95"
          >
            <ArrowLeftRight size={14} className="stroke-[2.5]" /> Registrar Canje
          </button>
        </form>
      </div>

      {/* Confirmation Modal */}
      {confirmData && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-neutral-950 border border-neutral-850 rounded-2xl p-6 max-w-sm w-full shadow-[0_0_25px_rgba(245,158,11,0.15)] animate-in zoom-in-95 duration-150 text-neutral-200">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mb-4 shadow-[0_0_8px_rgba(245,158,11,0.2)] animate-pulse">
              <HelpCircle size={18} />
            </div>
            
            <h3 className="text-lg font-display font-black tracking-tight uppercase text-white mb-2 leading-tight">¿Confirmar Canje Duplicado?</h3>
            
            <div className="text-xs text-neutral-400 mb-5 leading-relaxed space-y-2.5">
              <p>
                Ya posees la figurita recibida <strong className="text-neon-cyan bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 rounded font-mono text-[9px] text-neon-cyan-glow">{confirmData.receivedId}</strong> en tu álbum. 
              </p>
              <p>
                Si procedés con el canje, la figurita que entregás <strong className="text-red-400 bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 rounded font-mono text-[9px]">{confirmData.givenId}</strong> se restará de tus repetidas y la recibida también se registrará en tus repetidas.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 font-sans">
              <button
                onClick={() => setConfirmData(null)}
                className="bg-neutral-900 hover:bg-neutral-850 text-neutral-400 py-3 rounded-xl font-display uppercase font-black tracking-wider text-[10px] border border-neutral-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => performExchange(confirmData.givenId, confirmData.receivedId)}
                className="bg-amber-500 hover:bg-amber-600 text-black py-3 rounded-xl font-display uppercase font-black tracking-wider text-[10px] shadow-[0_0_10px_rgba(245,158,11,0.3)] transition-all cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
