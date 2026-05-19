import React, { useState } from 'react';
import { ArrowLeftRight, CheckCircle2 } from 'lucide-react';

interface ExchangeProps {
  executeExchange: (givenId: string, receivedId: string) => Promise<void>;
}

export default function Exchange({ executeExchange }: ExchangeProps) {
  const [givenPrefix, setGivenPrefix] = useState('');
  const [givenNumber, setGivenNumber] = useState('');
  
  const [receivedPrefix, setReceivedPrefix] = useState('');
  const [receivedNumber, setReceivedNumber] = useState('');

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
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

    try {
      await executeExchange(givenBaseId, receivedBaseId);
      setSuccess(true);
      setError(null);
      setGivenPrefix('');
      setGivenNumber('');
      setReceivedPrefix('');
      setReceivedNumber('');
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Hubo un error al realizar el intercambio.");
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto p-4 pb-24">
      <div className="bg-[#111] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-[#333] overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-300 mt-6">
        <h2 className="text-2xl font-display uppercase tracking-wider text-white text-center mb-6">Intercambio</h2>
        
        <p className="text-sm text-gray-400 text-center mb-8">
          Ingresa la figurita que entregás y la figurita que recibís. Se actualizará tu álbum y tus repetidas automáticamente.
        </p>

        {error && (
          <div className="mb-6 text-center bg-[#FF0000]/10 border border-[#FF0000]/30 text-[#FF0000] p-4 text-sm font-sans tracking-wide rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 flex flex-col items-center justify-center bg-[#00FF00]/10 border border-[#00FF00]/30 text-[#00FF00] p-4 text-sm font-sans tracking-wide rounded-lg">
            <CheckCircle2 size={32} className="mb-2" />
            <span>¡Intercambio realizado con éxito!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          
          <div className="p-4 bg-[#1a1a1a] rounded-xl border border-[#333]">
            <h3 className="text-sm font-display uppercase text-red-400 mb-4 tracking-widest text-center">Figurita que Doy</h3>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Prefijo (ej. ARG)</label>
                <input
                  type="text"
                  value={givenPrefix}
                  onChange={(e) => setGivenPrefix(e.target.value)}
                  className="w-full bg-black border border-[#444] rounded-lg px-4 py-3 text-white uppercase font-display text-xl text-center focus:border-red-400 focus:outline-none transition-colors"
                  placeholder="ARG"
                  maxLength={3}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Número</label>
                <input
                  type="number"
                  value={givenNumber}
                  onChange={(e) => setGivenNumber(e.target.value)}
                  className="w-full bg-black border border-[#444] rounded-lg px-4 py-3 text-white font-display text-xl text-center focus:border-red-400 focus:outline-none transition-colors"
                  placeholder="10"
                  min="0"
                  max="99"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-center -my-4 relative z-10">
            <div className="bg-[#111] p-2 rounded-full border-2 border-[#333]">
              <ArrowLeftRight size={24} className="text-gray-400" />
            </div>
          </div>

          <div className="p-4 bg-[#1a1a1a] rounded-xl border border-[#333]">
            <h3 className="text-sm font-display uppercase text-[#00FF00] mb-4 tracking-widest text-center">Figurita que Recibo</h3>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Prefijo (ej. BRA)</label>
                <input
                  type="text"
                  value={receivedPrefix}
                  onChange={(e) => setReceivedPrefix(e.target.value)}
                  className="w-full bg-black border border-[#444] rounded-lg px-4 py-3 text-white uppercase font-display text-xl text-center focus:border-[#00FF00] focus:outline-none transition-colors"
                  placeholder="BRA"
                  maxLength={3}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Número</label>
                <input
                  type="number"
                  value={receivedNumber}
                  onChange={(e) => setReceivedNumber(e.target.value)}
                  className="w-full bg-black border border-[#444] rounded-lg px-4 py-3 text-white font-display text-xl text-center focus:border-[#00FF00] focus:outline-none transition-colors"
                  placeholder="9"
                  min="0"
                  max="99"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-8 bg-[#00FFFF] hover:bg-white text-black py-4 rounded-xl font-display text-xl uppercase tracking-widest transition-colors shadow-[0_0_20px_rgba(0,255,255,0.3)] flex justify-center items-center gap-3"
          >
            <ArrowLeftRight size={24} strokeWidth={2.5} /> Confirmar Cambio
          </button>
        </form>
      </div>
    </div>
  );
}
