import React, { useState } from 'react';
import { parseCodesFromString } from '../data/stickers';
import { Sparkles, CheckCircle2, ArrowLeft, Send, HelpCircle, Smartphone, Copy, Check, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QuickAddProps {
  ownedStickers: Set<string>;
  repeatedStickers: Record<string, number>;
  onAddStickers: (stickersList: { id: string; count: number }[], sourceText: string) => Promise<void>;
  autoAddStatus: {
    added: string[];
    repeated: string[];
    invalid: string[];
  } | null;
  onBackToAlbum: () => void;
  isOnline: boolean;
}

export default function QuickAdd({
  ownedStickers,
  repeatedStickers,
  onAddStickers,
  autoAddStatus,
  onBackToAlbum,
  isOnline
}: QuickAddProps) {
  const [inputValue, setInputValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [manualAddStatus, setManualAddStatus] = useState<{
    added: string[];
    repeated: string[];
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedBackgroundLink, setCopiedBackgroundLink] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const getBackgroundBaseUrl = () => {
    return `${window.location.origin}/api/add-shortcut?add=`;
  };

  const copyBackgroundShortcutUrl = () => {
    const rawUrl = getBackgroundBaseUrl();
    navigator.clipboard.writeText(rawUrl).then(() => {
      setCopiedBackgroundLink(true);
      setTimeout(() => setCopiedBackgroundLink(false), 2000);
    });
  };

  // Parse and process manually entered stickers
  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    setIsSaving(true);
    setManualAddStatus(null);

    // Simulate small network delay or run sync
    setTimeout(async () => {
      const parsed = parseCodesFromString(inputValue);
      if (parsed.length > 0) {
        let addedList: string[] = [];
        let repeatedList: string[] = [];

        const preparedList = parsed.map(({ foundPrefix, num }) => {
          const id = foundPrefix === 'FWC' && num === 0 ? '00' : `${foundPrefix}-${num}`;
          const count = 1;
          
          if (!ownedStickers.has(id)) {
            addedList.push(id);
          } else {
            repeatedList.push(id);
          }

          return { id, count };
        });

        const addedText = addedList.length > 0 ? `Agregadas al álbum: ${addedList.join(', ')}.` : '';
        const repeatedText = repeatedList.length > 0 ? `Agregadas a repetidas: ${repeatedList.join(', ')}.` : '';
        const sourceText = `[Agregado Rápido Manual] ${addedText} ${repeatedText}`.trim();

        await onAddStickers(preparedList, sourceText);
        setManualAddStatus({
          added: addedList,
          repeated: repeatedList
        });
        setInputValue('');
      } else {
        alert("No se reconocieron códigos válidos de figuritas. Ejemplo: ARG 10, BRA 5");
      }
      setIsSaving(false);
    }, 450);
  };

  const copyShortcutUrl = () => {
    // If the user has a specific production site like GitHub Pages, use it or fallback to current origin
    const currentUrl = window.location.origin.includes('github.io') || window.location.origin.includes('ais-')
      ? 'https://st1-ia.github.io/app-figuritas-del-album/'
      : `${window.location.origin}${window.location.pathname}`;
    const quickAddUrl = `${currentUrl}?add=`;
    navigator.clipboard.writeText(quickAddUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const getBaseUrl = () => {
    return window.location.origin.includes('github.io') || window.location.origin.includes('ais-')
      ? 'https://st1-ia.github.io/app-figuritas-del-album/?add='
      : `${window.location.origin}${window.location.pathname}?add=`;
  };

  return (
    <div className="max-w-xl mx-auto py-2 px-1 text-neutral-100">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button 
          onClick={onBackToAlbum}
          className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors bg-neutral-900 border border-neutral-800 py-1.5 px-3 rounded-xl cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Volver al Álbum</span>
        </button>

        <span className="text-[10px] uppercase font-mono tracking-wider text-neon-cyan text-neon-cyan-glow">
          Modo Atajos / iPhone
        </span>
      </div>

      {/* Auto Add Success Banner (when coming directly from a URL link like Siri Shortcuts) */}
      <AnimatePresence>
        {autoAddStatus && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mb-8 p-6 rounded-2xl bg-gradient-to-b from-neutral-900 to-neutral-950 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)] relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -z-10" />
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-0.5">
                <CheckCircle2 size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-display font-black text-lg text-emerald-400 tracking-tight mb-1">
                  ¡Sincronización Exitosa!
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed mb-4">
                  Las figuritas del enlace se guardaron automáticamente en tu álbum digital y se sincronizaron con la nube.
                </p>

                {autoAddStatus.added.length > 0 && (
                  <div className="mb-2">
                    <span className="text-[10px] text-emerald-400/80 font-mono tracking-wider uppercase block mb-1">Añadidas al Álbum ({autoAddStatus.added.length})</span>
                    <div className="flex flex-wrap gap-1.5">
                      {autoAddStatus.added.map(code => (
                        <span key={code} className="bg-neutral-900 border border-emerald-500/20 text-emerald-400 text-xs font-mono px-2 py-0.5 rounded">
                          {code}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {autoAddStatus.repeated.length > 0 && (
                  <div>
                    <span className="text-[10px] text-amber-400/80 font-mono tracking-wider uppercase block mb-1">Añadidas a Repetidas ({autoAddStatus.repeated.length})</span>
                    <div className="flex flex-wrap gap-1.5">
                      {autoAddStatus.repeated.map(code => (
                        <span key={code} className="bg-neutral-900 border border-amber-500/20 text-amber-400 text-xs font-mono px-2 py-0.5 rounded">
                          {code}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {autoAddStatus.added.length === 0 && autoAddStatus.repeated.length === 0 && (
                  <p className="text-xs text-amber-400/80 font-medium">No se detectaron figuritas válidas en el enlace.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Quick Add Action Panel */}
      <div className="bg-neutral-950 border border-neutral-900 rounded-3xl p-6 mb-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-44 h-44 bg-neon-cyan/5 rounded-full blur-3xl -z-10" />
        
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neon-cyan/20 text-neon-cyan flex items-center justify-center">
            <Sparkles size={16} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight leading-tight">Agregar Figuritas al Instante</h2>
            <p className="text-[10px] text-neutral-400">Perfecto para dictar por voz o escribir rápido</p>
          </div>
        </div>

        <form onSubmit={handleManualAdd} className="space-y-4">
          <div>
            <textarea
              rows={2}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ej: ARG 10, BRA 4, MEX 15, FWC 0..."
              disabled={isSaving}
              className="w-full bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 text-sm font-sans placeholder-neutral-600 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 text-white disabled:opacity-50 transition-all resize-none"
            />
            <p className="text-[9px] text-neutral-500 mt-1.5 leading-relaxed">
              * Escribí o dictá los códigos libres. El sistema limpia símbolos, guiones y letras de forma inteligente (ej: podés dictar "Argentina diez brasil cuatro").
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[9px] font-mono tracking-wider text-neutral-400">
              {isOnline ? "● CONECTADO EN TIEMPO REAL" : "○ MODO RETENIDO OFFLINE"}
            </span>

            <button
              type="submit"
              disabled={isSaving || !inputValue.trim()}
              className="flex items-center gap-2 bg-neon-cyan hover:bg-neon-cyan/95 text-black font-semibold text-xs py-2 px-5 rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_12px_rgba(0,243,255,0.25)] hover:shadow-[0_0_15px_rgba(0,243,255,0.4)]"
            >
              {isSaving ? (
                <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send size={12} />
                  <span>Cargar Figuritas</span>
                </>
              )}
            </button>
          </div>
        </form>
 
        {/* Manual Add Result Output */}
        <AnimatePresence>
          {manualAddStatus && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-5 pt-4 border-t border-neutral-900 space-y-3"
            >
              <h4 className="text-xs font-semibold text-emerald-400">¡Figuritas Procesadas!</h4>
              
              {manualAddStatus.added.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[9px] text-neutral-400 block font-mono">AGREGADAS AL ÁLBUM</span>
                  <div className="flex flex-wrap gap-1">
                    {manualAddStatus.added.map(code => (
                      <span key={code} className="bg-neutral-900 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono px-2 py-0.5 rounded">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {manualAddStatus.repeated.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[9px] text-neutral-400 block font-mono">CONVERTIDAS EN REPETIDAS</span>
                  <div className="flex flex-wrap gap-1">
                    {manualAddStatus.repeated.map(code => (
                      <span key={code} className="bg-neutral-900 border border-amber-500/20 text-amber-400 text-[10px] font-mono px-2 py-0.5 rounded">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Guide Toggle Section */}
      <div className="bg-neutral-950 border border-neutral-900 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Smartphone className="text-neon-cyan" size={18} />
            <h3 className="text-xs font-bold text-white tracking-widest uppercase">¿Cómo Funciona en tu iPhone?</h3>
          </div>
          <button 
            onClick={() => setShowGuide(!showGuide)}
            className="text-xs text-neon-cyan hover:underline cursor-pointer bg-neutral-900 border border-neutral-800 py-1 px-2.5 rounded-lg flex items-center gap-1"
          >
            <HelpCircle size={12} />
            <span>{showGuide ? "Ocultar Guía" : "Ver Instrucciones"}</span>
          </button>
        </div>

        <p className="text-xs text-neutral-400 leading-relaxed">
          Diseñamos esta vista para que puedas vincular el álbum digital con la app nativa <strong className="text-white">Atajos (Shortcuts)</strong> de tu iPhone. Esto te permite dictarle figuritas a Siri o tipearlas directo desde la pantalla de inicio sin tener que abrir Safari ni cargar el álbum entero.
        </p>

        {showGuide && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 pt-4 text-xs border-t border-neutral-900"
          >
            {/* Github Pages Warning */}
            {window.location.hostname.includes('github.io') && (
               <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex gap-3 items-start">
                 <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                 <div>
                   <span className="font-bold text-amber-500 block">Estás usando GitHub Pages</span>
                   <p className="text-neutral-400 mt-1">Como tu app está alojada en GitHub Pages (no tiene servidor de fondo), el <span className="font-bold text-white">MÉTODO 1 (De Fondo) NO funcionará</span>. Por favor, utilizá directamente el <strong className="text-white">MÉTODO 2 (Abrir App)</strong> para interactuar con la pantalla.</p>
                 </div>
               </div>
            )}

            {/* Opción A: Segundo Plano */}
            <div className={`bg-neutral-900/40 border border-neutral-800 rounded-2xl p-4 space-y-3 ${window.location.hostname.includes('github.io') ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-neon-cyan animate-ping" />
                <h4 className="text-sm font-bold text-neon-cyan tracking-tight uppercase">
                  MÉTODO 1: CARGA DE FONDO (SÚPER RECOMENDADO 🔥)
                </h4>
              </div>
              <p className="text-neutral-300 leading-relaxed">
                Este método es el más mágico: <strong className="text-white">te permite dictar o escribir tús figuritas sin salir de tu pantalla de inicio ni abrir Safari</strong>. Guarda directamente en Firestore y te avisa con un globito en tu iPhone.
              </p>

              <div className="space-y-2 pt-1">
                <span className="text-[10px] text-neutral-400 font-mono tracking-wider uppercase block">Paso A: Copiá tu enlace API de Fondo</span>
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    readOnly
                    value={getBackgroundBaseUrl()}
                    className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-[10px] font-mono text-neutral-400 flex-1 overflow-x-auto focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={copyBackgroundShortcutUrl}
                    className="bg-neon-cyan hover:bg-neon-cyan/95 text-black p-2 rounded-xl cursor-pointer transition-colors"
                  >
                    {copiedBackgroundLink ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                {copiedBackgroundLink && (
                  <span className="text-[10px] text-emerald-400 font-mono block">¡Enlace API de fondo copiado!</span>
                )}
              </div>

              <div className="space-y-2 pt-2">
                <span className="text-[10px] text-neutral-400 font-mono tracking-wider uppercase block">Paso B: Crear el Atajo en tu iPhone (Solución "Texto Enriquecido")</span>
                <p className="text-[11px] text-amber-500 bg-amber-500/10 px-2 py-1 rounded">⚠️ Si te da el error de "Texto Enriquecido", es por los espacios. Seguí los pasos exactamente así:</p>
                <ol className="list-decimal pl-5 space-y-2 text-neutral-300">
                  <li>Abrí la app <strong className="text-white">Atajos</strong> en tu iPhone y tocá <strong className="text-white">+</strong> para crear uno nuevo.</li>
                  <li>Agregá la acción <strong className="text-white">Solicitar entrada</strong> (Ask for Input) con la pregunta: <em className="text-neutral-400">"¿Qué figuritas querés agregar?"</em>.</li>
                  <li><span className="text-neon-cyan">¡MUY IMPORTANTE!</span> Agregá la acción <strong className="text-white">Codificar URL</strong> (URL Encode). Asegurate de que diga "Codificar <strong className="text-white">Entrada Provista</strong>". (Esto elimina los espacios y resuelve el error de texto enriquecido).</li>
                  <li>Ahora agregá la acción <strong className="text-white">URL</strong> y pegá el <strong>Enlace API</strong> que copiaste. Justo al final (después del "="), insertá la variable rápida <strong className="text-neon-cyan">Texto codificado como URL</strong>.</li>
                  <li>Agregá la acción <strong className="text-white">Obtener contenido de URL</strong> (Get contents of URL). Debería decir "de URL".</li>
                  <li>Agregá la acción <strong className="text-white">Mostrar alerta</strong> y pasale la variable que dice <strong className="text-neon-cyan font-mono">Contenido de la URL</strong>.</li>
                  <li>¡Listo! Guardalo con un nombre genial y agregalo a tu pantalla de inicio como Widget o Icono.</li>
                </ol>
              </div>

              <div className="bg-neutral-950/60 p-3 rounded-xl border border-neutral-900 text-neutral-400 space-y-1">
                <span className="text-xs font-bold text-white block">💬 ¿Cómo se usa?</span>
                <p className="leading-relaxed">
                  Presionás el atajo en tu pantalla, te pregunta qué figuritas tenés, escribís o dictás <em className="text-neutral-300">"ARG 10, DE 5, SEN 1"</em> y al toque te salta un globito en tu pantalla diciendo: <strong className="text-neon-cyan">"Sincronizado: Cargar al Álbum: ARG-10..."</strong> sin abrir Safari ni la App. ¡Magia pura!
                </p>
              </div>
            </div>

            {/* Opción B: Abrir App */}
            <div className={`bg-neutral-900/20 border border-neutral-900 rounded-2xl p-4 space-y-3 ${window.location.hostname.includes('github.io') ? 'border-neon-cyan/50 shadow-[0_0_15px_rgba(0,243,255,0.1)]' : ''}`}>
              <div className="flex items-center gap-2">
                <Smartphone className="text-neutral-400" size={16} />
                <h4 className="text-xs font-bold text-neutral-300 tracking-tight uppercase">
                  MÉTODO 2: CARGA ABRIENDO LA APP {window.location.hostname.includes('github.io') && <span className="text-neon-cyan">(Recomendado)</span>}
                </h4>
              </div>
              <p className="text-neutral-400 leading-relaxed">
                Este método abre la app para procesar las figuritas. Es simple y no requiere codificación de URL avanzada.
              </p>

              <div className="space-y-2">
                <span className="text-[10px] text-neutral-500 font-mono tracking-wider block">Paso A: Copiá tu enlace de la App</span>
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    readOnly
                    value={getBaseUrl()}
                    className="bg-neutral-950 border border-neutral-900 rounded-xl px-3 py-1.5 text-[10px] font-mono text-neutral-500 flex-1 overflow-x-auto focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={copyShortcutUrl}
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 p-2 rounded-xl cursor-pointer transition-colors"
                  >
                    {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                {copiedLink && (
                  <span className="text-[10px] text-emerald-500/80 font-mono block">¡Enlace de la App copiado!</span>
                )}
              </div>

              <div className="space-y-1.5 pl-2 text-neutral-400">
                <p>1. Creá un atajo con una sola acción: <strong className="text-neutral-200">Abrir URL</strong>.</p>
                <p>2. Pegá el enlace anterior y configuralo para <strong className="text-neon-cyan font-mono">[Preguntar cada vez]</strong> (o Ask Each Time) justo al final después del igual.</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

    </div>
  );
}
