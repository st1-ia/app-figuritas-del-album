import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Check, AlertCircle, Loader2, Type as TypeIcon, CopyPlus, Trash2, Plus, Minus, ListOrdered } from 'lucide-react';
import Tesseract from 'tesseract.js';
import { WORLD_CUP_TEAMS, getAllStickers } from '../data/stickers';

interface ScannerProps {
  ownedStickers: Set<string>;
  repeatedStickers?: Record<string, number>;
  toggleOwned: (id: string, forceStatus?: boolean, context?: string) => void;
  updateRepeated?: (id: string, delta: number, context?: string) => void;
  addActivity?: (text: string) => void;
  batchSaveStickers?: (stickersList: { id: string; count: number }[]) => Promise<void>;
  isActive?: boolean;
}

export default function Scanner({ ownedStickers, repeatedStickers, toggleOwned, updateRepeated, addActivity, batchSaveStickers, isActive = true }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Tesseract.Worker | null>(null);
  
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [result, setResult] = useState<{ id: string; display: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamAction, setStreamAction] = useState<MediaStream | null>(null);
  
  const [addedToRepeated, setAddedToRepeated] = useState(false);
  const [removedFromRepeated, setRemovedFromRepeated] = useState(false);
  const [addedToAlbum, setAddedToAlbum] = useState(false);

  // Manual mode state
  const [manualMode, setManualMode] = useState<boolean>(false);
  const [manualInput, setManualInput] = useState<string>('');

  // Batch / Quick manual entry states
  const [batchManualInput, setBatchManualInput] = useState<string>('');
  const [batchManualSuccess, setBatchManualSuccess] = useState<string | null>(null);
  const [batchManualError, setBatchManualError] = useState<string | null>(null);

  // Scan modes and multiple scanning session states
  const [scanMode, setScanMode] = useState<'single' | 'multiple'>('single');
  const [sessionStickers, setSessionStickers] = useState<{ id: string; display: string; count: number }[]>([]);
  const [recentlyScanned, setRecentlyScanned] = useState<Record<string, number>>({});
  const recentlyScannedRef = useRef<Record<string, number>>({});
  const [isSessionFinished, setIsSessionFinished] = useState(false);
  const [flashSuccess, setFlashSuccess] = useState(false);
  const [lastScannedText, setLastScannedText] = useState<string | null>(null);

  // Precompute sticker order map to sort them in multiple session
  const stickers = getAllStickers();
  const stickerOrderMap = React.useMemo(() => {
    const map = new Map<string, number>();
    stickers.forEach((sticker, index) => {
      map.set(sticker.id, index);
    });
    return map;
  }, [stickers]);

  const sortedStickers = React.useMemo(() => {
    return [...sessionStickers].sort((a, b) => {
      const indexA = stickerOrderMap.get(a.id) ?? Infinity;
      const indexB = stickerOrderMap.get(b.id) ?? Infinity;
      return indexA - indexB;
    });
  }, [sessionStickers, stickerOrderMap]);

  // Audio helper beep
  const playBeep = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
       osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (err) {
      console.error("Audio beep failed:", err);
    }
  };

  const handleScannedInSession = (id: string, display: string, bypassTimer: boolean = false) => {
    const lastScannedTime = recentlyScannedRef.current[id] || 0;
    const now = Date.now();
    if (!bypassTimer && (now - lastScannedTime < 2500)) {
       // Avoid continuous automatic triggers
       return;
    }
    
    // Play beep sound and trigger screen flash
    playBeep();
    setFlashSuccess(true);
    setTimeout(() => setFlashSuccess(false), 250);
    
    // Temporary confirmation banner
    setLastScannedText(`¡Detectada: ${display}!`);
    setTimeout(() => {
      setLastScannedText((prev) => prev === `¡Detectada: ${display}!` ? null : prev);
    }, 2000);

    recentlyScannedRef.current[id] = now;
    setRecentlyScanned({ ...recentlyScannedRef.current });

    setSessionStickers((prev) => {
      const existing = prev.find(item => item.id === id);
      if (existing) {
         return prev.map(item => item.id === id ? { ...item, count: item.count + 1 } : item);
      } else {
         return [...prev, { id, display, count: 1 }];
      }
    });
  };
  
  // ... rest of the state declarations ...
  const [isScanning, setIsScanning] = useState(false);
  const isScanningRef = useRef(false);

  const [zoom, setZoom] = useState(1);
  const [zoomCaps, setZoomCaps] = useState<{min: number, max: number, step: number} | null>(null);

  // Initialize Tesseract worker once
  useEffect(() => {
    let active = true;
    const initWorker = async () => {
      try {
        const worker = await Tesseract.createWorker('eng');
        if (!active) {
          worker.terminate();
          return;
        }
        await worker.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789- ',
        });
        workerRef.current = worker;
      } catch (err) {
        console.error("Tesseract initialization error:", err);
      }
    };
    initWorker();
    
    return () => {
      active = false;
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStreamAction(stream);
      setHasPermission(true);
      setError(null);

      // Check zoom capabilities
      const track = stream.getVideoTracks()[0];
      if (track.getCapabilities) {
        const capabilities = track.getCapabilities() as any;
        if (capabilities.zoom) {
          setZoomCaps({
            min: capabilities.zoom.min || 1,
            max: capabilities.zoom.max || 5,
            step: capabilities.zoom.step || 0.1
          });
          setZoom(capabilities.zoom.min || 1);
        }
      }
    } catch (err) {
      console.error("Camera access denied:", err);
      setHasPermission(false);
      setError("No pudimos acceder a tu cámara. Revisa los permisos e inténtalo de nuevo.");
    }
  };

  useEffect(() => {
    if (isActive && !manualMode) {
      startCamera();
    } else {
      if (streamAction) {
        streamAction.getTracks().forEach(track => track.stop());
        setStreamAction(null);
      }
    }
    return () => {
      if (streamAction) {
         streamAction.getTracks().forEach(track => track.stop());
      }
    };
  }, [manualMode, isActive]);

  const parseCodeString = (input: string, strict: boolean = false) => {
    // Limpiamos los caracteres y quitamos espacios
    const upperInput = input.toUpperCase().replace(/[^A-Z0-9\s\-_]/g, '');
    const noSpaces = upperInput.replace(/\s+/g, '');
    
    // Check for sticker 00 explicitly
    if (/(^|[^A-Z0-9])(00|OO|O0|0O)([^A-Z0-9]|$)/.test(noSpaces)) {
        return { foundPrefix: "00", num: 0 };
    }

    if (noSpaces.length < 3) return { foundPrefix: "", num: 0 };

    // Si es modo scanner estricto y la cadena es larguísima o no tiene numeros, descartamos
    if (strict && (noSpaces.length > 15 || !/[0-9OISBLZ]/.test(noSpaces))) {
      return { foundPrefix: "", num: 0 };
    }

    const lettersToNums = (str: string) => str.replace(/O/g, '0').replace(/Q/g, '0').replace(/I/g, '1').replace(/L/g, '1').replace(/S/g, '5').replace(/B/g, '8').replace(/Z/g, '2');
    const numsToLetters = (str: string) => str.replace(/0/g, 'O').replace(/1/g, 'I').replace(/5/g, 'S').replace(/8/g, 'B').replace(/2/g, 'Z');

    const textAsLetters = numsToLetters(noSpaces);

    for (const team of WORLD_CUP_TEAMS) {
        const p = team.prefix;
        const idx = textAsLetters.indexOf(p);
        
        if (idx !== -1) {
            // Verificar que no sea parte de una palabra más grande por accidente, 
            // aunque al ser figuritas, a veces las letras están pegadas.
            const after = noSpaces.substring(idx + p.length);
            const numMatch = /^[-_\.]?([A-Z0-9]{1,2})/.exec(after);
            
            if (numMatch) {
               const cleanNum = lettersToNums(numMatch[1]).replace(/[^0-9]/g, '');
               if (cleanNum.length > 0) {
                   const num = parseInt(cleanNum, 10);
                   const start = team.startNumber ?? 1;
                   if (num >= start && num <= team.count) {
                       // Si estamos en modo estricto, validar que no tenga demasiada basura antes o después
                       if (strict) {
                           const before = textAsLetters.substring(0, idx);
                           const afterNum = after.substring(numMatch[0].length);
                           // Si hay más de 3 caracteres ignorados, es probablemente ruido
                           if (before.length + afterNum.length > 4) {
                               continue; 
                           }
                       }
                       return { foundPrefix: team.prefix, num };
                   }
               }
            }
        }
    }
    
    return { foundPrefix: "", num: 0 };
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    
    const { foundPrefix, num } = parseCodeString(manualInput, false);

    if (foundPrefix === '00' && num === 0) {
        const resultId = '00';
        
        const isOwned = ownedStickers.has(resultId);
        if (addActivity) addActivity(`Busqué manualmente la figurita ${resultId} y el resultado fue: ${isOwned ? '¡Ya la tenía!' : '¡Me faltaba!'}`);

        setResult({
          id: resultId,
          display: '00'
        });
        setError(null);
        setManualInput('');
        setAddedToRepeated(false);
        setRemovedFromRepeated(false);
        setAddedToAlbum(false);
        return;
    } else if (foundPrefix) {
      const validTeam = WORLD_CUP_TEAMS.find(t => t.prefix === foundPrefix);
      
      const start = validTeam?.startNumber ?? 1;
      if (validTeam && num >= start && num <= validTeam.count) {
        const resultId = num === 0 && foundPrefix === 'FWC' ? '00' : `${foundPrefix}-${num}`;
        const display = num === 0 && foundPrefix === 'FWC' ? '00' : `${foundPrefix} ${num}`;
        
        const isOwned = ownedStickers.has(resultId);
        if (addActivity) addActivity(`Busqué manualmente la figurita ${resultId} y el resultado fue: ${isOwned ? '¡Ya la tenía!' : '¡Me faltaba!'}`);

        setResult({
          id: resultId,
          display: display
        });
        setError(null);
        setManualInput('');
        setAddedToRepeated(false);
        setRemovedFromRepeated(false);
        setAddedToAlbum(false);
        return;
      } else if (validTeam) {
        setError(`El número debe estar entre ${start} y ${validTeam.count}`);
        return;
      }
    }
    setError("Código no válido. Intenta algo como 'ARG 10', 'FWC 2' o '00'");
  };

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = Number(e.target.value);
    setZoom(newZoom);
    if (streamAction) {
      const track = streamAction.getVideoTracks()[0];
      track.applyConstraints({ advanced: [{ zoom: newZoom }] }).catch(err => console.error("Zoom NO soportado por el navegador:", err));
    }
  };

  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isScanningRef.current || result || manualMode || !workerRef.current || isSessionFinished) return;
    
    if (videoRef.current.readyState < 2) return;

    isScanningRef.current = true;
    setIsScanning(true);
    setError(null);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    
    if (context) {
      const frameAspect = 3.5;
      let frameWidth, frameHeight;
      
      frameWidth = video.videoWidth * 0.75;
      frameHeight = frameWidth / frameAspect;

      const startX = (video.videoWidth - frameWidth) / 2;
      const startY = (video.videoHeight - frameHeight) / 2;
      
      const cropWidth = frameWidth;
      const cropHeight = frameHeight;
      
      const cropX = startX;
      const cropY = startY;
      
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      
      context.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        
        const ret = await workerRef.current.recognize(dataUrl);
        const text = ret.data.text.trim();
        const conf = Math.round(ret.data.confidence ?? 0);
        
        console.log(`OCR: "${text}" | Confianza: ${conf}%`);
        
        // Requiere menos confianza para ser más rápido y robusto
        if (text.length >= 2 && conf > 40) {
           const { foundPrefix, num } = parseCodeString(text, false);

           if (foundPrefix === '00' && num === 0) {
               const resultId = '00';
               const display = '00';
               
               const isOwned = ownedStickers.has(resultId);
               if (addActivity) addActivity(`Escaneé la figurita ${resultId} y el resultado fue: ${isOwned ? '¡Ya la tenía!' : '¡Me faltaba!'}`);
               
               setResult({
                   id: resultId,
                   display: '00'
               });
               setError(null);
               setAddedToRepeated(false);
               setRemovedFromRepeated(false);
               setAddedToAlbum(false);
           } else if (foundPrefix) {
             const validTeam = WORLD_CUP_TEAMS.find(t => t.prefix === foundPrefix);          

             const start = validTeam?.startNumber ?? 1;
             if (validTeam && num >= start && num <= validTeam.count) {
                 const resultId = num === 0 && foundPrefix === 'FWC' ? '00' : `${validTeam.prefix}-${num}`;
                 const display = num === 0 && foundPrefix === 'FWC' ? '00' : `${validTeam.prefix} ${num}`;
                 
                 const isOwned = ownedStickers.has(resultId);
                 if (addActivity) addActivity(`Escaneé la figurita ${resultId} y el resultado fue: ${isOwned ? '¡Ya la tenía!' : '¡Me faltaba!'}`);

                 setResult({
                     id: resultId,
                     display: display
                 });
                 setError(null);
                 setAddedToRepeated(false);
                 setRemovedFromRepeated(false);
                 setAddedToAlbum(false);
             }
           }
        }
      } catch (err: any) {
        console.error("OCR Error: ", err);
      }
    }
    
    setIsScanning(false);
    isScanningRef.current = false;
  }, [result, manualMode, scanMode, isSessionFinished, ownedStickers]);

  useEffect(() => {
    let active = true;
    
    const scanLoop = async () => {
      if (isActive && !manualMode && !result && hasPermission && !isScanningRef.current && workerRef.current && !isSessionFinished) {
        await captureAndAnalyze();
      }
      
      if (active) {
        setTimeout(scanLoop, 300);
      }
    };
    
    if (isActive && !manualMode && !result && hasPermission && !isSessionFinished) {
      scanLoop();
    }
    
    return () => {
      active = false;
    };
  }, [manualMode, result, hasPermission, captureAndAnalyze, isSessionFinished, isActive]);

  const handleMarkAsOwned = () => {
    if (result) {
      const modeText = scanMode === 'multiple' ? ' (Lote)' : '';
      toggleOwned(result.id, true, `Agregué la figurita ${result.id} al álbum desde el escáner${modeText}.`);
      if (scanMode === 'multiple') {
        handleScannedInSession(result.id, result.display, true);
      }
      setAddedToAlbum(true);
    }
  };

  const handleMarkAsRepeated = () => {
    if (result && updateRepeated) {
      const modeText = scanMode === 'multiple' ? ' (Lote)' : '';
      updateRepeated(result.id, 1, `Agregué una repetida de la figurita ${result.id} desde el escáner${modeText} (Total: ${currentRepeatedCount + 1}).`);
      setAddedToRepeated(true);
      setRemovedFromRepeated(false);
    }
  };

  const handleRemoveFromRepeated = () => {
    if (result && updateRepeated) {
      const modeText = scanMode === 'multiple' ? ' (Lote)' : '';
      updateRepeated(result.id, -1, `Saqué una repetida de la figurita ${result.id} desde el escáner${modeText} (Quedan: ${Math.max(currentRepeatedCount - 1, 0)}).`);
      setRemovedFromRepeated(true);
      setAddedToRepeated(false);
    }
  };

  const isAlreadyOwned = result ? ownedStickers.has(result.id) : false;
  const rawRepeatedCount = result && repeatedStickers ? (repeatedStickers[result.id] || 0) : 0;
  
  // Calculate local effective repeat count considering local recent actions.
  // Actually, since Scanner re-renders when `repeatedStickers` updates, we can just use `rawRepeatedCount`.
  // Wait, if it updates fast enough, `rawRepeatedCount` is fine.
  // BUT because state in parent updates and syncs to DB, it might be safer to just rely on `rawRepeatedCount`.
  // Let's use `rawRepeatedCount` directly!
  const currentRepeatedCount = rawRepeatedCount;

  if (isSessionFinished) {
    return (
      <div className="w-full max-w-lg mx-auto p-4 pb-24 select-none">
        <div className="bg-[#111] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-[#333] overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="text-center mb-6">
            <span className="text-[10px] font-bold text-[#00FF00] uppercase tracking-widest bg-[#00FF00]/10 px-3.5 py-1 rounded-full border border-[#00FF00]/20">
              Pila Organizada
            </span>
            <h2 className="text-2xl font-display text-white mt-4 mb-2 uppercase tracking-wide">Orden para pegar</h2>
            <p className="text-gray-400 text-xs font-sans px-2 leading-relaxed">
              Organiza tu pila física de figuritas de modo que las que aparecen primero en el listado queden arriba de todo y las últimas al fondo. ¡Así podrás pegarlas en orden cronológico ultra rápido!
            </p>
          </div>

          <div className="space-y-2.5 my-6 max-h-[350px] overflow-y-auto pr-1">
            {sortedStickers.map((item, idx) => {
              const hasSticker = ownedStickers.has(item.id);
              const teamName = WORLD_CUP_TEAMS.find(t => t.prefix === item.id.split('-')[0])?.name || 'Especial';
              return (
                <div key={item.id} className="flex items-center gap-3 p-3 bg-black/40 border border-[#222] rounded-lg">
                  <div className="w-7 h-7 rounded-full bg-[#222] border border-[#333] flex items-center justify-center font-display text-xs text-[#00FF00] font-bold">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-white text-base tracking-wide">{item.display}</span>
                      {item.count > 1 && (
                        <span className="bg-[#00FF00]/10 text-[#00FF00] text-xs font-mono font-bold px-1.5 py-0.5 rounded border border-[#00FF00]/20">
                          x{item.count}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-500 uppercase font-sans tracking-wide mt-0.5 block">{teamName}</span>
                  </div>
                  
                  <div className="text-right">
                    <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded inline-block ${hasSticker ? 'bg-[#00FF00]/10 text-[#00FF00] border border-[#00FF00]/20' : 'bg-[#FF00FF]/10 text-[#FF00FF] border border-[#FF00FF]/25'}`}>
                      {hasSticker ? 'Repetida' : 'Nueva'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-3">
            <button
              onClick={() => {
                if (addActivity) {
                  addActivity(`Terminé de organizar mi pila de ${sessionStickers.length} figuritas escaneadas.`);
                }
                setSessionStickers([]);
                recentlyScannedRef.current = {};
                setRecentlyScanned({});
                setIsSessionFinished(false);
              }}
              className="w-full flex items-center justify-center gap-2 bg-[#00FF00] text-black py-4 rounded-xl font-display text-lg uppercase tracking-widest hover:bg-white transition-colors font-bold shadow-[0_0_20px_rgba(0,255,0,0.2)]"
            >
              <Check size={20} strokeWidth={3} /> ¡Listo, Pila Organizada!
            </button>

            <button
              onClick={() => setIsSessionFinished(false)}
              className="w-full flex items-center justify-center gap-2 bg-[#222] text-[#AAA] py-3 rounded-xl font-display text-xs uppercase tracking-widest hover:bg-[#333] hover:text-white transition-colors"
            >
              <RefreshCw size={14} /> Volver a Escanear / Agregar Más
            </button>

            <button
              onClick={() => {
                if (confirm('¿Estás seguro de que deseas descartar todas las figuritas escaneadas de esta pila?')) {
                  setSessionStickers([]);
                  recentlyScannedRef.current = {};
                  setRecentlyScanned({});
                  setIsSessionFinished(false);
                }
              }}
              className="w-full text-center text-xs text-red-500 hover:text-red-400 uppercase tracking-widest font-bold py-2 mt-2"
            >
              Descartar lote
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleBatchManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchManualInput.trim()) return;

    // Support commas, semi-colons, spaces or newlines as delimiters
    const parts = batchManualInput.split(/[,\n;]+/).map(p => p.trim()).filter(Boolean);
    const addedList: string[] = [];
    const repeatedList: string[] = [];
    let invalidCount = 0;

    for (const part of parts) {
      const { foundPrefix, num } = parseCodeString(part, false);
      if (foundPrefix) {
        const validTeam = WORLD_CUP_TEAMS.find(t => t.prefix === foundPrefix);
        const start = validTeam?.startNumber ?? 1;
        if (validTeam && num >= start && num <= validTeam.count) {
          const resultId = num === 0 && foundPrefix === 'FWC' ? '00' : `${foundPrefix}-${num}`;
          const display = num === 0 && foundPrefix === 'FWC' ? '00' : `${foundPrefix} ${num}`;
          
          const isOwned = ownedStickers.has(resultId);
          if (!isOwned) {
            // Unowned -> Add to album & also add to sorting session stickers pile below
            toggleOwned(resultId, true, `Agregué la figurita ${resultId} al álbum desde ingreso manual de lote.`);
            handleScannedInSession(resultId, display, true);
            addedList.push(display);
          } else {
            // Already owned -> goes straight to repetidas and is NOT added to session stickers (pila de abajo)
            if (updateRepeated) {
              const currentRep = repeatedStickers ? (repeatedStickers[resultId] || 0) : 0;
              updateRepeated(resultId, 1, `Agregué una repetida de la figurita ${resultId} desde ingreso manual de lote (Total: ${currentRep + 1}).`);
            }
            repeatedList.push(display);
          }
        } else {
          invalidCount++;
        }
      } else {
        invalidCount++;
      }
    }

    if (addedList.length > 0 || repeatedList.length > 0 || invalidCount > 0) {
      let msg = '';
      if (addedList.length > 0) {
        msg += `Agregadas al Álbum y Pila: ${addedList.join(', ')}. `;
      }
      if (repeatedList.length > 0) {
        msg += `Agregadas a Repetidas (no van a la pila): ${repeatedList.join(', ')}. `;
      }
      if (invalidCount > 0) {
        msg += `Ignorados por error: ${invalidCount} códigos.`;
      }
      setBatchManualSuccess(msg);
      setBatchManualError(null);
      setTimeout(() => setBatchManualSuccess(null), 6000);
    } else {
      setBatchManualError("No se encontraron códigos válidos. Ej: 'ARG 10, FWC 2'");
      setBatchManualSuccess(null);
    }
    setBatchManualInput('');
  };

  const renderSessionListWidget = () => {
    if (scanMode !== 'multiple' || isSessionFinished) return null;
    
    const totalCount = sessionStickers.reduce((sum, s) => sum + s.count, 0);
    
    return (
      <div className="mt-4 p-4 border border-[#2d2d2d] bg-[#1a1a1a] rounded-xl text-left">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-[10px] font-display text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00FF00] animate-pulse"></span>
            Pila de escaneo ({totalCount} {totalCount === 1 ? 'figurita' : 'figuritas'})
          </h4>
          {sessionStickers.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSessionStickers([]);
                recentlyScannedRef.current = {};
                setRecentlyScanned({});
              }}
              className="text-[10px] text-red-500 hover:text-red-400 uppercase tracking-wider font-bold transition-colors"
            >
              Limpiar todo
            </button>
          )}
        </div>

        {/* --- DEDICATED MANUAL INPUT FOR BATCH PROCESSING --- */}
        <form onSubmit={handleBatchManualSubmit} className="mb-4 bg-black/40 border border-[#222] p-3 rounded-lg">
          <label className="block text-[10px] uppercase tracking-widest text-[#00FF00] font-bold mb-1.5 font-display">
             Añadir figuritas a mano al lote (Lote Manual)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={batchManualInput}
              onChange={(e) => setBatchManualInput(e.target.value)}
              placeholder="Ej: ARG 10, FWC 2, BRA 12..."
              className="flex-1 bg-black border border-[#333] text-gray-200 text-xs px-3 py-2 rounded focus:border-[#00FF00] focus:outline-none transition-colors placeholder:text-gray-600 font-sans"
            />
            <button
              type="submit"
              className="bg-[#00FF00] text-black text-[10px] font-display uppercase tracking-widest font-bold px-4 py-2 hover:bg-white transition-colors rounded"
            >
              Agregar
            </button>
          </div>
          <p className="text-[9px] text-gray-500 mt-1 leading-normal font-sans">
            Escribe una o varias separadas por comas. Las que te falten van al álbum y pila; las repetidas van directo a Repetidas sin tocar la pila de abajo.
          </p>
          {batchManualSuccess && (
            <div className="mt-2 text-[10px] text-[#00FF00] font-sans bg-[#00FF00]/10 border border-[#00FF00]/20 p-2 rounded leading-tight">
              {batchManualSuccess}
            </div>
          )}
          {batchManualError && (
            <div className="mt-2 text-[10px] text-red-400 font-sans bg-red-500/10 border border-red-500/20 p-2 rounded leading-tight">
              {batchManualError}
            </div>
          )}
        </form>

        {sessionStickers.length === 0 ? (
          <p className="text-center text-gray-600 font-sans text-xs py-5">
            {manualMode 
              ? 'Escribe códigos arriba o en la pestaña manual y pulsa Enter para agregarlos.' 
              : 'Apunta a las figuritas una a una o agrégalas manualmente arriba.'}
          </p>
        ) : (
          <>
            <div className="max-h-52 overflow-y-auto space-y-2 mb-4 pr-1">
              {sortedStickers.map((item) => {
                const hasSticker = ownedStickers.has(item.id);
                return (
                  <div key={item.id} className="flex items-center justify-between p-2.5 bg-black/60 rounded-lg border border-[#2d2d2d] transition-all hover:bg-black">
                    <div className="flex items-center gap-2.5">
                      <span className="font-display text-white text-base font-bold min-w-[70px]">{item.display}</span>
                      <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${hasSticker ? 'bg-[#00FF00]/10 text-[#00FF00] border border-[#00FF00]/20' : 'bg-[#FF00FF]/10 text-[#FF00FF] border border-[#FF00FF]/20'}`}>
                        {hasSticker ? 'Repetida' : 'Nueva'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSessionStickers(prev => prev.map(s => s.id === item.id ? { ...s, count: Math.max(1, s.count - 1) } : s));
                        }}
                        className="p-1 px-1.5 bg-[#222] border border-[#333] hover:border-gray-500 rounded text-gray-400 hover:text-white transition-colors"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="text-xs font-mono text-white px-1.5 font-bold">{item.count}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSessionStickers(prev => prev.map(s => s.id === item.id ? { ...s, count: s.count + 1 } : s));
                        }}
                        className="p-1 px-1.5 bg-[#222] border border-[#333] hover:border-gray-500 rounded text-gray-400 hover:text-white transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSessionStickers(prev => prev.filter(s => s.id !== item.id));
                          delete recentlyScannedRef.current[item.id];
                          setRecentlyScanned({ ...recentlyScannedRef.current });
                        }}
                        className="p-1.5 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors ml-1"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <button
              type="button"
              onClick={() => setIsSessionFinished(true)}
              className="w-full flex items-center justify-center gap-2 bg-[#00FF00] text-black py-3 rounded-xl font-display text-sm uppercase tracking-widest hover:bg-white transition-colors font-bold shadow-[0_0_15px_rgba(0,255,0,0.15)]"
            >
              <ListOrdered size={16} strokeWidth={2.5} /> Finalizar y ordenar ({totalCount})
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-lg mx-auto p-4 pb-24">
      <div className="bg-zinc-900/60 backdrop-blur-xl rounded-3xl border border-zinc-800/80 shadow-[0_24px_64px_rgba(0,0,0,0.65)] overflow-hidden">
        
        <div className="flex border-b border-zinc-800 bg-zinc-950/20">
          <button 
            onClick={() => setManualMode(false)}
            className={`flex-1 py-4.5 font-display uppercase tracking-wider text-xs transition-all cursor-pointer ${!manualMode ? 'bg-zinc-900/40 text-[#00FF00] font-bold border-b-2 border-[#00FF00]' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Escáner OCR
          </button>
          <button 
            onClick={() => {
              setManualMode(true);
              setResult(null);
              setError(null);
            }}
            className={`flex-1 py-4.5 font-display uppercase tracking-wider text-xs transition-all cursor-pointer ${manualMode ? 'bg-zinc-900/40 text-[#00FF00] font-bold border-b-2 border-[#00FF00]' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Manual
          </button>
        </div>

        {/* Selector de modo de escaneo */}
        {!result && (
          <div className="flex bg-zinc-950 p-1 border-b border-zinc-800/80 gap-1">
            <button
              type="button"
              onClick={() => {
                setScanMode('single');
                setResult(null);
                setError(null);
              }}
              className={`flex-1 py-2.5 text-[9px] font-display uppercase tracking-widest transition-all cursor-pointer ${scanMode === 'single' ? 'bg-zinc-900 text-[#00FF00] font-bold rounded-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Por separado (Una a Una)
            </button>
            <button
              type="button"
              onClick={() => {
                setScanMode('multiple');
                setResult(null);
                setError(null);
              }}
              className={`flex-1 py-2.5 text-[9px] font-display uppercase tracking-widest transition-all cursor-pointer ${scanMode === 'multiple' ? 'bg-zinc-900 text-[#00FF00] font-bold rounded-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Varias juntas (Lote)
            </button>
          </div>
        )}

        {!manualMode ? (
          <>
            <div className="relative bg-black aspect-[3/4] sm:aspect-square flex flex-col items-center justify-center overflow-hidden">
              
              {hasPermission === false && (
                <div className="text-white text-center p-6 bg-zinc-950 absolute inset-0 flex flex-col items-center justify-center z-20">
                  <AlertCircle size={44} className="text-red-500 mb-4" />
                  <p className="font-sans text-sm">{error}</p>
                  <button 
                    onClick={startCamera}
                    className="mt-6 px-6 py-3 bg-[#00FF00] text-black font-display tracking-widest uppercase text-xs font-bold rounded-xl hover:bg-white transition-all cursor-pointer active:scale-95"
                  >
                    Reintentar
                  </button>
                </div>
              )}

              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className={`w-full h-full object-cover transition-opacity duration-300 ${result ? 'opacity-30 grayscale' : 'opacity-100'}`}
              />
              <canvas ref={canvasRef} className="hidden" />

              {!result && (
                <div className="absolute inset-0 pointer-events-none p-8 flex flex-col items-center justify-center">
                   <div className={`w-64 h-20 sm:w-80 sm:h-24 border-2 ${isScanning ? 'border-[#00FF00]' : 'border-white/50'} relative shadow-[0_0_0_4000px_rgba(0,0,0,0.8)] transition-colors duration-500`}>
                       <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-white"></div>
                       <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-white"></div>
                       <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-white"></div>
                       <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-white"></div>
                       
                       <div className="absolute inset-2 border border-[#00FFFF]/20 bg-[#00FFFF]/5 flex items-center justify-center pointer-events-none">
                          <span className="text-[10px] text-[#00FFFF]/40 font-display uppercase tracking-widest text-center leading-tight px-4 font-bold">
                             Enfoca el código de equipo y número
                          </span>
                       </div>

                       {isScanning && (
                           <div className="absolute inset-0 border border-[#00FF00] animate-ping opacity-25"></div>
                       )}
                   </div>
                </div>
              )}

              {/* Flash green overlay on successful detection in multiple mode */}
              {flashSuccess && (
                <div className="absolute inset-0 bg-[#00FF00]/15 pointer-events-none transition-opacity duration-150 z-30 animate-pulse" />
              )}

              {/* Floating notification for scanned sticker */}
              {lastScannedText && (
                <div className="absolute top-4 left-4 right-4 bg-[#00FF00] text-black text-center font-display uppercase tracking-widest text-xs py-2.5 font-bold px-4 z-40 rounded-xl shadow-[0_4px_25px_rgba(0,255,0,0.35)] animate-in fade-in slide-in-from-top-2 duration-200">
                  {lastScannedText}
                </div>
              )}

              {isScanning && !result && (
                <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-3 text-[#00FF00] bg-zinc-950/90 backdrop-blur-md px-6 py-2.5 w-max mx-auto border border-[#00FF00]/30 animate-pulse rounded-full z-30 shadow-lg">
                   <Loader2 size={14} className="animate-spin" />
                   <span className="text-[9px] font-display tracking-widest uppercase font-bold">Buscando...</span>
                </div>
              )}
            </div>

            <div className="p-6 min-h-[16rem] flex flex-col justify-center bg-zinc-900/30">
              {!result && (
                <div className="flex flex-col gap-4">
                  {zoomCaps && (
                    <div className="mb-4">
                      <div className="flex justify-between items-center text-[10px] font-display text-zinc-400 mb-2 uppercase tracking-widest">
                        <span>Zoom</span>
                        <span>{zoom.toFixed(1)}x</span>
                      </div>
                      <input 
                        type="range" 
                        min={zoomCaps.min} 
                        max={zoomCaps.max} 
                        step={zoomCaps.step} 
                        value={zoom} 
                        onChange={handleZoomChange}
                        className="w-full accent-[#00FF00] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  )}

                  {error && (
                    <div className="text-center bg-red-500/10 border border-red-500/20 text-red-400 p-4 text-xs font-sans tracking-wide rounded-xl">
                      {error}
                    </div>
                  )}
                  
                  {scanMode === 'single' ? (
                    <div className="text-center">
                      <p className="text-white font-display text-base uppercase tracking-wider">
                         Buscando código...
                      </p>
                      <p className="text-zinc-500 text-xs font-sans mt-2">
                        Apunta la figurita para escanear automáticamente. Asegúrate de tener buena luz.
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-[#00FF00] font-display text-base uppercase tracking-wider">
                         Modo Lote Activo
                      </p>
                      <p className="text-zinc-400 text-xs font-sans mt-1">
                        Sostén las figuritas una por una frente al recuadro. El escáner pitará y las irá guardando en la pila de abajo.
                      </p>
                    </div>
                  )}

                  {renderSessionListWidget()}
                </div>
              )}

              {result && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
                  <div className="text-center mb-6">
                     <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Código Detectado</span>
                     <h3 className="text-5xl font-display text-white my-2 tracking-wide">{result.display}</h3>
                     
                     {isAlreadyOwned ? (
                        <div className="inline-flex items-center gap-1.5 text-black font-display uppercase tracking-widest bg-[#00FF00] text-[10px] py-1 px-3.5 rounded font-bold">
                           <Check size={14} strokeWidth={3} /> ¡Ya la tienes!
                        </div>
                     ) : (
                        <div className="inline-flex items-center gap-1.5 text-black font-display uppercase tracking-widest bg-[#FF00FF] text-[10px] py-1 px-3.5 rounded font-bold">
                           <AlertCircle size={14} strokeWidth={3} /> Te falta
                        </div>
                     )}
                  </div>

                  <div className="flex flex-col gap-3">
                     {!isAlreadyOwned && (
                        <button
                           onClick={handleMarkAsOwned}
                           className="w-full flex items-center justify-center gap-2 bg-[#00FF00] text-black py-4 rounded-xl font-display text-lg uppercase tracking-wider hover:bg-white transition-all cursor-pointer font-bold active:scale-95 shadow-[0_4px_15px_rgba(0,255,0,0.15)]"
                        >
                           <Check size={22} strokeWidth={3} /> Agregar al álbum
                        </button>
                     )}
                     
                     {isAlreadyOwned && updateRepeated && currentRepeatedCount === 0 && !addedToAlbum && !addedToRepeated && (
                        <button
                           onClick={handleMarkAsRepeated}
                           className="w-full flex items-center justify-center gap-2 bg-[#00FFFF] text-black py-4 rounded-xl font-display text-base uppercase tracking-wider hover:bg-white transition-all shadow-[0_4px_15px_rgba(0,255,255,0.15)] cursor-pointer font-bold active:scale-95"
                        >
                           <CopyPlus size={18} strokeWidth={2.5} /> Agregar a Repetidas
                        </button>
                     )}

                     {isAlreadyOwned && addedToRepeated && (
                          <div className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-display text-base tracking-wider uppercase bg-zinc-800 text-zinc-400 border border-zinc-700">
                              <Check size={18} /> Agregada a repetidas
                          </div>
                     )}

                     {isAlreadyOwned && updateRepeated && currentRepeatedCount > 0 && !addedToAlbum && !addedToRepeated && (
                        <div className="flex gap-2 w-full">
                           <button
                              onClick={handleRemoveFromRepeated}
                              className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 py-4 rounded-xl font-display text-base uppercase tracking-wider hover:bg-red-500 hover:text-white transition-all cursor-pointer active:scale-95"
                           >
                              <RefreshCw size={18} strokeWidth={2.5} /> Sacar (-1)
                           </button>
                           <button
                              onClick={handleMarkAsRepeated}
                              className="flex-1 flex items-center justify-center gap-2 bg-[#00FFFF] text-black py-4 rounded-xl font-display text-base uppercase tracking-wider hover:bg-white transition-all cursor-pointer active:scale-95 font-bold"
                           >
                              <CopyPlus size={18} strokeWidth={2.5} /> Otra (+{currentRepeatedCount + 1})
                           </button>
                        </div>
                     )}

                     <button
                        onClick={() => {
                           setResult(null);
                           setError(null);
                           isScanningRef.current = false;
                           setAddedToRepeated(false);
                           setRemovedFromRepeated(false);
                           setAddedToAlbum(false);
                        }}
                        className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-display text-base uppercase tracking-wider transition-all bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white cursor-pointer active:scale-95`}
                     >
                        <RefreshCw size={16} /> Escanear otra
                     </button>
                  </div>
                </div>
              )}
              {result && scanMode === 'multiple' && (
                <div className="mt-4">
                  {renderSessionListWidget()}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="p-8 bg-zinc-950/40 min-h-[400px] flex flex-col justify-center">
            
            {!result ? (
              <>
                <form onSubmit={handleManualSubmit} className="space-y-6 animate-in fade-in zoom-in-95">
                  <div className="text-center mb-6">
                    <TypeIcon size={44} className="mx-auto text-zinc-600 mb-2" />
                    <h3 className="text-xl font-display uppercase tracking-wider">Ingreso Manual</h3>
                    <p className="text-zinc-500 font-sans text-xs mt-1">Escribe el código de la figurita</p>
                  </div>

                  <div>
                    <input
                      type="text"
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      placeholder="Ej. ARG 10"
                      className="w-full bg-zinc-950/80 border border-zinc-800 text-center text-3xl font-display uppercase tracking-widest text-white py-4 rounded-2xl focus:border-[#00FF00] focus:outline-none focus:ring-1 focus:ring-[#00FF00]/40 transition-all placeholder:text-zinc-800"
                      autoFocus
                    />
                  </div>

                  {error && (
                    <div className="text-center text-red-400 text-xs font-sans bg-red-500/10 p-3 border border-red-500/20 rounded-xl animate-shake">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!manualInput.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-[#00FF00] disabled:bg-zinc-800 disabled:text-zinc-600 text-black py-4 rounded-xl font-display text-lg uppercase tracking-wider hover:bg-white transition-all cursor-pointer font-bold active:scale-95 disabled:hover:bg-zinc-800 disabled:cursor-not-allowed"
                  >
                    {scanMode === 'single' ? 'Buscar' : 'Agregar a Pila'}
                  </button>
                </form>
                {renderSessionListWidget()}
              </>
            ) : (
              <div className="animate-in fade-in zoom-in-95 flex flex-col h-full justify-center">
                  <div className="text-center mb-8">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest shrink-0 block mb-2">Resultado</span>
                    <h3 className="text-5xl font-display text-white my-2 tracking-wide">{result.display}</h3>
                    
                    {isAlreadyOwned ? (
                      <div className="inline-flex flex-col items-center gap-2 mt-4">
                        <div className="inline-flex items-center gap-1.5 text-black font-display uppercase tracking-widest bg-[#00FF00] text-[10px] py-1 px-3.5 rounded font-bold">
                          <Check size={14} strokeWidth={3} /> ¡Ya la tienes!
                        </div>
                      </div>
                    ) : (
                      <div className="inline-flex flex-col items-center gap-2 mt-4">
                        <div className="inline-flex items-center gap-1.5 text-black font-display uppercase tracking-widest bg-[#FF00FF] text-[10px] py-1 px-3.5 rounded font-bold">
                          <AlertCircle size={14} strokeWidth={3} /> Te falta
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 mt-auto">
                    {!isAlreadyOwned && (
                      <button
                        onClick={handleMarkAsOwned}
                        className="w-full flex items-center justify-center gap-2 bg-[#00FF00] text-black py-4 rounded-xl font-display text-lg uppercase tracking-wider hover:bg-white transition-all cursor-pointer active:scale-95 font-bold"
                      >
                        <Check size={22} strokeWidth={3} /> La tengo
                      </button>
                    )}
                    
                    {isAlreadyOwned && updateRepeated && currentRepeatedCount === 0 && !addedToAlbum && !addedToRepeated && (
                        <button
                           onClick={handleMarkAsRepeated}
                           className="w-full flex items-center justify-center gap-2 bg-[#00FFFF] text-black py-4 rounded-xl font-display text-base uppercase tracking-wider hover:bg-white transition-all cursor-pointer active:scale-95 shadow-[0_4px_15px_rgba(0,255,255,0.15)] font-bold"
                        >
                           <CopyPlus size={18} strokeWidth={2.5} /> Agregar a Repetidas
                        </button>
                     )}

                     {isAlreadyOwned && addedToRepeated && (
                          <div className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-display text-base tracking-wider uppercase bg-zinc-800 text-zinc-400 border border-zinc-700">
                              <Check size={18} /> Agregada a repetidas
                          </div>
                     )}

                     {isAlreadyOwned && updateRepeated && currentRepeatedCount > 0 && !addedToAlbum && !addedToRepeated && (
                        <div className="flex gap-2 w-full">
                           <button
                              onClick={handleRemoveFromRepeated}
                              className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/20 text-red-500 py-4 rounded-xl font-display text-base uppercase tracking-wider hover:bg-red-500 hover:text-white transition-all cursor-pointer active:scale-95"
                           >
                              <RefreshCw size={18} strokeWidth={2.5} /> Sacar (-1)
                           </button>
                           <button
                              onClick={handleMarkAsRepeated}
                              className="flex-1 flex items-center justify-center gap-2 bg-[#00FFFF] text-black py-4 rounded-xl font-display text-base uppercase tracking-wider hover:bg-white transition-all cursor-pointer active:scale-95 font-bold"
                           >
                              <CopyPlus size={18} strokeWidth={2.5} /> Otra (+{currentRepeatedCount + 1})
                           </button>
                        </div>
                     )}

                    <button
                      onClick={() => {
                        setResult(null);
                        setError(null);
                        setAddedToRepeated(false);
                        setRemovedFromRepeated(false);
                        setAddedToAlbum(false);
                      }}
                      className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-display text-base uppercase tracking-wider transition-all bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white cursor-pointer active:scale-95`}
                    >
                      Ingresar otra
                    </button>
                  </div>
              </div>
            )}
            
            {result && scanMode === 'multiple' && (
              <div className="mt-4">
                {renderSessionListWidget()}
              </div>
            )}
            
          </div>
        )}
      </div>
    </div>
  );
}

