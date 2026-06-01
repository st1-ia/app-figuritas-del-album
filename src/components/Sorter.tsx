import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Camera, RefreshCw, Type, Trash2, Plus, ListOrdered, CheckCircle, Info, Sparkles } from 'lucide-react';
import Tesseract from 'tesseract.js';
import { WORLD_CUP_TEAMS, getAllStickers } from '../data/stickers';

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

  // Group stickers by Team for a clean "Desk Shelf" layout
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
    <div className="w-full max-w-5xl mx-auto pb-24 text-neutral-200 font-sans">
      <div className="text-center mb-8 px-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-neon-cyan text-[10px] font-sans font-bold uppercase tracking-wider mb-2.5 shadow-[0_0_8px_rgba(0,243,255,0.15)] text-neon-cyan-glow">
          <Sparkles size={11} className="animate-spin" style={{ animationDuration: '4s' }} />
          Mesa de Ordenamiento Inteligente
        </div>
        <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">Organizador de Pilas</h2>
        <p className="text-neutral-450 text-xs font-sans max-w-lg mx-auto mt-2 leading-relaxed">
          Ordena tus figuritas físicas según la secuencia exacta del álbum para pegarlas de forma secuencial rápida.
          <span className="block text-neon-cyan font-bold mt-1 text-[9.5px] uppercase font-mono text-neon-cyan-glow">⚠️ Banco libre: No afecta tu colección real</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 px-4 select-none">
        
        {/* LEFT COLUMN: SOURCE ENTER_KEY (CAMERA OR MANUAL INPUT) */}
        <div className="lg:col-span-12 xl:col-span-5 lg:col-start-1 space-y-4">
          <div className="bg-neutral-950/75 border border-neutral-900 shadow-[0_0_15px_rgba(0,0,0,0.5)] rounded-2xl p-5 relative overflow-hidden">
            <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-neutral-900">
              <span className="text-xs font-display font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse"></span>
                Capturar
              </span>
              <div className="flex gap-1.5 bg-neutral-900/60 p-[3px] rounded-lg border border-neutral-850">
                <button
                  type="button"
                  onClick={() => setManualMode(false)}
                  className={`px-3 py-1 rounded text-[9px] uppercase tracking-wider font-display font-bold transition-all cursor-pointer ${!manualMode ? 'bg-neutral-800 text-neon-cyan shadow-[0_0_6px_rgba(0,243,255,0.15)] font-extrabold border border-neutral-700 text-neon-cyan-glow' : 'text-neutral-500 hover:text-neutral-300'}`}
                >
                  Cámara
                </button>
                <button
                  type="button"
                  onClick={() => setManualMode(true)}
                  className={`px-3 py-1 rounded text-[9px] uppercase tracking-wider font-display font-bold transition-all cursor-pointer ${manualMode ? 'bg-neutral-800 text-neon-cyan shadow-[0_0_6px_rgba(0,243,255,0.15)] font-extrabold border border-neutral-700 text-neon-cyan-glow' : 'text-neutral-500 hover:text-neutral-300'}`}
                >
                  Manual
                </button>
              </div>
            </div>

            {manualMode ? (
              <div className="space-y-3 py-1">
                <form onSubmit={handleManualSubmit} className="space-y-3">
                  <div>
                    <label className="block text-[8px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 font-mono">
                      Ingreso rápido por lote
                    </label>
                    <textarea
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      placeholder="Ej: ARG 10, BRA 4, MEX 12, FWC 15, CC 2..."
                      rows={4}
                      className="w-full bg-neutral-950 border border-neutral-850 rounded-xl text-white text-[16px] md:text-sm px-3.5 py-2.5 focus:border-neon-cyan focus:outline-none focus:ring-1 focus:ring-neon-cyan/50 transition-all placeholder:text-neutral-700 font-sans resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-neon-green to-emerald-500 text-black py-3 rounded-lg font-display text-sm font-bold uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-[0_0_12px_rgba(57,255,20,0.25)]"
                  >
                    Agregar a la Mesa de Orden
                  </button>
                </form>

                <p className="text-[10px] text-neutral-450 leading-relaxed font-sans pt-1">
                  💡 Puedes separar las figuritas por comas, espacios o saltos de línea. Admitimos escrituras libres como <span className="text-neon-cyan font-bold font-mono">arg10</span>, <span className="text-neon-cyan font-bold font-mono">mex-12</span> o <span className="text-neon-cyan font-bold font-mono">cc 4</span>.
                </p>

                {manualSuccessMsg && (
                  <div className="bg-neon-green/5 border border-neon-green/30 text-neon-green p-3 rounded-xl text-xs leading-relaxed font-sans animate-in fade-in font-medium text-neon-green-glow">
                    {manualSuccessMsg}
                  </div>
                )}
                {manualErrorMsg && (
                  <div className="bg-neon-pink/5 border border-neon-pink/30 text-neon-pink p-3 rounded-xl text-xs leading-relaxed font-sans animate-in fade-in text-neon-pink-glow">
                    {manualErrorMsg}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {hasPermission === false ? (
                  <div className="p-4 bg-neon-pink/5 border border-neon-pink/20 rounded-xl text-center">
                    <p className="text-neon-pink text-xs font-sans mb-3 text-neon-pink-glow">{error}</p>
                    <button
                      onClick={startCamera}
                      className="inline-flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 text-neutral-300 px-3 py-2 rounded-lg text-xs hover:text-white hover:bg-neutral-850 transition-colors cursor-pointer active:scale-95 font-bold"
                    >
                      <RefreshCw size={11} /> Reintentar Permiso
                    </button>
                  </div>
                ) : (
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-neutral-950 border border-neutral-900 group">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover opacity-80"
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Camera Target Box overlay */}
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                      <div className="w-[60%] h-[35%] border-2 border-neutral-800/40 rounded-xl relative flex items-center justify-center bg-black/10">
                        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-neon-cyan shadow-[0_0_6px_rgba(0,243,255,1)]"></div>
                        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-neon-cyan shadow-[0_0_6px_rgba(0,243,255,1)]"></div>
                        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-neon-cyan shadow-[0_0_6px_rgba(0,243,255,1)]"></div>
                        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-neon-cyan shadow-[0_0_6px_rgba(0,243,255,1)]"></div>

                        {isScanning && (
                          <div className="absolute inset-x-0 h-0.5 bg-neon-cyan/70 shadow-[0_0_10px_#00f3ff] animate-[bounce_2s_infinite]"></div>
                        )}
                        <span className="text-[9px] text-neon-cyan font-black uppercase tracking-widest font-mono select-none animate-pulse text-neon-cyan-glow">
                          Foco Sorter
                        </span>
                      </div>
                      <p className="text-[8px] text-neutral-300 bg-neutral-950/90 border border-neutral-800 mt-2.5 font-mono select-none px-2.5 py-1 rounded-full backdrop-blur-xs tracking-wide">
                        Enfoca el código del álbum (Ej. ARG 10)
                      </p>
                    </div>

                    {/* Flash effect */}
                    {flashSuccess && (
                      <div className="absolute inset-0 bg-emerald-500/15 pointer-events-none transition-opacity duration-150 animate-pulse"></div>
                    )}
                  </div>
                )}

                {/* Zoom Capabilities */}
                {zoomCaps && (
                  <div className="flex items-center gap-2.5 bg-neutral-900/60 border border-neutral-850 p-2 rounded-xl">
                    <span className="text-[8.5px] uppercase tracking-widest font-mono font-bold text-neutral-550">Zoom</span>
                    <input
                      type="range"
                      min={zoomCaps.min}
                      max={zoomCaps.max}
                      step={zoomCaps.step}
                      value={zoom}
                      onChange={handleZoomChange}
                      className="flex-1 accent-neon-cyan bg-neutral-800 h-1 rounded-lg cursor-pointer animate-none"
                    />
                    <span className="text-[9.5px] font-mono text-neon-cyan w-8 text-right font-bold text-neon-cyan-glow">{zoom.toFixed(1)}x</span>
                  </div>
                )}

                <div className="p-3 bg-neutral-950 border border-neutral-900 rounded-xl flex items-start gap-2">
                  <Info size={13} className="text-neon-cyan shrink-0 mt-0.5" />
                  <p className="text-[10px] text-neutral-450 leading-relaxed font-sans">
                    El escáner de visión por computadora detectará automáticamente los códigos oficiales, pitará, y los agregará al listado de la pila organizada en tiempo real.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Quick Clear pile button widget */}
          <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-3 flex items-center justify-between shadow-[0_0_10px_rgba(0,0,0,0.4)]">
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest font-mono">Figuritas en Mesa</span>
              <span className="text-2xl font-display font-black text-white text-neon-cyan-glow">{sortedStickers.reduce((sum, s) => sum + s.count, 0)}</span>
            </div>
            <button
              onClick={clearPile}
              disabled={pileStickers.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-850 hover:text-neon-pink hover:border-neutral-700 border border-neutral-800 text-neon-pink-glow text-neon-pink text-xs font-bold uppercase tracking-wider rounded-lg disabled:opacity-30 disabled:hover:bg-neutral-900 disabled:hover:text-neon-pink cursor-pointer disabled:cursor-not-allowed transition-all"
            >
              <Trash2 size={12} />
              Limpiar Mesa
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: RE-SORTED PILE DISPLAY */}
        <div className="lg:col-span-12 xl:col-span-7">
          <div className="bg-neutral-950/75 border border-neutral-900 shadow-[0_0_15px_rgba(0,0,0,0.5)] rounded-2xl p-5 min-h-[480px] flex flex-col justify-between relative overflow-hidden">
            
            <div>
              <div className="flex items-center justify-between pb-3.5 border-b border-neutral-900 mb-5">
                <div>
                  <h3 className="text-lg font-display font-black text-white uppercase tracking-tight">Mesa de Ordenamiento</h3>
                  <span className="text-[10px] text-neutral-450 font-sans block mt-0.5 font-medium">Sugerencia secuencial para apilar y pegar sin navegar de hoja</span>
                </div>
                <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-lg select-none text-neon-cyan shadow-[0_0_6px_rgba(0,243,255,0.1)] font-mono text-neon-cyan-glow">
                  <ListOrdered size={12} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {groupedStickers.length} Grupos
                  </span>
                </div>
              </div>

              {/* Status Banner */}
              {lastScannedText && (
                <div className="mb-4 bg-neon-cyan/5 border border-neon-cyan/25 text-neon-cyan text-center font-display uppercase tracking-wider text-[10px] py-1.5 px-3 rounded-lg animate-in font-bold text-neon-cyan-glow shadow-[0_0_8px_rgba(0,243,255,0.15)]">
                  {lastScannedText}
                </div>
              )}

              {sortedStickers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                  <div className="w-12 h-12 rounded-full bg-neutral-900 flex items-center justify-center border border-neutral-800 mb-3 text-neutral-500 shadow-[0_0_8px_rgba(0,0,0,0.4)]">
                    <ListOrdered size={18} />
                  </div>
                  <h4 className="text-neutral-300 text-sm font-display font-bold uppercase tracking-wide">La mesa está libre</h4>
                  <p className="text-neutral-500 text-xs font-sans max-w-xs mt-1.5 leading-normal">
                    Ingresa códigos de figuritas arriba o enciende la cámara para agruparlas por equipo.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[440px] overflow-y-auto pr-1">
                  {groupedStickers.map(({ team, items }) => {
                    const isCC = team.prefix === 'CC';
                    const groupColor = isCC 
                      ? 'text-neon-pink border-neon-pink/20 bg-neon-pink/5 shadow-[0_0_6px_rgba(255,0,127,0.1)]' 
                      : 'text-neon-cyan border-neon-cyan/20 bg-neon-cyan/5 shadow-[0_0_6px_rgba(0,243,255,0.1)]';
                    
                    return (
                      <div key={team.id} className="bg-neutral-900/10 border border-neutral-900 p-3.5 rounded-xl animate-in fade-in duration-200">
                        {/* Team Category Board */}
                        <div className="flex justify-between items-center mb-3 pb-1.5 border-b border-neutral-900 font-sans">
                          <span className="text-[11.5px] font-display font-bold uppercase text-white tracking-wider block">
                             {team.name} <span className="text-neutral-500 text-[9px] ml-1 font-mono">({team.prefix})</span>
                          </span>
                          <span className={`text-[8px] uppercase font-mono font-bold tracking-wider border px-2 py-0.5 rounded-md ${groupColor}`}>
                            {items.reduce((acc, i) => acc + i.count, 0)} cromos
                          </span>
                        </div>

                        {/* Strikers sequence items inside this Team */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-sans">
                          {items.map((item) => {
                            const absoluteIndex = sortedStickers.findIndex(x => x.id === item.id) + 1;

                            return (
                              <div
                                key={item.id}
                                className="flex items-center justify-between p-2 bg-neutral-950 rounded-lg border border-neutral-900 hover:border-neutral-800 hover:shadow-[0_0_8px_rgba(0,243,255,0.05)] transition-all"
                              >
                                <div className="flex items-center gap-2">
                                  {/* Physical order number label */}
                                  <div className="w-5 h-5 rounded bg-neutral-900 border border-neutral-800 text-[8.5px] font-mono text-neon-cyan font-extrabold flex items-center justify-center shrink-0 shadow-[0_0_4px_rgba(0,243,255,0.15)] text-neon-cyan-glow">
                                    {absoluteIndex}º
                                  </div>
                                  <span className="font-display text-white text-sm font-bold tracking-wide">
                                    {item.display}
                                  </span>
                                  {item.count > 1 && (
                                    <span className="bg-neutral-900 border border-neutral-850 text-neutral-400 text-[10px] font-mono px-1.5 py-0.2 rounded font-bold">
                                      x{item.count}
                                    </span>
                                  )}
                                </div>

                                <div className="flex gap-1 shrink-0">
                                  {/* Plus count adjuster */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPileStickers(prev => {
                                        return prev.map(s => s.id === item.id ? { ...s, count: s.count + 1 } : s);
                                      });
                                    }}
                                    className="p-1.5 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition-colors cursor-pointer"
                                  >
                                    <Plus size={8} />
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
                                    className="p-1.5 bg-neutral-900 border border-neutral-800 hover:bg-neon-pink/15 hover:text-neon-pink hover:border-neon-pink/30 rounded text-neutral-400 transition-all cursor-pointer text-neon-pink-glow"
                                  >
                                    <Trash2 size={8} />
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
              <div className="mt-5 pt-3.5 bg-neutral-950 p-3 rounded-xl border border-neutral-900">
                <h4 className="text-[10px] font-display font-medium text-white uppercase tracking-wider mb-1.5 flex items-center gap-1.5 font-bold">
                  <CheckCircle size={11} className="text-neon-cyan" />
                  ¿Cómo seguir esta guía física?
                </h4>
                <p className="text-[9.5px] text-neutral-400 leading-relaxed font-sans">
                  Suma tus cromos. Ordénalos físicamente imitando el listado de arriba de primero a último. La número <span className="text-neon-cyan font-extrabold font-mono text-neon-cyan-glow">1º</span> debe quedar arriba de tu pila, y la última al fondo de tu mano. ¡Así pegarás todo del tirón sin retroceder de hoja!
                </p>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
