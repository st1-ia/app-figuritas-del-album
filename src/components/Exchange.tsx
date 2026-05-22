import React, { useState } from 'react';
import { ArrowLeftRight, CheckCircle2 } from 'lucide-react';

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
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Hubo un error al realizar el intercambio.");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!givenPrefix || !givenNumber || !receivedPrefix || !receivedNumber) {
      setError("Por favor completa todos los campos.");
      return;
    }

    let givenBaseId = `${givenPrefix.toUpperCase().trim()}-${givenNumber.trim()}`;
    let receivedBaseId = `${receivedPrefix.toUpperCase().trim()}-${receivedNumber.trim()}`;

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
    <div className="w-full max-w-xl mx-auto p-4 pb-24">
      <div className="bg-zinc-900/60 backdrop-blur-xl rounded-3xl shadow-[0_24px_64px_rgba(0,0,0,0.65)] border border-zinc-800/80 overflow-hidden p-8 animate-in fade-in zoom-in-95 duration-300 mt-6 relative">
        {/* Glow detail background */}
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-[#00FFFF]/5 rounded-full blur-3xl pointer-events-none"></div>

        <h2 className="text-3xl font-display uppercase tracking-wider text-white text-center mb-4">Intercambio</h2>
        
        <p className="text-xs text-zinc-400 text-center mb-8 leading-relaxed max-w-sm mx-auto">
          Ingresa la figurita que entregas y la que recibes. Se actualizará tu álbum y tus repetidas de forma totalmente coordinada.
        </p>

        {error && (
          <div className="mb-6 text-center bg-red-500/10 border border-red-500/20 text-red-400 p-4 text-xs font-sans tracking-wide rounded-xl">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 flex flex-col items-center justify-center bg-[#00FF00]/10 border border-[#00FF00]/20 text-[#00FF00] p-4 text-xs font-sans tracking-wide rounded-xl animate-in fade-in">
            <CheckCircle2 size={24} className="mb-1.5 animate-bounce" />
            <span className="font-bold">¡Intercambio realizado con éxito!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="p-5 bg-zinc-950/40 rounded-2xl border border-zinc-800/80">
            <h3 className="text-xs font-display uppercase text-red-500 mb-4 tracking-widest text-center flex items-center justify-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              Figurita que Doy
            </h3>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-[9px] uppercase tracking-wider text-zinc-500 mb-1.5 font-bold">Prefijo (ARG)</label>
                <input
                  type="text"
                  value={givenPrefix}
                  onChange={(e) => setGivenPrefix(e.target.value)}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 py-3 text-white uppercase font-display text-xl text-center focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/30 transition-all placeholder:text-zinc-700"
                  placeholder="ARG"
                  maxLength={3}
                />
              </div>
              <div className="flex-1">
                <label className="block text-[9px] uppercase tracking-wider text-zinc-500 mb-1.5 font-bold">Número</label>
                <input
                  type="number"
                  value={givenNumber}
                  onChange={(e) => setGivenNumber(e.target.value)}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 py-3 text-white font-display text-xl text-center focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/30 transition-all placeholder:text-zinc-700"
                  placeholder="10"
                  min="0"
                  max="99"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-center -my-3 relative z-10">
            <div className="bg-zinc-900 px-3.5 py-1.5 rounded-full border border-zinc-800 flex items-center gap-1.5 shadow-md">
              <ArrowLeftRight size={14} className="text-[#00FFFF]" />
              <span className="text-[9px] uppercase tracking-widest font-mono text-zinc-500 font-bold">SWAP</span>
            </div>
          </div>

          <div className="p-5 bg-zinc-950/40 rounded-2xl border border-zinc-800/80">
            <h3 className="text-xs font-display uppercase text-[#00FF00] mb-4 tracking-widest text-center flex items-center justify-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FF00]"></span>
              Figurita que Recibo
            </h3>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-[9px] uppercase tracking-wider text-zinc-500 mb-1.5 font-bold">Prefijo (BRA)</label>
                <input
                  type="text"
                  value={receivedPrefix}
                  onChange={(e) => setReceivedPrefix(e.target.value)}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 py-3 text-white uppercase font-display text-xl text-center focus:border-[#00FF00] focus:outline-none focus:ring-1 focus:ring-[#00FF00]/30 transition-all placeholder:text-zinc-700"
                  placeholder="BRA"
                  maxLength={3}
                />
              </div>
              <div className="flex-1">
                <label className="block text-[9px] uppercase tracking-wider text-zinc-500 mb-1.5 font-bold">Número</label>
                <input
                  type="number"
                  value={receivedNumber}
                  onChange={(e) => setReceivedNumber(e.target.value)}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 py-3 text-white font-display text-xl text-center focus:border-[#00FF00] focus:outline-none focus:ring-1 focus:ring-[#00FF00]/30 transition-all placeholder:text-zinc-700"
                  placeholder="9"
                  min="0"
                  max="99"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-4 bg-[#00FFFF] hover:bg-[#00FFFF]/80 text-black py-4 rounded-xl font-display text-lg uppercase tracking-wider transition-all shadow-[0_4px_20px_rgba(0,255,255,0.2)] flex justify-center items-center gap-2.5 font-bold hover:scale-[1.01] active:scale-95 cursor-pointer"
          >
            <ArrowLeftRight size={20} strokeWidth={2.5} /> Confirmar Cambio
          </button>
        </form>
      </div>

      {confirmData && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-zinc-950/95 border border-zinc-800 rounded-2xl p-6.5 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-display uppercase text-white mb-2 tracking-wide">¿Confirmar cambio?</h3>
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
              Ya tienes la figurita recibida <strong className="text-white bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded font-mono text-[10px]">{confirmData.receivedId}</strong>. 
              Si aceptas el cambio, la entregada <strong className="text-white bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded font-mono text-[10px]">{confirmData.givenId}</strong> se descontará de tus repetidas y la recibida se agregará también a ellas.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setConfirmData(null)}
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white py-3 rounded-lg font-display uppercase tracking-widest transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => performExchange(confirmData.givenId, confirmData.receivedId)}
                className="flex-1 bg-[#00FF00] hover:bg-white text-black py-3 rounded-lg font-display uppercase tracking-widest transition-colors shadow-[0_0_15px_rgba(0,255,0,0.25)] font-bold cursor-pointer"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
