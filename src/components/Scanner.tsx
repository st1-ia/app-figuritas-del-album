import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Check, AlertCircle, Loader2, Type as TypeIcon, CopyPlus } from 'lucide-react';
import Tesseract from 'tesseract.js';
import { WORLD_CUP_TEAMS } from '../data/stickers';

interface ScannerProps {
  ownedStickers: Set<string>;
  repeatedStickers?: Record<string, number>;
  toggleOwned: (id: string, forceStatus?: boolean) => void;
  updateRepeated?: (id: string, delta: number) => void;
}

export default function Scanner({ ownedStickers, repeatedStickers, toggleOwned, updateRepeated }: ScannerProps) {
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
    if (!manualMode) {
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
  }, [manualMode]);

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
        setResult({
          id: '00',
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
        setResult({
          id: num === 0 && foundPrefix === 'FWC' ? '00' : `${foundPrefix}-${num}`,
          display: num === 0 && foundPrefix === 'FWC' ? '00' : `${foundPrefix} ${num}`
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
    if (!videoRef.current || !canvasRef.current || isScanningRef.current || result || manualMode || !workerRef.current) return;
    
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
        if (text.length >= 2 && conf > 25) {
           const { foundPrefix, num } = parseCodeString(text, false);

           if (foundPrefix === '00' && num === 0) {
               setResult({
                   id: '00',
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
                 setResult({
                     id: num === 0 && foundPrefix === 'FWC' ? '00' : `${validTeam.prefix}-${num}`,
                     display: num === 0 && foundPrefix === 'FWC' ? '00' : `${validTeam.prefix} ${num}`
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
  }, [result, manualMode]);

  useEffect(() => {
    let active = true;
    
    const scanLoop = async () => {
      if (!manualMode && !result && hasPermission && !isScanningRef.current && workerRef.current) {
        await captureAndAnalyze();
      }
      
      if (active) {
        setTimeout(scanLoop, 500);
      }
    };
    
    if (!manualMode && !result && hasPermission) {
      scanLoop();
    }
    
    return () => {
      active = false;
    };
  }, [manualMode, result, hasPermission, captureAndAnalyze]);

  const handleMarkAsOwned = () => {
    if (result) {
      toggleOwned(result.id, true);
      setAddedToAlbum(true);
    }
  };

  const handleMarkAsRepeated = () => {
    if (result && updateRepeated) {
      updateRepeated(result.id, 1);
      setAddedToRepeated(true);
      setRemovedFromRepeated(false);
    }
  };

  const handleRemoveFromRepeated = () => {
    if (result && updateRepeated) {
      updateRepeated(result.id, -1);
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

  return (
    <div className="w-full max-w-lg mx-auto p-4 pb-24">
      <div className="bg-[#111] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-[#333] overflow-hidden">
        
        <div className="flex border-b border-[#333]">
          <button 
            onClick={() => setManualMode(false)}
            className={`flex-1 p-4 font-display uppercase tracking-widest text-sm transition-colors ${!manualMode ? 'bg-[#222] text-[#00FF00]' : 'text-gray-500 hover:text-white'}`}
          >
            Escáner OCR
          </button>
          <button 
            onClick={() => {
              setManualMode(true);
              setResult(null);
              setError(null);
            }}
            className={`flex-1 p-4 font-display uppercase tracking-widest text-sm transition-colors ${manualMode ? 'bg-[#222] text-[#00FF00]' : 'text-gray-500 hover:text-white'}`}
          >
            Manual
          </button>
        </div>

        {!manualMode ? (
          <>
            <div className="relative bg-black aspect-[3/4] sm:aspect-square flex flex-col items-center justify-center overflow-hidden">
              
              {hasPermission === false && (
                <div className="text-white text-center p-6 bg-[#111] absolute inset-0 flex flex-col items-center justify-center z-20">
                  <AlertCircle size={48} className="text-[#FF0000] mb-4" />
                  <p className="font-sans text-sm">{error}</p>
                  <button 
                    onClick={startCamera}
                    className="mt-6 px-6 py-3 bg-[#00FF00] text-black font-display tracking-widest uppercase rounded-none hover:bg-white transition-colors"
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
                          <span className="text-[10px] text-[#00FFFF]/40 font-display uppercase tracking-widest text-center leading-tight px-4">
                             Enfoca las letras y números aquí
                          </span>
                       </div>

                       {isScanning && (
                           <div className="absolute inset-0 border border-[#00FF00] animate-ping opacity-20"></div>
                       )}
                   </div>
                </div>
              )}

              {isScanning && !result && (
                <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-3 text-[#00FF00] bg-black/80 backdrop-blur-md px-6 py-3 w-max mx-auto border border-[#00FF00]/50 animate-pulse rounded-full z-30">
                   <Loader2 size={18} className="animate-spin" />
                   <span className="text-xs font-display tracking-widest uppercase">Escaneando...</span>
                </div>
              )}
            </div>

            <div className="p-6 min-h-[16rem] flex flex-col justify-center bg-[#151515]">
              {!result && (
                <div className="flex flex-col gap-4">
                  {zoomCaps && (
                    <div className="mb-4">
                      <div className="flex justify-between items-center text-xs font-display text-white mb-2 uppercase tracking-widest">
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
                        className="w-full accent-[#00FF00] h-2 bg-[#333] rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  )}

                  {error && (
                    <div className="text-center bg-[#FF0000]/10 border border-[#FF0000]/30 text-[#FF0000] p-4 text-sm font-sans tracking-wide">
                      {error}
                    </div>
                  )}
                  
                  <div className="text-center">
                    <p className="text-white font-display text-lg uppercase tracking-widest">
                       Buscando código...
                    </p>
                    <p className="text-[#666] text-xs font-sans mt-2">
                      Apunta la figurita para escanear automáticamente. Asegúrate de tener buena luz.
                    </p>
                  </div>
                </div>
              )}

              {result && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
                  <div className="text-center mb-6">
                     <span className="text-[10px] font-bold text-[#888] uppercase tracking-widest">Código Detectado</span>
                     <h3 className="text-5xl font-display text-white my-2 tracking-wide">{result.display}</h3>
                     
                     {isAlreadyOwned ? (
                        <div className="inline-flex items-center gap-2 text-black font-display uppercase tracking-widest bg-[#00FF00] px-4 py-1 mt-2">
                           <Check size={16} strokeWidth={3} /> ¡Ya la tienes!
                        </div>
                     ) : (
                        <div className="inline-flex items-center gap-2 text-black font-display uppercase tracking-widest bg-[#FF00FF] px-4 py-1 mt-2">
                           <AlertCircle size={16} strokeWidth={3} /> Te falta
                        </div>
                     )}
                  </div>

                  <div className="flex flex-col gap-3">
                     {!isAlreadyOwned && (
                        <button
                           onClick={handleMarkAsOwned}
                           className="w-full flex items-center justify-center gap-2 bg-[#00FF00] text-black py-4 rounded-xl font-display text-xl uppercase tracking-widest hover:bg-white transition-colors"
                        >
                           <Check size={24} strokeWidth={3} /> Agregar al álbum
                        </button>
                     )}
                     
                     {isAlreadyOwned && updateRepeated && currentRepeatedCount === 0 && !addedToAlbum && (
                        <button
                           onClick={handleMarkAsRepeated}
                           className="w-full flex items-center justify-center gap-2 bg-[#00FFFF] text-black py-4 rounded-xl font-display text-lg uppercase tracking-widest hover:bg-white transition-colors shadow-[0_0_15px_rgba(0,255,255,0.2)]"
                        >
                           <CopyPlus size={20} strokeWidth={2.5} /> Agregar a Repetidas
                        </button>
                     )}

                     {isAlreadyOwned && updateRepeated && currentRepeatedCount > 0 && !addedToAlbum && (
                        <div className="flex gap-2 w-full">
                           <button
                              onClick={handleRemoveFromRepeated}
                              className="flex-1 flex items-center justify-center gap-2 bg-[#FF0055] text-white py-4 rounded-xl font-display text-lg uppercase tracking-widest hover:bg-white hover:text-[#FF0055] transition-colors shadow-[0_0_15px_rgba(255,0,85,0.2)]"
                           >
                              <RefreshCw size={20} strokeWidth={2.5} /> Sacar (-1)
                           </button>
                           <button
                              onClick={handleMarkAsRepeated}
                              className="flex-1 flex items-center justify-center gap-2 bg-[#00FFFF] text-black py-4 rounded-xl font-display text-lg uppercase tracking-widest hover:bg-white transition-colors shadow-[0_0_15px_rgba(0,255,255,0.2)]"
                           >
                              <CopyPlus size={20} strokeWidth={2.5} /> Otra (+{currentRepeatedCount + 1})
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
                        className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-display text-lg uppercase tracking-widest transition-colors flex-1 bg-[#222] text-[#AAA] hover:bg-[#333] hover:text-white`}
                     >
                        <RefreshCw size={18} /> Escanear otra
                     </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="p-8 bg-[#151515] min-h-[400px] flex flex-col justify-center">
            
            {!result ? (
              <form onSubmit={handleManualSubmit} className="space-y-6 animate-in fade-in zoom-in-95">
                <div className="text-center mb-8">
                  <TypeIcon size={48} className="mx-auto text-[#444] mb-4" />
                  <h3 className="text-2xl font-display uppercase tracking-widest">Ingreso Manual</h3>
                  <p className="text-[#888] font-sans text-sm mt-2">Escribe el código de la figurita</p>
                </div>

                <div>
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Ej. ARG 10"
                    className="w-full bg-[#111] border-2 border-[#333] text-center text-3xl font-display uppercase tracking-widest text-white py-4 rounded-xl focus:border-[#00FF00] focus:outline-none transition-colors"
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="text-center text-[#FF0000] text-sm font-sans bg-[#FF0000]/10 p-2 border border-[#FF0000]/20 rounded-md">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!manualInput.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-[#00FF00] disabled:bg-[#333] disabled:text-[#666] text-black py-4 rounded-xl font-display text-xl uppercase tracking-widest hover:bg-white transition-all disabled:hover:bg-[#333]"
                >
                  Buscar
                </button>
              </form>
            ) : (
              <div className="animate-in fade-in zoom-in-95 flex flex-col h-full justify-center">
                  <div className="text-center mb-8">
                    <span className="text-[10px] font-bold text-[#888] uppercase tracking-widest shrink-0 block mb-2">Resultado</span>
                    <h3 className="text-6xl font-display text-white my-2 tracking-wide">{result.display}</h3>
                    
                    {isAlreadyOwned ? (
                      <div className="inline-flex flex-col items-center gap-2 mt-4">
                        <div className="inline-flex items-center gap-2 text-black font-display uppercase tracking-widest bg-[#00FF00] px-4 py-1">
                          <Check size={16} strokeWidth={3} /> ¡Ya la tienes!
                        </div>
                      </div>
                    ) : (
                      <div className="inline-flex flex-col items-center gap-2 mt-4">
                        <div className="inline-flex items-center gap-2 text-black font-display uppercase tracking-widest bg-[#FF00FF] px-4 py-1">
                          <AlertCircle size={16} strokeWidth={3} /> Te falta
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 mt-auto">
                    {!isAlreadyOwned && (
                      <button
                        onClick={handleMarkAsOwned}
                        className="w-full flex items-center justify-center gap-2 bg-[#00FF00] text-black py-4 rounded-xl font-display text-xl uppercase tracking-widest hover:bg-white transition-colors"
                      >
                        <Check size={24} strokeWidth={3} /> La tengo
                      </button>
                    )}
                    
                    {isAlreadyOwned && updateRepeated && currentRepeatedCount === 0 && !addedToAlbum && (
                        <button
                           onClick={handleMarkAsRepeated}
                           className="w-full flex items-center justify-center gap-2 bg-[#00FFFF] text-black py-4 rounded-xl font-display text-lg uppercase tracking-widest hover:bg-white transition-colors shadow-[0_0_15px_rgba(0,255,255,0.2)]"
                        >
                           <CopyPlus size={20} strokeWidth={2.5} /> Agregar a Repetidas
                        </button>
                     )}

                     {isAlreadyOwned && updateRepeated && currentRepeatedCount > 0 && !addedToAlbum && (
                        <div className="flex gap-2 w-full">
                           <button
                              onClick={handleRemoveFromRepeated}
                              className="flex-1 flex items-center justify-center gap-2 bg-[#FF0055] text-white py-4 rounded-xl font-display text-lg uppercase tracking-widest hover:bg-white hover:text-[#FF0055] transition-colors shadow-[0_0_15px_rgba(255,0,85,0.2)]"
                           >
                              <RefreshCw size={20} strokeWidth={2.5} /> Sacar (-1)
                           </button>
                           <button
                              onClick={handleMarkAsRepeated}
                              className="flex-1 flex items-center justify-center gap-2 bg-[#00FFFF] text-black py-4 rounded-xl font-display text-lg uppercase tracking-widest hover:bg-white transition-colors shadow-[0_0_15px_rgba(0,255,255,0.2)]"
                           >
                              <CopyPlus size={20} strokeWidth={2.5} /> Otra (+{currentRepeatedCount + 1})
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
                      className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-display text-lg uppercase tracking-widest transition-colors bg-[#222] text-[#AAA] hover:bg-[#333] hover:text-white`}
                    >
                      Ingresar otra
                    </button>
                  </div>
              </div>
            )}
            
          </div>
        )}
      </div>
    </div>
  );
}

