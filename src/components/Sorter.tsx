import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Camera, RefreshCw, Type, Trash2, Plus, ListOrdered, CheckCircle, Info, Sparkles } from 'lucide-react';
import Tesseract from 'tesseract.js';
import { WORLD_CUP_TEAMS, getAllStickers, StickerDef } from '../data/stickers';

interface SorterProps {
  addActivity?: (text: string) => void;
  isActive?: boolean;
}

export default function Sorter({ addActivity, isActive = true }: SorterProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Tesseract.Worker | null>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamAction, setStreamAction] = useState<MediaStream | null>(null);

  // Core list of stickers currently on the workbench pile
  const [pileStickers, setPileStickers] = useState<{ id: string; display: string; count: number }[]>(() => {
    try {
      const saved = localStorage.getItem('mundial_tracker_workbench_pile');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [flashSuccess, setFlashSuccess] = useState(false);
  const [lastScannedText, setLastScannedText] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const isScanningRef = useRef(false);

  // Manual input state
  const [manualMode, setManualMode] = useState<boolean>(false);
  const [manualInput, setManualInput] = useState<string>('');
  const [manualSuccessMsg, setManualSuccessMsg] = useState<string | null>(null);
  const [manualErrorMsg, setManualErrorMsg] = useState<string | null>(null);

  // Zoom control states
  const [zoom, setZoom] = useState(1);
  const [zoomCaps, setZoomCaps] = useState<{ min: number; max: number; step: number } | null>(null);

  // Persist pile to localStorage so changing tabs doesn't wipe user data
  useEffect(() => {
    localStorage.setItem('mundial_tracker_workbench_pile', JSON.stringify(pileStickers));
  }, [pileStickers]);

  // Audio helper beep
  const playBeep = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(850, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch (err) {
      console.error('Audio beep failed:', err);
    }
  };

  // Precompute sticker order map to sort them according to album sequence
  const stickers = getAllStickers();
  const stickerOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    stickers.forEach((sticker, index) => {
      map.set(sticker.id, index);
    });
    return map;
  }, [stickers]);

  // Sort accumulated worktable stickers matching sequential album / country index order
  const sortedStickers = useMemo(() => {
    return [...pileStickers].sort((a, b) => {
      const indexA = stickerOrderMap.get(a.id) ?? Infinity;
      const indexB = stickerOrderMap.get(b.id) ?? Infinity;
      return indexA - indexB;
    });
  }, [pileStickers, stickerOrderMap]);

  // Group stickers by Team for a clean "Desk Shelf" bento layout
  const groupedStickers = useMemo(() => {
    const sections: { team: typeof WORLD_CUP_TEAMS[0]; items: typeof pileStickers }[] = [];
    WORLD_CUP_TEAMS.forEach(team => {
      const teamItems = sortedStickers.filter(item => {
        const itemPrefix = item.id.split('-')[0];
        return itemPrefix === team.prefix || (item.id === '00' && team.prefix === 'FWC');
      });
      if (teamItems.length > 0) {
        sections.push({ team, items: teamItems });
      }
    });
    return sections;
  }, [sortedStickers]);

  // Handle addition to the sorter work table
  const addStickerToPile = useCallback((id: string, display: string) => {
    setPileStickers((prev) => {
      const existing = prev.find(item => item.id === id);
      if (existing) {
        return prev.map(item => item.id === id ? { ...item, count: item.count + 1 } : item);
      } else {
        return [...prev, { id, display, count: 1 }];
      }
    });

    playBeep();
    setFlashSuccess(true);
    setTimeout(() => setFlashSuccess(false), 200);

    setLastScannedText(`Pila: Agregado ${display}`);
    setTimeout(() => {
      setLastScannedText((prev) => prev === `Pila: Agregado ${display}` ? null : prev);
    }, 2500);

    if (addActivity) {
      addActivity(`[Organizador] Agregué cromo ${display} a la mesa de ordenamiento.`);
    }
  }, [addActivity]);

  // Initialize Tesseract OCR Engine once
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
        console.error('Tesseract in Sorter init error:', err);
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

  // Web camera controls
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
      console.error('Camera sorter access denied:', err);
      setHasPermission(false);
      setError('No pudimos abrir tu cámara. Por favor escribe tus códigos o revisa los permisos.');
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
  }, [manualMode, isActive]);

  // Helper code parsing
  const parseCodeString = (input: string, strict: boolean = false) => {
    const upperInput = input.toUpperCase().replace(/[^A-Z0-9\s\-_]/g, '');
    const noSpaces = upperInput.replace(/\s+/g, '');

    if (/(^|[^A-Z0-9])(00|OO|O0|0O)([^A-Z0-9]|$)/.test(noSpaces)) {
      return { foundPrefix: '00', num: 0 };
    }

    if (noSpaces.length < 3) return { foundPrefix: '', num: 0 };

    if (strict && (noSpaces.length > 15 || !/[0-9OISBLZ]/.test(noSpaces))) {
      return { foundPrefix: '', num: 0 };
    }

    const lettersToNums = (str: string) =>
      str
        .replace(/O/g, '0')
        .replace(/Q/g, '0')
        .replace(/I/g, '1')
        .replace(/L/g, '1')
        .replace(/S/g, '5')
        .replace(/B/g, '8')
        .replace(/Z/g, '2');
    const numsToLetters = (str: string) =>
      str
        .replace(/0/g, 'O')
        .replace(/1/g, 'I')
        .replace(/5/g, 'S')
        .replace(/8/g, 'B')
        .replace(/2/g, 'Z');

    const textAsLetters = numsToLetters(noSpaces);

    for (const team of WORLD_CUP_TEAMS) {
      const p = team.prefix;
      const idx = textAsLetters.indexOf(p);

      if (idx !== -1) {
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

    return { foundPrefix: '', num: 0 };
  };

  // OCR Loop
  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current || !workerRef.current || isScanningRef.current) return;

    isScanningRef.current = true;
    setIsScanning(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Crop the center target box (60% width, 30% height) for high-performance reading
        const cropW = canvas.width * 0.6;
        const cropH = canvas.height * 0.3;
        const cropX = (canvas.width - cropW) / 2;
        const cropY = (canvas.height - cropH) / 2;

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const cropCtx = cropCanvas.getContext('2d');
        if (cropCtx) {
          cropCtx.drawImage(cropCanvas, 0, 0);
          cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

          // Standard light OCR binarization filter
          const imgData = cropCtx.getImageData(0, 0, cropW, cropH);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            const brightness = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2];
            const val = brightness > 125 ? 255 : 0;
            data[i] = val;
            data[i + 1] = val;
            data[i + 2] = val;
          }
          cropCtx.putImageData(imgData, 0, 0);

          const { data: { text } } = await workerRef.current.recognize(cropCanvas);
          const { foundPrefix, num } = parseCodeString(text, true);

          if (foundPrefix) {
            const resultId = num === 0 && foundPrefix === 'FWC' ? '00' : `${foundPrefix}-${num}`;
            const display = num === 0 && foundPrefix === 'FWC' ? '00' : `${foundPrefix} ${num}`;
            addStickerToPile(resultId, display);
          }
        }
      }
    } catch (err) {
      console.error('OCR Error in Sorter loop:', err);
    } finally {
      isScanningRef.current = false;
      setIsScanning(false);
    }
  };

  useEffect(() => {
    let active = true;

    const scanLoop = async () => {
      if (isActive && !manualMode && hasPermission && !isScanningRef.current && workerRef.current) {
        await captureAndAnalyze();
      }
      if (active) {
        setTimeout(scanLoop, 1500);
      }
    };

    if (isActive && !manualMode && hasPermission) {
      scanLoop();
    }

    return () => {
      active = false;
    };
  }, [manualMode, hasPermission, isActive]);

  // Adjust zoom
  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setZoom(val);
    if (streamAction) {
      const track = streamAction.getVideoTracks()[0];
      if (track.applyConstraints) {
        track.applyConstraints({
          advanced: [{ zoom: val } as any]
        });
      }
    }
  };

  // Submit manual input
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;

    // Support commas, spaces, or newlines as delimiters to batch-enter cards easily
    const parts = manualInput.split(/[,\n;]+/).map(p => p.trim()).filter(Boolean);
    const addedList: string[] = [];
    let invalidCount = 0;

    for (const part of parts) {
      const { foundPrefix, num } = parseCodeString(part, false);
      if (foundPrefix) {
        const validTeam = WORLD_CUP_TEAMS.find(t => t.prefix === foundPrefix);
        const start = validTeam?.startNumber ?? 1;
        if (validTeam && num >= start && num <= validTeam.count) {
          const resultId = num === 0 && foundPrefix === 'FWC' ? '00' : `${foundPrefix}-${num}`;
          const display = num === 0 && foundPrefix === 'FWC' ? '00' : `${foundPrefix} ${num}`;

          addStickerToPile(resultId, display);
          addedList.push(display);
        } else {
          invalidCount++;
        }
      } else {
        invalidCount++;
      }
    }

    if (addedList.length > 0) {
      setManualSuccessMsg(`Agregadas a la mesa: ${addedList.join(', ')}.`);
      setManualErrorMsg(null);
      setTimeout(() => setManualSuccessMsg(null), 4000);
    } else {
      setManualErrorMsg("Ningún código fue reconocido. Ejemplo válido: 'ARG 10, MEX 5, 00'");
      setManualSuccessMsg(null);
    }

    setManualInput('');
  };

  const clearPile = () => {
    if (pileStickers.length === 0) return;
    setPileStickers([]);
    setLastScannedText(null);
    if (addActivity) {
      addActivity('[Organizador] Se limpió la mesa de ordenamiento completamente.');
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto pb-24">
      <div className="text-center mb-8 px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00FF00]/10 border border-[#00FF00]/20 text-[#00FF00] text-[10px] font-bold uppercase tracking-widest mb-3">
          <Sparkles size={11} />
          Mesa de Ordenamiento Inteligente
        </div>
        <h2 className="text-3xl font-display uppercase tracking-wider text-white">Organizador de Pilas</h2>
        <p className="text-zinc-400 text-xs font-sans max-w-lg mx-auto mt-2 leading-relaxed">
          Ordena tus figuritas físicas según la secuencia exacta del álbum para pegarlas en orden óptimo.
          <span className="block text-zinc-500 font-bold mt-1.5 text-[10px]">⚠️ No afecta tu Álbum digital ni tus Repetidas. ¡Es un banco de pruebas libre!</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-4">
        
        {/* LEFT COLUMN: SOURCE ENTER (CAMERA OR MANUAL INPUT) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 shadow-[0_24px_64px_rgba(0,0,0,0.65)] rounded-3xl p-6 relative overflow-hidden">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800/60">
              <span className="text-xs font-display text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00FF00] animate-pulse"></span>
                Capturar Figuritas
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setManualMode(false)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-wider font-bold transition-all cursor-pointer active:scale-95 ${!manualMode ? 'bg-[#00FF00] text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                >
                  Cámara
                </button>
                <button
                  type="button"
                  onClick={() => setManualMode(true)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-wider font-bold transition-all cursor-pointer active:scale-95 ${manualMode ? 'bg-[#00FF00] text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                >
                  Manual / Teclado
                </button>
              </div>
            </div>

            {manualMode ? (
              <div className="space-y-4 py-3">
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 font-mono">
                      Ingreso rápido por texto
                    </label>
                    <textarea
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      placeholder="Ej: ARG 10, BRA 4, MEX 12, FWC 15, CC 2..."
                      rows={4}
                      className="w-full bg-zinc-950/60 border border-zinc-800 rounded-2xl text-zinc-200 text-xs px-4 py-3 focus:border-[#00FF00] focus:outline-none focus:ring-1 focus:ring-[#00FF00]/40 transition-all placeholder:text-zinc-755 font-sans resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-[#00FF00] text-black py-4 rounded-xl font-display text-base uppercase tracking-wider hover:bg-white transition-all font-bold cursor-pointer active:scale-95 shadow-[0_4px_15px_rgba(0,255,0,0.15)]"
                  >
                    Agregar a la Mesa de Ordenamiento
                  </button>
                </form>

                <p className="text-[10px] text-zinc-500 leading-normal font-sans pt-1">
                  💡 Puedes separar las figuritas por comas, espacios o saltos de línea. Admitimos escrituras libres como <span className="text-[#00FF00]">arg10</span>, <span className="text-[#00FF00]">mex-12</span> o <span className="text-[#00FF00]">cc 4</span>.
                </p>

                {manualSuccessMsg && (
                  <div className="bg-[#00FF00]/10 border border-[#00FF00]/20 text-[#00FF00] p-3 rounded-xl text-xs leading-relaxed font-sans mt-2 animate-in fade-in">
                    {manualSuccessMsg}
                  </div>
                )}
                {manualErrorMsg && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs leading-relaxed font-sans mt-2 animate-in fade-in">
                    {manualErrorMsg}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {hasPermission === false ? (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                    <p className="text-red-400 text-xs font-sans mb-3">{error}</p>
                    <button
                      onClick={startCamera}
                      className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-750 text-white px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer active:scale-95"
                    >
                      <RefreshCw size={12} /> Reintentar Permiso
                    </button>
                  </div>
                ) : (
                  <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-zinc-800 group">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Camera Target Box overlay */}
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                      <div className="w-[60%] h-[35%] border-2 border-[#00FF00]/70 rounded-xl relative flex items-center justify-center shadow-[0_0_15px_rgba(0,255,0,0.1)]">
                        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#00FF00]"></div>
                        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#00FF00]"></div>
                        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#00FF00]"></div>
                        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#00FF00]"></div>

                        {isScanning && (
                          <div className="absolute inset-x-0 h-0.5 bg-[#00FF00] animate-[bounce_2s_infinite] opacity-60"></div>
                        )}
                        <span className="text-[9px] text-[#00FF00]/80 font-bold uppercase tracking-widest font-mono select-none">
                          Foco de Captura
                        </span>
                      </div>
                      <p className="text-[8px] text-[#00FF00]/80 mt-3 font-mono self-center select-none bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm">
                        Enfoca el código del álbum (Ej. ARG 10)
                      </p>
                    </div>

                    {/* Flash effect */}
                    {flashSuccess && (
                      <div className="absolute inset-0 bg-white/70 animate-ping pointer-events-none"></div>
                    )}
                  </div>
                )}

                {/* Zoom Capabilities */}
                {zoomCaps && (
                  <div className="flex items-center gap-3 bg-zinc-950/65 border border-zinc-900 p-2.5 rounded-xl">
                    <span className="text-[9px] uppercase tracking-widest font-bold text-zinc-500">Zoom</span>
                    <input
                      type="range"
                      min={zoomCaps.min}
                      max={zoomCaps.max}
                      step={zoomCaps.step}
                      value={zoom}
                      onChange={handleZoomChange}
                      className="flex-1 accent-[#00FF00] bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                    />
                    <span className="text-[10px] font-mono text-zinc-300 w-8 text-right font-bold">{zoom.toFixed(1)}x</span>
                  </div>
                )}

                <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-800 flex items-center gap-2">
                  <Info size={14} className="text-[#00FF00] shrink-0" />
                  <p className="text-[10px] text-zinc-500 leading-normal font-sans">
                    El escáner utiliza visión artificial de alto rendimiento en tiempo real. Al detectar un código se reproducirá un pitido y se ordenará automáticamente abajo.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Quick Clear pile button widget */}
          <div className="bg-[#111] bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between mt-4">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">En Pila</span>
              <span className="text-xl font-display text-[#00FF00]">{sortedStickers.reduce((sum, s) => sum + s.count, 0)}</span>
            </div>
            <button
              onClick={clearPile}
              disabled={pileStickers.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all text-red-500 text-xs font-bold uppercase tracking-wider rounded-xl disabled:bg-zinc-900 disabled:text-zinc-600 disabled:border-transparent cursor-pointer disabled:cursor-not-allowed"
            >
              <Trash2 size={13} />
              Limpiar Mesa
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: RE-SORTED PILE DISPLAY */}
        <div className="lg:col-span-7">
          <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 shadow-[0_24px_64px_rgba(0,0,0,0.65)] rounded-3xl p-6 min-h-[500px] flex flex-col justify-between relative overflow-hidden">
            
            {/* Ambient Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#00FF00]/5 rounded-full blur-[60px] pointer-events-none"></div>

            <div>
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-6">
                <div>
                  <h3 className="text-xl font-display text-white uppercase tracking-wider">Pila Ordenada</h3>
                  <span className="text-[10px] text-zinc-400 font-sans block">Secuencia sugerida según el orden físico del álbum</span>
                </div>
                <div className="flex items-center gap-2 bg-zinc-950/40 border border-zinc-800/80 px-3 py-1.5 rounded-lg select-none">
                  <ListOrdered size={14} className="text-[#00FF00]" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-300 font-mono">
                    {groupedStickers.length} Grupos
                  </span>
                </div>
              </div>

              {/* Status Banner */}
              {lastScannedText && (
                <div className="mb-4 bg-[#00FF00] text-black text-center font-display uppercase tracking-widest text-xs py-2 px-4 rounded-xl animate-in fade-in slide-in-from-top-2">
                  {lastScannedText}
                </div>
              )}

              {sortedStickers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                  <div className="w-16 h-16 rounded-full bg-zinc-950/40 flex items-center justify-center border border-zinc-800 mb-4 shadow-inner text-zinc-650">
                    <ListOrdered size={24} />
                  </div>
                  <h4 className="text-white text-base font-display uppercase tracking-wide">La mesa está vacía</h4>
                  <p className="text-zinc-500 text-xs font-sans max-w-xs mt-1 leading-normal">
                    Ingresa códigos de figuritas arriba o enciende la cámara para construir la pila.
                  </p>
                </div>
              ) : (
                <div className="space-y-6 max-h-[500px] overflow-y-auto pr-1">
                  {groupedStickers.map(({ team, items }) => {
                    const isCC = team.prefix === 'CC';
                    const groupColor = isCC ? 'text-red-500 border-red-500/20 bg-red-500/5' : 'text-[#00FF00] border-[#00FF00]/20 bg-[#00FF00]/5';
                    
                    return (
                      <div key={team.id} className="bg-zinc-950/40 border border-zinc-850 p-4 rounded-2xl animate-in fade-in duration-300">
                        {/* Team Category Board */}
                        <div className="flex justify-between items-center mb-3 pb-2 border-b border-zinc-855">
                          <span className="text-xs font-display uppercase text-white tracking-wider block">
                            ⚽ {team.name} <span className="text-zinc-500 text-[10px] ml-1 font-mono">({team.prefix})</span>
                          </span>
                          <span className={`text-[9px] uppercase font-bold tracking-widest border px-2.5 py-0.5 rounded-full ${groupColor}`}>
                            {items.reduce((acc, i) => acc + i.count, 0)} cromos
                          </span>
                        </div>

                        {/* Strikers sequence items inside this Team */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {items.map((item) => {
                            // Find sequential absolute index inside sorted pile to guide physical ordering
                            const absoluteIndex = sortedStickers.findIndex(x => x.id === item.id) + 1;

                            return (
                              <div
                                key={item.id}
                                className="flex items-center justify-between p-2 bg-zinc-900/40 rounded-xl border border-zinc-805 hover:border-zinc-700 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  {/* Physical order number label */}
                                  <div className="w-5 h-5 rounded-full bg-zinc-950 border border-zinc-800 text-[10px] font-mono text-zinc-400 font-bold flex items-center justify-center shrink-0 shadow">
                                    {absoluteIndex}º
                                  </div>
                                  <span className="font-display text-white text-base font-bold tracking-wide">
                                    {item.display}
                                  </span>
                                  {item.count > 1 && (
                                    <span className="bg-[#00FF00]/10 text-[#00FF00] border border-[#00FF00]/20 text-[10px] font-mono px-1.5 py-0.2 rounded font-bold">
                                      x{item.count}
                                    </span>
                                  )}
                                </div>

                                <div className="flex gap-1.5 shrink-0">
                                  {/* Plus count adjuster */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPileStickers(prev => {
                                        return prev.map(s => s.id === item.id ? { ...s, count: s.count + 1 } : s);
                                      });
                                    }}
                                    className="p-1.5 bg-zinc-850 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer"
                                  >
                                    <Plus size={10} />
                                  </button>
                                  {/* Minus / Delete button */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPileStickers(prev => {
                                        const found = prev.find(s => s.id === item.id);
                                        if (found && found.count > 1) {
                                          return prev.map(s => s.id === item.id ? { ...s, count: s.count - 1 } : s);
                                        } else {
                                          return prev.filter(s => s.id !== item.id);
                                        }
                                      });
                                    }}
                                    className="p-1.5 bg-zinc-850 hover:bg-red-500/20 rounded text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Explanatory footer guide */}
            {sortedStickers.length > 0 && (
              <div className="mt-6 pt-4 bg-[#1a1a1a]/40 p-4 rounded-2xl border border-zinc-850">
                <h4 className="text-[10px] font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <CheckCircle size={12} className="text-[#00FF00]" />
                  ¿Cómo seguir esta guía física?
                </h4>
                <p className="text-[10px] text-zinc-500 leading-normal font-sans">
                  Suma tus cromos. Ordénalas físicamente imitando el listado de arriba de primero a último. La número <span className="text-[#00FF00] font-bold">1º</span> debe quedar arriba de tu pila, y la última al fondo de tu mano. ¡Así pegarás todo del tirón sin retroceder de hoja!
                </p>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
