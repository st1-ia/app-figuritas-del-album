import React, { useState, useEffect, useRef } from 'react';
import { parseCodesFromString } from '../data/stickers';
import { Sparkles, CheckCircle2, Send, X, AlertTriangle, Cloud, CloudLightning, CopyMinus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownedStickers: Set<string>;
  repeatedStickers: Record<string, number>;
  onAddStickers: (stickersList: { id: string; count: number }[], sourceText: string) => Promise<void>;
  isOnline: boolean;
}

export default function QuickAddModal({
  isOpen,
  onClose,
  ownedStickers,
  repeatedStickers,
  onAddStickers,
  isOnline
}: QuickAddModalProps) {
  const [inputValue, setInputValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<{ id: string; state: 'new' | 'repeated' }[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setIsSuccess(false);
      setIsSaving(false);
      setParsedPreview([]);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // Update parsed list on change
  useEffect(() => {
    if (!inputValue.trim()) {
      setParsedPreview([]);
      return;
    }
    const parsed = parseCodesFromString(inputValue);
    const previews = parsed.map(({ foundPrefix, num }) => {
      const id = foundPrefix === 'FWC' && num === 0 ? '00' : `${foundPrefix}-${num}`;
      const state = ownedStickers.has(id) ? 'repeated' : 'new';
      return { id, state };
    });
    setParsedPreview(previews);
  }, [inputValue, ownedStickers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isSaving) return;

    const parsed = parseCodesFromString(inputValue);
    if (parsed.length === 0) {
      alert("No se reconocieron códigos de figuritas. Intentá con marcas como 'ARG 10', 'DE 5', 'FWC 00' o 'BRA 5'.");
      return;
    }

    setIsSaving(true);

    try {
      let addedList: string[] = [];
      let repeatedList: string[] = [];

      const preparedList = parsed.map(({ foundPrefix, num }) => {
        const id = foundPrefix === 'FWC' && num === 0 ? '00' : `${foundPrefix}-${num}`;
        
        if (!ownedStickers.has(id)) {
          addedList.push(id);
        } else {
          repeatedList.push(id);
        }

        return { id, count: 1 };
      });

      const addedText = addedList.length > 0 ? `Álbum: ${addedList.join(', ')}` : '';
      const repeatedText = repeatedList.length > 0 ? `Repetidas: ${repeatedList.join(', ')}` : '';
      const joiner = addedText && repeatedText ? ' | ' : '';
      const sourceText = `[Carga Rápida Instantánea] ${addedText}${joiner}${repeatedText}`;

      // Persist directly to Firestore/LocalStorage
      await onAddStickers(preparedList, sourceText);
      
      setIsSaving(false);
      setIsSuccess(true);
      
      // Auto close after 1.5s so the user is took back to see the album updated
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err) {
      console.error(err);
      alert("Ocurrió un error al guardar. Intentá nuevamente.");
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop glass */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => { if (!isSaving && !isSuccess) onClose(); }}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
          id="modal-backdrop"
        />

        {/* Modal Main Dialog - Standard human literal styling */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 15 }}
          className="relative w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-2xl shadow-[0_0_30px_rgba(0,243,255,0.15)] overflow-hidden z-10 p-5"
          id="quickadd-modal-box"
        >
          {/* Glowing Top Frame Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-neon-cyan via-neutral-900 to-neon-cyan" />

          {/* Close button */}
          {!isSaving && !isSuccess && (
            <button
              onClick={onClose}
              id="close-modal-btn"
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer border border-neutral-800"
            >
              <X size={15} />
            </button>
          )}

          {/* Modal Header */}
          <div className="mb-4 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-neon-cyan/10 border border-neon-cyan/20 flex items-center justify-center text-neon-cyan animate-pulse">
              <Sparkles size={14} />
            </div>
            <div>
              <h3 className="font-sans font-black text-white text-sm uppercase tracking-wider">
                Carga Instantánea
              </h3>
              <p className="text-[10px] text-neutral-500 font-mono">
                BASE DE DATOS EN LA NUBE
              </p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {isSuccess ? (
              // Success Screen with Check Animation
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="py-10 flex flex-col items-center justify-center text-center space-y-4"
                id="modal-success-screen"
              >
                <div className="p-3 bg-neon-green/10 border border-neon-green/20 rounded-full text-neon-green animate-bounce">
                  <CheckCircle2 size={48} className="shadow-[0_0_15px_rgba(57,255,20,0.3)] rounded-full" />
                </div>
                <div>
                  <h4 className="text-emerald-400 font-black tracking-tight text-lg font-sans">
                    ¡Sincronizado con Éxito!
                  </h4>
                  <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto">
                    Las figuritas se han registrado y guardado directamente en la base de datos de la Copa Tracker.
                  </p>
                </div>
              </motion.div>
            ) : (
              // Input & Form screen
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                className="space-y-4"
                id="modal-quickadd-form"
              >
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                    Escribí o dictá tus Códigos:
                  </label>
                  <p className="text-[11px] text-neutral-500 leading-relaxed">
                    Escribí de corrido separando con espacio o comas, por ejemplo: <code className="text-white bg-neutral-900 px-1 rounded">ARG 10 BRA 5 FWC 00</code> o usá el micrófono del teclado 🎙️ de tu iPhone para dictar.
                  </p>
                  
                  <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    disabled={isSaving}
                    placeholder="Escribí acá... ej: ARG 10, SEN 5, DE 1"
                    rows={4}
                    className="w-full bg-neutral-900/60 border border-neutral-800 focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan/25 rounded-xl p-3 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none transition-all font-mono resize-none shadow-inner"
                    id="modal-text-input"
                  />
                </div>

                {/* Live parsed previews banner */}
                {parsedPreview.length > 0 && (
                  <div className="bg-neutral-900/40 border border-neutral-900/80 rounded-xl p-3 space-y-1.5" id="parsed-preview-box">
                    <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block font-mono">
                      Cerrando en Base ({parsedPreview.length} detectadas):
                    </span>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                      {parsedPreview.map((item, idx) => (
                        <span 
                          key={idx} 
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 border ${
                            item.state === 'new' 
                              ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20' 
                              : 'bg-amber-500/10 text-amber-500 border-amber-500/10'
                          }`}
                        >
                          {item.id}
                          <span className="text-[8px] opacity-70">
                            {item.state === 'new' ? '🆕' : '✔'}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Connection backup warning */}
                <div className="flex items-center gap-2 px-3 py-2 border border-neutral-900 bg-neutral-900/20 rounded-xl text-[10px] text-neutral-400">
                  <Cloud size={13} className="text-neon-cyan" />
                  <span>
                    {isOnline 
                      ? "Conectado. Sincronización instantánea en la nube."
                      : "Modo offline. Se guardará localmente y se enviará luego."}
                  </span>
                </div>

                {/* Main Submit action */}
                <button
                  type="submit"
                  disabled={isSaving || !inputValue.trim()}
                  id="confirm-quickadd-btn"
                  className="w-full h-11 bg-neon-cyan text-black font-sans font-black uppercase text-xs tracking-wider rounded-xl hover:opacity-95 disabled:opacity-40 select-none cursor-pointer shadow-[0_0_15px_rgba(0,243,255,0.3)] transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Sincronizando Base de Datos...</span>
                    </>
                  ) : (
                    <>
                      <Send size={13} strokeWidth={2.5} />
                      <span>Sincronizar y Cargar</span>
                    </>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
