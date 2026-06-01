import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Check, AlertCircle, Loader2, Type as TypeIcon, CopyPlus, Trash2, Plus, Minus, ListOrdered, Trophy } from 'lucide-react';
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

  const [isScanning, setIsScanning] = useState(false);
  const isScanningRef = useRef(false);

  const [zoom, setZoom] = useState(1);
  const [zoomCaps, setZoomCaps] = useState<{min: number, max: number, step: number} | null>(null);

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
       return;
    }
    
    playBeep();
    setFlashSuccess(true);
    setTimeout(() => setFlashSuccess(false), 250);
    
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
    const upperInput = input.toUpperCase().replace(/[^A-Z0-9\s\-_]/g, '');
    const noSpaces = upperInput.replace(/\s+/g, '');
    
    if (/(^|[^A-Z0-9])(00|OO|O0|0O)([^A-Z0-9]|$)/.test(noSpaces)) {
        return { foundPrefix: "00", num: 0 };
    }

    if (noSpaces.length < 3) return { foundPrefix: "", num: 0 };

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
            const charBefore = idx > 0 ? textAsLetters.charAt(idx - 1) : '';
            if (/[A-Z]/.test(charBefore)) {
                continue;
            }

            const after = noSpaces.substring(idx + p.length);
            const numMatch = /^[-_\.]?([A-Z0-9]{1,2})/.exec(after);
            
            if (numMatch) {
               const cleanNum = lettersToNums(numMatch[1]).replace(/[^0-9]/g, '');
               if (cleanNum.length > 0) {
                    const num = parseInt(cleanNum, 10);
                    const start = team.startNumber ?? 1;
                    if (num >= start && num <= team.count) {
                        if (strict) {
                            const before = textAsLetters.substring(0, idx);
                            const afterNum = after.substring(numMatch[0].length);
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

        setResult({ id: resultId, display: '00' });
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

        setResult({ id: resultId, display: display });
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
      track.applyConstraints({ advanced: [{ zoom: newZoom }] }).catch(err => console.error("Zoom no soportado:", err));
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
        
        if (text.length >= 2 && conf > 40) {
           const { foundPrefix, num } = parseCodeString(text, false);

           if (foundPrefix === '00' && num === 0) {
               const resultId = '00';
               const isOwned = ownedStickers.has(resultId);
               if (addActivity) addActivity(`Escaneé la figurita ${resultId} y el resultado fue: ${isOwned ? '¡Ya la tenía!' : '¡Me faltaba!'}`);
               
               setResult({ id: resultId, display: '00' });
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

                   setResult({ id: resultId, display: display });
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
  const currentRepeatedCount = rawRepeatedCount;

  const handleBatchManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchManualInput.trim()) return;

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
            toggleOwned(resultId, true, `Agregué la figurita ${resultId} al álbum desde ingreso manual de lote.`);
            handleScannedInSession(resultId, display, true);
            addedList.push(display);
          } else {
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
      if (addedList.length > 0) msg += `Agregadas al Álbum y Pila: ${addedList.join(', ')}. `;
      if (repeatedList.length > 0) msg += `Agregadas a Repetidas (no van a la pila): ${repeatedList.join(', ')}. `;
      if (invalidCount > 0) msg += `Ignorados: ${invalidCount} códigos.`;
      
      setBatchManualSuccess(msg);
      setBatchManualError(null);
      setTimeout(() => setBatchManualSuccess(null), 6000);
    } else {
      setBatchManualError("No se encontraron códigos válidos. Ej: 'ARG 10, CC 2'");
      setBatchManualSuccess(null);
    }
    setBatchManualInput('');
  };

  const renderSessionListWidget = () => {
    if (scanMode !== 'multiple' || isSessionFinished) return null;
    const totalCount = sessionStickers.reduce((sum, s) => sum + s.count, 0);
    
    return (
      <div className="mt-4 p-4 border border-neutral-900 bg-neutral-950/40 rounded-2xl text-left shadow-[0_0_10px_rgba(0,0,0,0.5)]">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-[10px] font-display font-medium text-neutral-400 uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse shadow-[0_0_6px_#00f3ff]"></span>
            Pila de Escaneo ({totalCount} {totalCount === 1 ? 'cromo' : 'cromos'})
          </h4>
          {sessionStickers.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSessionStickers([]);
                recentlyScannedRef.current = {};
                setRecentlyScanned({});
              }}
              className="text-[9px] text-neon-pink hover:text-rose-400 uppercase tracking-widest font-extrabold transition-colors cursor-pointer text-neon-pink-glow"
            >
              Borrar pila
            </button>
          )}
        </div>

        {/* Dynamic batch input form */}
        <form onSubmit={handleBatchManualSubmit} className="mb-4 bg-neutral-950 border border-neutral-900 p-3 rounded-xl shadow-[0_0_8px_rgba(0,0,0,0.4)]">
          <label className="block text-[8px] uppercase tracking-widest text-neutral-550 font-extrabold mb-1.5 font-mono text-neutral-500">
             Añadir figuritas a mano al lote (Lote Manual)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={batchManualInput}
              onChange={(e) => setBatchManualInput(e.target.value)}
              placeholder="Ej: ARG 10, FWC 2, CC 4..."
              className="flex-1 bg-neutral-950 border border-neutral-850 text-neutral-100 text-[16px] md:text-xs px-3 py-2 rounded-xl focus:border-neon-cyan focus:bg-neutral-900/10 focus:outline-none transition-colors placeholder:text-neutral-700 font-sans"
            />
            <button
              type="submit"
              className="bg-neutral-900 border border-neutral-800 text-neon-cyan text-neon-cyan-glow text-[10px] font-display font-black uppercase tracking-wider px-4 py-2 hover:bg-neutral-800 transition-all rounded-xl cursor-pointer"
            >
              Agregar
            </button>
          </div>
          <p className="text-[8.5px] text-neutral-500 mt-1 leading-normal font-sans">
            Comas o espacios son aceptados. Las nuevas van a tu álbum y pila; las repetidas van directo al inventario.
          </p>
          {batchManualSuccess && (
            <div className="mt-2 text-[9px] text-neon-green font-sans bg-neon-green/5 border border-neon-green/30 p-2.5 rounded-xl leading-tight font-medium">
              {batchManualSuccess}
            </div>
          )}
          {batchManualError && (
            <div className="mt-2 text-[9px] text-neon-pink font-sans bg-neon-pink/5 border border-neon-pink/30 p-2.5 rounded-xl leading-tight font-medium">
              {batchManualError}
            </div>
          )}
        </form>

        {sessionStickers.length === 0 ? (
          <p className="text-center text-neutral-500 font-sans text-xs py-5">
            {manualMode 
              ? 'Escribe códigos arriba y presiona Enter o "Agregar" para apilarlos.' 
              : 'Apunta a los cromos de forma consecutiva.'}
          </p>
        ) : (
          <>
            <div className="max-h-52 overflow-y-auto space-y-2 mb-4 pr-1">
              {sortedStickers.map((item) => {
                const hasSticker = ownedStickers.has(item.id);
                return (
                  <div key={item.id} className="flex items-center justify-between p-2.5 bg-neutral-950/80 rounded-xl border border-neutral-900 transition-all hover:bg-neutral-900/40">
                    <div className="flex items-center gap-2.5">
                      <span className="font-display font-black text-white text-base min-w-[70px]">{item.display}</span>
                      <span className={`text-[8px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${hasSticker ? 'bg-neon-purple/5 text-neon-purple border border-neon-purple/35 text-neon-purple-glow' : 'bg-neon-pink/5 text-neon-pink border border-neon-pink/35 text-neon-pink-glow'}`}>
                        {hasSticker ? 'Repetida' : 'Nueva'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSessionStickers(prev => prev.map(s => s.id === item.id ? { ...s, count: Math.max(1, s.count - 1) } : s));
                        }}
                        className="p-1 px-1.5 bg-neutral-900 border border-neutral-850 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                      >
                        <Minus size={11} />
                      </button>
                      <span className="text-xs font-mono font-bold text-neutral-200 px-1">{item.count}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSessionStickers(prev => prev.map(s => s.id === item.id ? { ...s, count: s.count + 1 } : s));
                        }}
                        className="p-1 px-1.5 bg-neutral-900 border border-neutral-850 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                      >
                        <Plus size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSessionStickers(prev => prev.filter(s => s.id !== item.id));
                          delete recentlyScannedRef.current[item.id];
                          setRecentlyScanned({ ...recentlyScannedRef.current });
                        }}
                        className="p-1.5 text-neutral-500 hover:text-neon-pink rounded-lg transition-colors ml-1 cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <button
              type="button"
              onClick={() => setIsSessionFinished(true)}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-neon-cyan to-blue-600 text-black py-3 rounded-xl font-display font-black text-sm uppercase tracking-wider hover:opacity-90 transition-all shadow-[0_0_12px_rgba(0,243,255,0.35)]"
            >
              <ListOrdered size={15} strokeWidth={3} /> Finalizar y ordenar ({totalCount})
            </button>
          </>
        )}
      </div>
    );
  };

  if (isSessionFinished) {
    return (
      <div className="w-full max-w-lg mx-auto p-4 pb-24 select-none">
        <div className="bg-neutral-950/75 rounded-3xl shadow-[0_0_25px_rgba(0,243,255,0.05)] border border-neutral-900 overflow-hidden p-6 animate-in fade-in duration-300">
          <div className="text-center mb-6">
            <span className="text-[10px] font-bold text-neon-cyan uppercase tracking-widest bg-neon-cyan/5 px-3.5 py-1 rounded-full border border-neon-cyan/25 font-mono text-neon-cyan-glow">
              Pila Organizada
            </span>
            <h2 className="text-2xl font-display font-black text-white mt-4 mb-2 uppercase tracking-wide">Orden para pegar</h2>
            <p className="text-neutral-400 text-xs font-sans px-2 leading-relaxed">
              Organiza tu pila física de figuritas de modo que las que aparecen primero en el listado queden arriba de todo y las últimas al fondo. ¡Así podrás pegarlas en orden cronológico ultra rápido!
            </p>
          </div>

          <div className="space-y-2.5 my-6 max-h-[350px] overflow-y-auto pr-1">
            {sortedStickers.map((item, idx) => {
              const teamName = WORLD_CUP_TEAMS.find(t => t.prefix === item.id.split('-')[0])?.name || 'Especial';
              return (
                <div key={item.id} className="flex items-center gap-3 p-3 bg-neutral-950/90 border border-neutral-900 rounded-2xl animate-in fade-in">
                  <div className="w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center font-display text-xs text-neon-cyan font-black shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-black text-white text-base tracking-wide">{item.display}</span>
                      {item.count > 1 && (
                        <span className="bg-neutral-900 text-neutral-300 text-xs font-mono font-bold px-1.5 py-0.5 rounded border border-neutral-800">
                          x{item.count}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-neutral-500 uppercase font-mono tracking-widest mt-0.5 block">{teamName}</span>
                  </div>
                  
                  <div className="text-right">
                    <span className="text-[9px] uppercase font-black tracking-widest px-2.5 py-0.5 rounded inline-block bg-neon-green/5 text-neon-green border border-neon-green/35 text-neon-green-glow">
                      A Pegar
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
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-neon-green to-emerald-500 text-black py-4 rounded-xl font-display font-black text-lg uppercase tracking-wider hover:opacity-90 transition-all shadow-[0_0_12px_rgba(57,255,20,0.35)] cursor-pointer"
            >
              <Check size={20} strokeWidth={3} /> ¡Listo, Pila Organizada!
            </button>

            <button
              onClick={() => setIsSessionFinished(false)}
              className="w-full flex items-center justify-center gap-2 bg-neutral-900 border border-neutral-800 text-neutral-300 py-3 rounded-xl font-display text-xs uppercase tracking-widest hover:bg-neutral-850 hover:text-white transition-all cursor-pointer font-bold animate-pulse"
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
              className="w-full text-center text-xs text-neutral-500 hover:text-neon-pink uppercase tracking-widest font-extrabold py-2 mt-2 cursor-pointer transition-colors"
            >
              Descartar lote
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto p-4 pb-24">
      <div className="bg-neutral-950/70 rounded-3xl border border-neutral-900 shadow-[0_0_15px_rgba(0,243,255,0.05)] overflow-hidden">
        
        <div className="flex border-b border-neutral-900 bg-neutral-900/30">
          <button 
            onClick={() => setManualMode(false)}
            className={`flex-1 py-4.5 font-display uppercase tracking-wider text-xs transition-all cursor-pointer ${!manualMode ? 'bg-neutral-950/90 text-neon-cyan font-black border-b-2 border-neon-cyan text-neon-cyan-glow' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            Escáner OCR
          </button>
          <button 
            onClick={() => {
              setManualMode(true);
              setResult(null);
              setError(null);
            }}
            className={`flex-1 py-4.5 font-display uppercase tracking-wider text-xs transition-all cursor-pointer ${manualMode ? 'bg-neutral-950/90 text-neon-cyan font-black border-b-2 border-neon-cyan text-neon-cyan-glow' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            Manual
          </button>
        </div>

        {/* Scan mode selector */}
        {!result && (
          <div className="flex bg-neutral-950 p-1 border-b border-neutral-900 gap-1">
            <button
              type="button"
              onClick={() => {
                setScanMode('single');
                setResult(null);
                setError(null);
              }}
              className={`flex-1 py-2 text-[9px] font-display uppercase tracking-widest transition-all cursor-pointer ${scanMode === 'single' ? 'bg-neutral-900 text-neon-cyan font-black rounded-lg border border-neutral-800 shadow-[0_0_8px_rgba(0,243,255,0.1)] text-neon-cyan-glow' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              Una a Una
            </button>
            <button
              type="button"
              onClick={() => {
                setScanMode('multiple');
                setResult(null);
                setError(null);
              }}
              className={`flex-1 py-2 text-[9px] font-display uppercase tracking-widest transition-all cursor-pointer ${scanMode === 'multiple' ? 'bg-neutral-900 text-neon-cyan font-black rounded-lg border border-neutral-800 shadow-[0_0_8px_rgba(0,243,255,0.1)] text-neon-cyan-glow' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              Lote / Pila
            </button>
          </div>
        )}

        {!manualMode ? (
          <>
            <div className="relative bg-slate-950 aspect-[3/4] sm:aspect-square flex flex-col items-center justify-center overflow-hidden">
              
              {hasPermission === false && (
                <div className="text-white text-center p-6 bg-slate-900 absolute inset-0 flex flex-col items-center justify-center z-20">
                  <AlertCircle size={44} className="text-rose-500 mb-4" />
                  <p className="font-sans text-sm">{error}</p>
                  <button 
                    onClick={startCamera}
                    className="mt-6 px-6 py-3 bg-white text-slate-900 font-display tracking-widest uppercase text-xs font-black rounded-xl hover:bg-slate-100 transition-all cursor-pointer active:scale-95 shadow-md"
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
                   <div className={`w-64 h-20 sm:w-80 sm:h-24 border-2 ${isScanning ? 'border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.4)]' : 'border-slate-500/50'} relative shadow-[0_0_0_4000px_rgba(15,23,42,0.85)] transition-all duration-500 rounded-lg`}>
                       <div className="absolute -top-[1.5px] -left-[1.5px] w-6 h-6 border-t-[3px] border-l-[3px] border-amber-450 rounded-tl"></div>
                       <div className="absolute -top-[1.5px] -right-[1.5px] w-6 h-6 border-t-[3px] border-r-[3px] border-amber-450 rounded-tr"></div>
                       <div className="absolute -bottom-[1.5px] -left-[1.5px] w-6 h-6 border-b-[3px] border-l-[3px] border-amber-450 rounded-bl"></div>
                       <div className="absolute -bottom-[1.5px] -right-[1.5px] w-6 h-6 border-b-[3px] border-r-[3px] border-amber-450 rounded-br"></div>
                       
                       <div className="absolute inset-1.5 border border-amber-500/10 bg-amber-400/5 flex items-center justify-center pointer-events-none rounded">
                          <span className="text-[9px] text-amber-300/60 font-mono uppercase tracking-[1.5px] text-center leading-tight px-4 font-bold select-none">
                             Enfoca el código del cromo
                          </span>
                       </div>

                       {isScanning && (
                            <div className="absolute inset-0 border border-amber-405 animate-ping opacity-15"></div>
                       )}
                   </div>
                </div>
              )}

              {flashSuccess && (
                <div className="absolute inset-0 bg-emerald-500/15 pointer-events-none transition-opacity duration-150 z-30 animate-pulse" />
              )}

              {lastScannedText && (
                <div className="absolute top-4 left-4 right-4 bg-neutral-950 border border-neutral-850 text-white text-center font-display uppercase tracking-widest text-xs py-2.5 font-bold px-4 z-40 rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-top-2 duration-205">
                  {lastScannedText}
                </div>
              )}

              {isScanning && !result && (
                <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-2.5 text-neutral-350 bg-neutral-950/95 backdrop-blur-xs px-5 py-2 w-max mx-auto border border-neutral-850 animate-pulse rounded-full z-30 shadow-[0_0_12px_rgba(0,243,255,0.15)] select-none">
                   <Loader2 size={13} className="animate-spin text-neon-cyan" />
                   <span className="text-[8.5px] font-mono tracking-[2px] uppercase font-bold text-neon-cyan text-neon-cyan-glow">Buscando...</span>
                </div>
              )}
            </div>

            <div className="p-6 min-h-[16rem] flex flex-col justify-center bg-neutral-950/70 border-t border-neutral-900">
              {!result && (
                <div className="flex flex-col gap-4">
                  {zoomCaps && (
                    <div className="mb-4">
                      <div className="flex justify-between items-center text-[9px] font-mono text-neutral-500 mb-2 uppercase tracking-widest font-bold">
                        <span>Zoom de Cámara</span>
                        <span className="text-neon-cyan font-extrabold text-neon-cyan-glow">{zoom.toFixed(1)}x</span>
                      </div>
                      <input 
                        type="range" 
                        min={zoomCaps.min} 
                        max={zoomCaps.max} 
                        step={zoomCaps.step} 
                        value={zoom} 
                        onChange={handleZoomChange}
                        className="w-full accent-neon-cyan h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  )}

                  {error && (
                    <div className="text-center bg-neon-pink/5 border border-neon-pink/30 text-neon-pink text-neon-pink-glow p-4 text-xs font-sans tracking-wide rounded-xl">
                      {error}
                    </div>
                  )}
                  
                  {scanMode === 'single' ? (
                    <div className="text-center">
                      <p className="text-white font-display font-black text-sm uppercase tracking-wider">
                         Buscando código...
                      </p>
                      <p className="text-neutral-450 text-xs font-sans mt-1.5">
                        Apunta tu cámara de forma estable para escanear automáticamente. Asegúrate de tener buena luz y que se distinga la letra y número del cromo.
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-white font-display font-black text-sm uppercase tracking-wider">
                         Modo Lote Activo
                      </p>
                      <p className="text-neutral-450 text-xs font-sans mt-1">
                        Sostén las figuritas una por una frente al sensor. El sistema mermará la espera y las apilará abajo de forma automática.
                      </p>
                    </div>
                  )}

                  {renderSessionListWidget()}
                </div>
              )}

              {result && (
                <div className="animate-in slide-in-from-bottom-2 duration-350 w-full bg-neutral-950 border border-neutral-900 p-6 rounded-2xl shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                  <div className="text-center mb-6">
                     <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest font-mono">Código Detectado</span>
                     <h3 className="text-5xl font-display font-black text-white my-2.5 tracking-wide text-neon-cyan-glow">{result.display}</h3>
                     
                     {isAlreadyOwned ? (
                        <div className="inline-flex items-center gap-1.5 text-neon-cyan font-display uppercase tracking-widest bg-neon-cyan/5 text-[10px] py-1 px-3.5 border border-neon-cyan/25 rounded-lg font-black text-neon-cyan-glow shadow-[0_0_8px_rgba(0,243,255,0.2)]">
                           <Check size={13} strokeWidth={4} /> ¡Ya la tienes!
                        </div>
                     ) : (
                        <div className="inline-flex items-center gap-1.5 text-neon-pink font-display uppercase tracking-widest bg-neon-pink/5 border border-neon-pink/25 text-[10px] py-1 px-3.5 rounded-lg font-black text-neon-pink-glow shadow-[0_0_8px_rgba(255,0,127,0.2)]">
                           <AlertCircle size={13} strokeWidth={4} /> Te falta
                        </div>
                     )}
                  </div>

                  <div className="flex flex-col gap-3">
                     {!isAlreadyOwned && (
                        <button
                           onClick={handleMarkAsOwned}
                           className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-neon-green to-emerald-500 text-black py-4 rounded-xl font-display font-black text-lg uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-[0_0_12px_rgba(57,255,20,0.35)]"
                        >
                           <Check size={20} strokeWidth={3.5} /> Agregar al álbum
                        </button>
                     )}
                     
                     {isAlreadyOwned && updateRepeated && currentRepeatedCount === 0 && !addedToAlbum && !addedToRepeated && (
                        <button
                           onClick={handleMarkAsRepeated}
                           className="w-full flex items-center justify-center gap-2 bg-neutral-900 border border-neutral-800 text-neon-purple text-neon-purple-glow py-4 rounded-xl font-display font-bold text-base uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                        >
                           <CopyPlus size={16} strokeWidth={2.5} /> Agregar a Repetidas
                        </button>
                     )}

                     {isAlreadyOwned && addedToRepeated && (
                          <div className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-display font-black text-xs tracking-widest uppercase bg-neon-pink/5 text-neon-pink border border-neon-pink/25 text-neon-pink-glow shadow-[0_0_8px_rgba(255,0,127,0.15)]">
                              <Check size={16} strokeWidth={3} /> Agregada a repetidas
                          </div>
                     )}

                     {isAlreadyOwned && updateRepeated && currentRepeatedCount > 0 && !addedToAlbum && !addedToRepeated && (
                        <div className="flex gap-2 w-full">
                           <button
                              onClick={handleRemoveFromRepeated}
                              className="flex-1 flex items-center justify-center gap-2 bg-neutral-900/40 border border-neutral-850 text-neon-pink text-neon-pink-glow py-4 rounded-xl font-display text-sm uppercase tracking-wider hover:bg-neutral-850 transition-all cursor-pointer active:scale-95 font-bold text-neon-pink-glow"
                           >
                              Sacar (-1)
                           </button>
                           <button
                              onClick={handleMarkAsRepeated}
                              className="flex-1 flex items-center justify-center gap-2 bg-neutral-900 border border-neutral-800 text-neon-cyan py-4 rounded-xl font-display text-sm uppercase tracking-wider transition-all cursor-pointer active:scale-95 font-black text-neon-cyan-glow"
                           >
                              Otra (+{currentRepeatedCount + 1})
                           </button>
                        </div>
                     )}

                     <button
                        onClick={() => {
                           if (scanMode === 'multiple') {
                             if (isAlreadyOwned && !addedToAlbum && !addedToRepeated) {
                                handleScannedInSession(result.id, result.display, true);
                             }
                           }
                           setResult(null);
                           setError(null);
                           setAddedToRepeated(false);
                           setRemovedFromRepeated(false);
                           setAddedToAlbum(false);
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-display text-xs uppercase tracking-widest transition-all bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-850 cursor-pointer active:scale-95 font-bold"
                     >
                        <RefreshCw size={14} /> Escanear otra
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
          <div className="p-8 bg-neutral-950/70 border-t border-neutral-900 min-h-[400px] flex flex-col justify-center">
            
            {!result ? (
              <>
                <form onSubmit={handleManualSubmit} className="space-y-6 animate-in fade-in">
                  <div className="text-center mb-6">
                    <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 text-neon-cyan flex items-center justify-center mx-auto mb-2.5 shadow-[0_0_8px_rgba(0,243,255,0.15)] text-neon-cyan-glow">
                      <TypeIcon size={24} />
                    </div>
                    <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest font-mono">Búsqueda Directa</span>
                    <h3 className="text-xl font-display font-black uppercase tracking-wider text-white">Ingreso Manual</h3>
                    <p className="text-neutral-450 font-sans text-xs mt-1">Escribe el código oficial del cromo</p>
                  </div>

                  <div>
                    <input
                      type="text"
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      placeholder="Ej. ARG 10"
                      className="w-full bg-neutral-950 border border-neutral-850 text-center text-3xl font-display font-black uppercase tracking-widest text-white py-3.5 rounded-2xl focus:border-neon-cyan focus:outline-none focus:ring-1 focus:ring-neon-cyan/50 transition-all placeholder:text-neutral-800 text-[16px] md:text-3xl"
                      autoFocus
                    />
                  </div>

                  {error && (
                    <div className="text-center text-neon-pink text-xs font-sans bg-neon-pink/5 p-3 border border-neon-pink/30 rounded-xl text-neon-pink-glow">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!manualInput.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-neon-green to-emerald-500 disabled:from-neutral-900 disabled:to-neutral-900 disabled:text-neutral-600 disabled:border-neutral-850 border border-transparent text-black py-4 rounded-xl font-display font-black text-base uppercase tracking-wider hover:opacity-90 transition-all cursor-pointer active:scale-95 disabled:cursor-not-allowed shadow-[0_0_12px_rgba(57,255,20,0.35)] disabled:shadow-none"
                  >
                    {scanMode === 'single' ? 'Buscar' : 'Agregar a Pila'}
                  </button>
                </form>
                {renderSessionListWidget()}
              </>
            ) : (
              <div className="animate-in fade-in flex flex-col h-full justify-center bg-neutral-950 border border-neutral-900 p-6 rounded-2xl shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                  <div className="text-center mb-8">
                    <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest font-mono">Resultado</span>
                    <h3 className="text-5xl font-display font-black text-white my-3.5 tracking-wide text-neon-cyan-glow">{result.display}</h3>
                    
                    {isAlreadyOwned ? (
                      <div className="inline-flex items-center gap-1.5 text-neon-cyan font-display uppercase tracking-widest bg-neon-cyan/5 border border-neon-cyan/25 text-[10px] py-1 px-3.5 rounded-lg font-black text-neon-cyan-glow shadow-[0_0_8px_rgba(0,243,255,0.2)]">
                        <Check size={13} strokeWidth={4} /> ¡Ya la tienes!
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 text-neon-pink font-display uppercase tracking-widest bg-neon-pink/5 border border-neon-pink/25 text-[10px] py-1 px-3.5 rounded-lg font-black text-neon-pink-glow shadow-[0_0_8px_rgba(255,0,127,0.2)]">
                        <AlertCircle size={13} strokeWidth={4} /> Te falta
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 mt-auto">
                    {!isAlreadyOwned && (
                      <button
                        onClick={handleMarkAsOwned}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-neon-green to-emerald-500 text-black py-4 rounded-xl font-display font-black text-lg uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-[0_0_12px_rgba(57,255,20,0.35)]"
                      >
                        <Check size={20} strokeWidth={3.5} /> La tengo
                      </button>
                    )}
                    
                    {isAlreadyOwned && updateRepeated && currentRepeatedCount === 0 && !addedToAlbum && !addedToRepeated && (
                        <button
                           onClick={handleMarkAsRepeated}
                           className="w-full flex items-center justify-center gap-2 bg-neutral-900 border border-neutral-800 text-neon-purple text-neon-purple-glow py-4 rounded-xl font-display font-bold text-base uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                        >
                           <CopyPlus size={16} strokeWidth={2.5} /> Agregar a Repetidas
                        </button>
                     )}

                     {isAlreadyOwned && addedToRepeated && (
                          <div className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-display font-black text-xs tracking-widest uppercase bg-neon-pink/5 text-neon-pink border border-neon-pink/25 text-neon-pink-glow">
                              <Check size={16} strokeWidth={3} /> Agregada a repetidas
                          </div>
                     )}

                     {isAlreadyOwned && updateRepeated && currentRepeatedCount > 0 && !addedToAlbum && !addedToRepeated && (
                        <div className="flex gap-2 w-full">
                           <button
                              onClick={handleRemoveFromRepeated}
                              className="flex-1 flex items-center justify-center gap-2 bg-neutral-900/40 border border-neutral-850 text-neon-pink py-4 rounded-xl font-display text-sm uppercase tracking-wider hover:bg-neutral-850 transition-all cursor-pointer active:scale-95 font-bold text-neon-pink-glow"
                           >
                              Sacar (-1)
                           </button>
                           <button
                              onClick={handleMarkAsRepeated}
                              className="flex-1 flex items-center justify-center gap-2 bg-neutral-900 border border-neutral-800 text-neon-cyan py-4 rounded-xl font-display text-sm uppercase tracking-wider transition-all cursor-pointer active:scale-95 font-black text-neon-cyan-glow"
                           >
                              Otra (+{currentRepeatedCount + 1})
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
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-display text-xs uppercase tracking-widest transition-all bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-850 cursor-pointer active:scale-95 font-bold"
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
