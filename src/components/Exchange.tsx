import React, { useState } from 'react';
import { ArrowLeftRight, CheckCircle2, RotateCcw, HelpCircle } from 'lucide-react';

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
      setError("Por favor completa todos los campos del canje.");
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
    <div className="w-full max-w-xl mx-auto p-4 pb-24 text-slate-800">
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden p-6 md:p-8 shadow-sm animate-in fade-in duration-300 mt-4">
        
        <div className="flex flex-col items-center justify-center text-center mb-6">
          <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest mb-1 font-mono">Registro de Transacciones</span>
          <h2 className="text-2xl font-display font-black uppercase tracking-tight text-slate-900 font-sans">Intercambio</h2>
          <div className="w-10 h-0.5 bg-slate-900 mt-2 rounded"></div>
        </div>
        
        <p className="text-xs text-slate-500 text-center mb-6 leading-relaxed max-w-sm mx-auto">
          Ingresa el cromo que entregas y el que recibes a cambio. El sistema actualizará tu colección y tus repetidas de forma coordinada.
        </p>

        {error && (
          <div className="mb-5 text-center bg-rose-50 border border-rose-200 text-rose-700 p-3 text-xs rounded-xl font-sans font-medium">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 flex flex-col items-center justify-center bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 text-xs rounded-xl animate-in fade-in">
            <CheckCircle2 size={20} className="mb-1 text-emerald-600 animate-bounce" />
            <span className="font-bold">¡Canje procesado con éxito!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Card I Give */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <h3 className="text-[10px] font-bold uppercase text-rose-600 mb-3 tracking-wider text-center flex items-center justify-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              Figurita que Entrego
            </h3>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[8px] uppercase tracking-wider text-slate-500 mb-1 font-mono font-medium">Prefijo (ej: ARG)</label>
                <input
                  type="text"
                  value={givenPrefix}
                  onChange={(e) => setGivenPrefix(e.target.value)}
                  className="w-full bg-white border border-slate-205 rounded-lg px-2.5 py-2.5 text-slate-800 uppercase font-display font-bold text-lg text-center focus:border-slate-800 focus:outline-none transition-all placeholder:text-slate-300 text-[16px] md:text-lg"
                  placeholder="ARG"
                  maxLength={3}
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-[8px] uppercase tracking-wider text-slate-500 mb-1 font-mono font-medium">Número</label>
                <input
                  type="number"
                  value={givenNumber}
                  onChange={(e) => setGivenNumber(e.target.value)}
                  className="w-full bg-white border border-slate-205 rounded-lg px-2.5 py-2.5 text-slate-800 font-display font-bold text-lg text-center focus:border-slate-800 focus:outline-none transition-all placeholder:text-slate-300 text-[16px] md:text-lg animate-none"
                  placeholder="10"
                  min="0"
                  max="99"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex justify-center -my-3 relative z-10">
            <div className="bg-white px-3.5 py-1 rounded-full border border-slate-200 flex items-center gap-1.5 shadow-xs">
              <ArrowLeftRight size={11} className="text-slate-700" />
              <span className="text-[8.5px] uppercase tracking-wider font-mono text-slate-500 font-bold">Intercambio Mutuo</span>
            </div>
          </div>

          {/* Card I Receive */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <h3 className="text-[10px] font-bold uppercase text-emerald-600 mb-3 tracking-wider text-center flex items-center justify-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 font-sans"></span>
              Figurita que Recibo
            </h3>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-[8px] uppercase tracking-wider text-slate-500 mb-1 font-mono font-medium">Prefijo (ej: BRA)</label>
                <input
                  type="text"
                  value={receivedPrefix}
                  onChange={(e) => setReceivedPrefix(e.target.value)}
                  className="w-full bg-white border border-slate-205 rounded-lg px-2.5 py-2.5 text-slate-800 uppercase font-display font-bold text-lg text-center focus:border-slate-800 focus:outline-none transition-all placeholder:text-slate-300 text-[16px] md:text-lg"
                  placeholder="BRA"
                  maxLength={3}
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-[8px] uppercase tracking-wider text-slate-500 mb-1 font-mono font-medium">Número</label>
                <input
                  type="number"
                  value={receivedNumber}
                  onChange={(e) => setReceivedNumber(e.target.value)}
                  className="w-full bg-white border border-slate-205 rounded-lg px-2.5 py-2.5 text-slate-800 font-display font-bold text-lg text-center focus:border-slate-800 focus:outline-none transition-all placeholder:text-slate-300 text-[16px] md:text-lg animate-none"
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
            className="w-full mt-3 bg-slate-900 hover:bg-slate-850 text-white py-3.5 rounded-xl font-display font-bold text-sm uppercase tracking-wider transition-all flex justify-center items-center gap-2 cursor-pointer shadow-sm active:scale-95"
          >
            <ArrowLeftRight size={14} strokeWidth={2.5} /> Registrar Canje
          </button>
        </form>
      </div>

      {/* Confirmation Modal */}
      {confirmData && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-sm w-full shadow-xl animate-in zoom-in-95 duration-150 text-slate-850">
            <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 text-amber-650 flex items-center justify-center mb-4">
              <HelpCircle size={18} />
            </div>
            
            <h3 className="text-xl font-display font-bold uppercase text-slate-900 mb-2 tracking-wide font-sans">¿Confirmar Canje?</h3>
            
            <div className="text-xs text-slate-505 mb-5 leading-relaxed space-y-2">
              <p>
                Ya tienes la figurita recibida <strong className="text-slate-900 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono text-[9px]">{confirmData.receivedId}</strong> en tu álbum. 
              </p>
              <p>
                Si realizas el canje igual, la figurita que entregas <strong className="text-slate-900 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono text-[9px]">{confirmData.givenId}</strong> se descontará de tus repetidas y la recibida también se sumará a tus repetidas.
              </p>
            </div>

            <div className="flex gap-3 font-sans">
              <button
                onClick={() => setConfirmData(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-lg font-display uppercase font-bold tracking-wider text-[10px] border border-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => performExchange(confirmData.givenId, confirmData.receivedId)}
                className="flex-1 bg-slate-900 hover:bg-slate-805 text-white py-2.5 rounded-lg font-display uppercase font-bold tracking-wider text-[10px] transition-all cursor-pointer"
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
