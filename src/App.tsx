/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import Album from './components/Album';
import Scanner from './components/Scanner';
import ActivitiesList from './components/ActivitiesList';
import Sorter from './components/Sorter';
import ChartsView from './components/ChartsView';
import { getAllStickers } from './data/stickers';
import { BookOpen, ScanLine, FileQuestion, Sparkles, CopyPlus, ArrowRightLeft, History, ListOrdered, Settings, Trophy, BarChart3 } from 'lucide-react';
import Missing from './components/Missing';
import Repeated from './components/Repeated';
import Exchange from './components/Exchange';
import QuickAdd from './components/QuickAdd';
import QuickAddModal from './components/QuickAddModal';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { doc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';

export interface ActivityLog {
  id: string;
  text: string;
  timestamp: number;
}

const serializeRepeated = (record: Record<string, number>): string[] => {
  const result: string[] = [];
  for (const [id, count] of Object.entries(record)) {
    for (let i = 0; i < count; i++) {
        result.push(id);
    }
  }
  return result;
};

const deserializeRepeated = (list: string[]): Record<string, number> => {
   const record: Record<string, number> = {};
   for (const id of list) {
       record[id] = (record[id] || 0) + 1;
   }
   return record;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'album' | 'missing' | 'repeated' | 'exchange' | 'scanner' | 'sorter' | 'activities' | 'charts' | 'quickadd'>('album');
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  
  // Dual storing: Synchronously load states right at boot so they are instantly ready offline
  const [ownedStickers, setOwnedStickers] = useState<Set<string>>(() => {
    try {
      const cached = localStorage.getItem('cov_owned_stickers');
      return cached ? new Set(JSON.parse(cached)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [repeatedStickers, setRepeatedStickers] = useState<Record<string, number>>(() => {
    try {
      const cached = localStorage.getItem('cov_repeated_stickers');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  const [activities, setActivities] = useState<ActivityLog[]>(() => {
    try {
      const cached = localStorage.getItem('cov_activities');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [isLoaded, setIsLoaded] = useState(() => {
    try {
      // If we have cached sticker information inside localstorage, skip blocking loading spinner
      return localStorage.getItem('cov_owned_stickers') !== null;
    } catch {
      return false;
    }
  });

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Monitor connectivity updates
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen to Firestore for global album
  useEffect(() => {
    const docRef = doc(db, 'albums', 'global');
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.ownedStickers && Array.isArray(data.ownedStickers)) {
          setOwnedStickers(new Set(data.ownedStickers));
          try {
            localStorage.setItem('cov_owned_stickers', JSON.stringify(data.ownedStickers));
          } catch (e) {
            console.error(e);
          }
        }
        if (data.repeatedStickers && Array.isArray(data.repeatedStickers)) {
          setRepeatedStickers(deserializeRepeated(data.repeatedStickers));
          try {
            localStorage.setItem('cov_repeated_stickers', JSON.stringify(deserializeRepeated(data.repeatedStickers)));
          } catch (e) {
            console.error(e);
          }
        }
        if (data.activities && Array.isArray(data.activities)) {
          setActivities(data.activities);
          try {
            localStorage.setItem('cov_activities', JSON.stringify(data.activities));
          } catch (e) {
            console.error(e);
          }
        }
      } else {
        // If snapshot is empty, clean local state only if we don't have cached data offline
        try {
          if (!localStorage.getItem('cov_owned_stickers')) {
            setOwnedStickers(new Set());
            setRepeatedStickers({});
            setActivities([]);
          }
        } catch {
          setOwnedStickers(new Set());
          setRepeatedStickers({});
          setActivities([]);
        }
      }
      setIsLoaded(true);
    }, (error) => {
      console.error("Firestore Listen Error:", error);
      
      // If offline/listen failed, use the LocalStorage cached states so work is never lost
      try {
        const cachedOwned = localStorage.getItem('cov_owned_stickers');
        if (cachedOwned) setOwnedStickers(new Set(JSON.parse(cachedOwned)));
        
        const cachedRepeated = localStorage.getItem('cov_repeated_stickers');
        if (cachedRepeated) setRepeatedStickers(JSON.parse(cachedRepeated));
        
        const cachedActivities = localStorage.getItem('cov_activities');
        if (cachedActivities) setActivities(JSON.parse(cachedActivities));
      } catch (cacheErr) {
        console.error("Local storage sync fallback failed:", cacheErr);
      }

      setIsLoaded(true); 
      try {
        handleFirestoreError(error, OperationType.GET, `albums/global`);
      } catch (e) {
        // Safe catch
      }
    });

    return () => unsubscribe();
  }, []);

  // Check URL parameters for shortcut/PWA actions on startup
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const addQuery = urlParams.get('add');
    
    if (action === 'quickadd') {
      setShowQuickAddModal(true);
      setActiveTab('album');
    } else if (addQuery) {
      setActiveTab('quickadd');
    } else if (action === 'scanner') {
      setActiveTab('scanner');
    }

    const handleShiftTab = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        if (detail === 'quickadd-modal') {
          setShowQuickAddModal(true);
        } else {
          setActiveTab(detail as any);
        }
      }
    };
    window.addEventListener('shift-tab', handleShiftTab);
    return () => window.removeEventListener('shift-tab', handleShiftTab);
  }, []);

  // Process auto-add parameter strictly AFTER database is loaded
  const [hasProcessedAutoAdd, setHasProcessedAutoAdd] = useState(false);
  const [autoAddStatus, setAutoAddStatus] = useState<{
    added: string[];
    repeated: string[];
    invalid: string[];
  } | null>(null);

  useEffect(() => {
    if (isLoaded && !hasProcessedAutoAdd) {
      const urlParams = new URLSearchParams(window.location.search);
      const addQuery = urlParams.get('add');
      if (addQuery) {
        setHasProcessedAutoAdd(true);
        // Process the codes instantly
        import('./data/stickers').then(({ parseCodesFromString }) => {
          const parsed = parseCodesFromString(addQuery);
          if (parsed.length > 0) {
            let nextOwned = new Set<string>(ownedStickers);
            let nextRepeated = { ...repeatedStickers };
            let addedList: string[] = [];
            let repeatedList: string[] = [];
            
            parsed.forEach(({ foundPrefix, num }) => {
              const id = foundPrefix === 'FWC' && num === 0 ? '00' : `${foundPrefix}-${num}`;
              
              if (!nextOwned.has(id)) {
                nextOwned.add(id);
                addedList.push(id);
              } else {
                nextRepeated[id] = (nextRepeated[id] || 0) + 1;
                repeatedList.push(id);
              }
            });
            
            const addedText = addedList.length > 0 ? `Álbum: ${addedList.join(', ')}` : '';
            const repeatedText = repeatedList.length > 0 ? `Repetidas: ${repeatedList.join(', ')}` : '';
            const joiner = addedText && repeatedText ? ' | ' : '';
            const actionText = `[Atajo iOS] Se cargaron figuritas. ${addedText}${joiner}${repeatedText}`;
            
            addActivity(actionText).then((nextAct) => {
              setOwnedStickers(nextOwned);
              setRepeatedStickers(nextRepeated);
              persistToDB(nextOwned, nextRepeated, nextAct);
              setAutoAddStatus({
                added: addedList,
                repeated: repeatedList,
                invalid: []
              });
            });
          } else {
            setAutoAddStatus({
              added: [],
              repeated: [],
              invalid: [addQuery]
            });
          }
        });
      }
    }
  }, [isLoaded, hasProcessedAutoAdd, ownedStickers, repeatedStickers]);

  const handleQuickAddManual = async (stickersList: { id: string; count: number }[], sourceText: string) => {
    let nextOwned = new Set<string>(ownedStickers);
    let nextRepeated = { ...repeatedStickers };
    
    stickersList.forEach(({ id, count }) => {
      if (!nextOwned.has(id)) {
        nextOwned.add(id);
        if (count > 1) {
          nextRepeated[id] = (nextRepeated[id] || 0) + (count - 1);
        }
      } else {
        nextRepeated[id] = (nextRepeated[id] || 0) + count;
      }
    });

    setOwnedStickers(nextOwned);
    setRepeatedStickers(nextRepeated);
    const nextActivities = await addActivity(sourceText);
    await persistToDB(nextOwned, nextRepeated, nextActivities);
  };

  const persistToDB = async (newOwned: Set<string>, newRepeated: Record<string, number>, newActivities: ActivityLog[] = activities) => {
    // Write and back up locally first to guarantee zero-latency offline storage
    try {
      localStorage.setItem('cov_owned_stickers', JSON.stringify(Array.from(newOwned)));
      localStorage.setItem('cov_repeated_stickers', JSON.stringify(newRepeated));
      localStorage.setItem('cov_activities', JSON.stringify(newActivities));
    } catch (e) {
      console.warn("Storage writing failed:", e);
    }

    try {
      const docRef = doc(db, 'albums', 'global');
      await setDoc(docRef, {
        ownedStickers: Array.from(newOwned),
        repeatedStickers: serializeRepeated(newRepeated),
        activities: newActivities,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("DB syncing failed (will sync later when online):", e);
      try {
        handleFirestoreError(e, OperationType.WRITE, `albums/global`);
      } catch (err) {
        // Safe catch
      }
    }
  };

  const addActivity = async (text: string) => {
    const newActivity: ActivityLog = { id: Date.now().toString() + Math.random(), text, timestamp: Date.now() };
    const nextActivities = [newActivity, ...activities].slice(0, 50); 
    setActivities(nextActivities);
    return nextActivities;
  };

  const toggleOwned = async (id: string, forceStatus?: boolean, sourceContext?: string) => {
    let nextOwned = new Set<string>(ownedStickers);
    let added = false;
    
    if (forceStatus !== undefined) {
      if (forceStatus) { nextOwned.add(id); added = true; }
      else { nextOwned.delete(id); }
    } else {
      if (nextOwned.has(id)) { nextOwned.delete(id); }
      else { nextOwned.add(id); added = true; }
    }
    setOwnedStickers(nextOwned);
    
    let nextActivities = activities;
    if (sourceContext) {
      nextActivities = await addActivity(sourceContext);
    } else {
      if (added) nextActivities = await addActivity(`Agregué la figurita ${id} al álbum manualmente.`);
      else nextActivities = await addActivity(`Quité la figurita ${id} del álbum manualmente.`);
    }

    await persistToDB(nextOwned, repeatedStickers, nextActivities);
  };

  const updateRepeated = async (id: string, delta: number, sourceContext?: string) => {
    let nextRepeated = { ...repeatedStickers };
    const current = nextRepeated[id] || 0;
    const newCount = current + delta;
    
    if (newCount <= 0) {
      delete nextRepeated[id];
    } else {
      nextRepeated[id] = newCount;
    }
    
    setRepeatedStickers(nextRepeated);
    
    let nextActivities = activities;
    if (sourceContext) {
      nextActivities = await addActivity(sourceContext);
    } else {
      if (delta > 0) {
         nextActivities = await addActivity(`Agregué una repetida de la figurita ${id} (Total: ${newCount})`);
      } else {
         if (newCount === 1) {
            nextActivities = await addActivity(`Saqué una repetida de la figurita ${id}. ¡Queda 1 sola repetida!`);
         } else if (newCount <= 0) {
            nextActivities = await addActivity(`Saqué la figurita ${id} de repetidas. Ya no me sobran de esta.`);
         } else {
            nextActivities = await addActivity(`Saqué una repetida de la figurita ${id} (Quedan: ${newCount})`);
         }
      }
    }

    await persistToDB(ownedStickers, nextRepeated, nextActivities);
  };

  const executeExchange = async (givenId: string, receivedId: string) => {
    let nextOwned = new Set<string>(ownedStickers);
    let nextRepeated = { ...repeatedStickers };

    const validStickers = getAllStickers();
    const validReceives = validStickers.find(s => s.id === receivedId);
    if (!validReceives) {
      throw new Error(`La figurita que recibes (${receivedId}) no es un código válido.`);
    }

    if (!nextRepeated[givenId] || nextRepeated[givenId] <= 0) {
      throw new Error(`La figurita que entregas (${givenId}) no la tienes repetida.`);
    }

    if (nextRepeated[givenId] > 0) {
      nextRepeated[givenId] -= 1;
      if (nextRepeated[givenId] === 0) {
        delete nextRepeated[givenId];
      }
    }

    let alreadyHadReceived = nextOwned.has(receivedId);
    if (alreadyHadReceived) {
      nextRepeated[receivedId] = (nextRepeated[receivedId] || 0) + 1;
    } else {
      nextOwned.add(receivedId);
    }

    setOwnedStickers(nextOwned);
    setRepeatedStickers(nextRepeated);
    
    let nextActivities;
    if (alreadyHadReceived) {
      nextActivities = await addActivity(`Cambié la figurita ${givenId} por la ${receivedId}. Como ya la tenía, se fue a repetidas.`);
    } else {
      nextActivities = await addActivity(`Cambié la figurita ${givenId} por la ${receivedId}. ¡Directo al álbum!`);
    }

    await persistToDB(nextOwned, nextRepeated, nextActivities);
  };

  const batchSaveStickers = async (stickersList: { id: string; count: number }[]) => {
    let nextOwned = new Set<string>(ownedStickers);
    let nextRepeated = { ...repeatedStickers };
    let addedCount = 0;
    let repeatedCount = 0;
    
    for (const item of stickersList) {
      const { id, count } = item;
      const alreadyHas = nextOwned.has(id);
      
      if (!alreadyHas) {
        nextOwned.add(id);
        addedCount++;
        
        if (count > 1) {
          nextRepeated[id] = (nextRepeated[id] || 0) + (count - 1);
          repeatedCount += (count - 1);
        }
      } else {
        nextRepeated[id] = (nextRepeated[id] || 0) + count;
        repeatedCount += count;
      }
    }
    
    setOwnedStickers(nextOwned);
    setRepeatedStickers(nextRepeated);
    
    const sampleStickers = stickersList.slice(0, 3).map(s => s.id).join(', ') + (stickersList.length > 3 ? '...' : '');
    const activityText = `Escaneo múltiple finalizado: se procesaron ${stickersList.length} figuritas (${sampleStickers}). Se agregaron ${addedCount} al álbum y ${repeatedCount} a repetidas.`;
    const nextActivities = await addActivity(activityText);
    await persistToDB(nextOwned, nextRepeated, nextActivities);
  };

  const handleScannerAddActivity = async (text: string) => {
    const nextActivities = await addActivity(text);
    await persistToDB(ownedStickers, repeatedStickers, nextActivities);
  };

  return (
    <div className="min-h-screen bg-black text-neutral-100 font-sans pb-32 selection:bg-neon-cyan selection:text-black">

      {/* Header Bar */}
      <header className="bg-neutral-950/80 backdrop-blur-md border-b border-neutral-900 py-3.5 px-4 md:px-8 sticky top-0 z-40 shadow-[0_0_15px_rgba(0,243,255,0.1)]">
         <div className="max-w-5xl mx-auto flex items-center justify-between">
           
           {/* Logo and Brand */}
           <div className="flex items-center gap-2.5">
             <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-neutral-900 border border-neon-cyan/40 text-neon-cyan shadow-[0_0_8px_rgba(0,243,255,0.2)]">
               <Trophy size={15} strokeWidth={2.5} />
             </div>
             <div className="flex flex-col">
               <div className="flex items-center gap-1 leading-none">
                 <span className="text-base font-display font-black tracking-tight text-white flex items-center gap-1">
                   COPA <span className="text-neon-cyan text-neon-cyan-glow">TRACKER</span>
                 </span>
               </div>
               <span className="text-[7.5px] text-neutral-400 font-mono tracking-wider mt-0.5 uppercase font-medium">Panel de Colección</span>
             </div>
           </div>

           {/* Cloud Sync Status */}
           {isOnline ? (
             <div className="flex items-center gap-1.5 bg-neutral-900/60 border border-neutral-800 px-2.5 py-1 rounded-full select-none transition-all duration-300">
               <span className="relative flex h-1.5 w-1.5">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-neon-green shadow-[0_0_6px_#39ff14]"></span>
               </span>
               <span className="text-[9px] font-medium tracking-wide text-neutral-400 uppercase">Sincronizado</span>
             </div>
           ) : (
             <div className="flex items-center gap-1.5 bg-amber-950/20 border border-amber-900/40 px-2.5 py-1 rounded-full select-none transition-all duration-300 animate-pulse">
               <span className="relative flex h-1.5 w-1.5">
                 <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500 shadow-[0_0_6px_#f59e0b]"></span>
               </span>
               <span className="text-[9px] font-bold tracking-wide text-amber-500 uppercase">Modo Offline</span>
             </div>
           )}

         </div>
      </header>

      {/* Main Content Pane */}
      <main className="w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 relative z-10 select-none">
         {!isLoaded ? (
          <div className="flex flex-col justify-center items-center py-40 gap-3">
            <div className="w-10 h-10 border-2 border-neutral-800 border-t-neon-cyan rounded-full animate-spin shadow-[0_0_10px_rgba(0,243,255,0.2)]"></div>
            <p className="text-[10px] uppercase tracking-widest text-neon-cyan font-mono text-neon-cyan-glow">Sincronizando...</p>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-1 duration-300">
            <div className={activeTab === 'quickadd' ? 'block' : 'hidden'}>
              <QuickAdd 
                ownedStickers={ownedStickers} 
                repeatedStickers={repeatedStickers} 
                onAddStickers={handleQuickAddManual}
                autoAddStatus={autoAddStatus}
                onBackToAlbum={() => setActiveTab('album')}
                isOnline={isOnline}
              />
            </div>
            <div className={activeTab === 'album' ? 'block' : 'hidden'}>
              <Album ownedStickers={ownedStickers} repeatedStickers={repeatedStickers} toggleOwned={toggleOwned} updateRepeated={updateRepeated} isOnline={isOnline} />
            </div>
            <div className={activeTab === 'charts' ? 'block' : 'hidden'}>
              <ChartsView ownedStickers={ownedStickers} repeatedStickers={repeatedStickers} />
            </div>
            <div className={activeTab === 'missing' ? 'block' : 'hidden'}>
              <Missing ownedStickers={ownedStickers} toggleOwned={toggleOwned} />
            </div>
            <div className={activeTab === 'repeated' ? 'block' : 'hidden'}>
              <Repeated ownedStickers={ownedStickers} repeatedStickers={repeatedStickers} updateRepeated={updateRepeated} />
            </div>
            <div className={activeTab === 'exchange' ? 'block' : 'hidden'}>
              <Exchange executeExchange={executeExchange} ownedStickers={ownedStickers} />
            </div>
            <div className={activeTab === 'scanner' ? 'block' : 'hidden'}>
              <Scanner 
                ownedStickers={ownedStickers} 
                toggleOwned={toggleOwned} 
                repeatedStickers={repeatedStickers} 
                updateRepeated={updateRepeated} 
                addActivity={handleScannerAddActivity} 
                batchSaveStickers={batchSaveStickers} 
                isActive={activeTab === 'scanner'}
              />
            </div>
            <div className={activeTab === 'activities' ? 'block' : 'hidden'}>
              <ActivitiesList activities={activities} />
            </div>
            <div className={activeTab === 'sorter' ? 'block' : 'hidden'}>
              <Sorter 
                addActivity={handleScannerAddActivity} 
                isActive={activeTab === 'sorter'}
              />
            </div>
          </div>
        )}
      </main>

      {/* Bottom Floating Glass Dock */}
      <nav className="fixed bottom-4 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[600px] bg-neutral-950/90 backdrop-blur-md border border-neutral-800 flex justify-around items-center p-1.5 rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.8)] z-35">
        
        <button 
          onClick={() => setActiveTab('album')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl transition-all duration-200 cursor-pointer ${activeTab === 'album' ? 'text-black bg-neon-cyan shadow-[0_0_12px_rgba(0,243,255,0.5)] font-bold' : 'text-neutral-400 hover:text-neutral-200'}`}
        >
          <BookOpen strokeWidth={activeTab === 'album' ? 2.5 : 2} size={15} className="mb-0.5" />
          <span className="text-[6.5px] min-[350px]:text-[7px] sm:text-[8px] tracking-tighter uppercase font-medium">Álbum</span>
        </button>

        <button 
          onClick={() => setActiveTab('charts')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl transition-all duration-200 cursor-pointer ${activeTab === 'charts' ? 'text-black bg-neon-cyan shadow-[0_0_12px_rgba(0,243,255,0.5)] font-bold' : 'text-neutral-400 hover:text-neutral-200'}`}
        >
          <BarChart3 strokeWidth={activeTab === 'charts' ? 2.5 : 2} size={15} className="mb-0.5" />
          <span className="text-[6.5px] min-[350px]:text-[7px] sm:text-[8px] tracking-tighter uppercase font-medium font-sans">Gráficos</span>
        </button>

        <button 
          onClick={() => setActiveTab('exchange')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl transition-all duration-200 cursor-pointer ${activeTab === 'exchange' ? 'text-black bg-neon-cyan shadow-[0_0_12px_rgba(0,243,255,0.5)] font-bold' : 'text-neutral-400 hover:text-neutral-200'}`}
        >
          <ArrowRightLeft strokeWidth={activeTab === 'exchange' ? 2.5 : 2} size={15} className="mb-0.5" />
          <span className="text-[6.5px] min-[350px]:text-[7px] sm:text-[8px] tracking-tighter uppercase font-medium">Canjes</span>
        </button>

        <button 
          onClick={() => setActiveTab('scanner')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl transition-all duration-150 cursor-pointer ${activeTab === 'scanner' ? 'text-black bg-neon-cyan shadow-[0_0_12px_rgba(0,243,255,0.5)]' : 'text-neutral-400 hover:text-neutral-200'}`}
        >
          <ScanLine strokeWidth={activeTab === 'scanner' ? 2.5 : 2} size={15} className="mb-0.5" />
          <span className="text-[6.5px] min-[350px]:text-[7px] sm:text-[8px] tracking-tighter uppercase font-medium">Escáner</span>
        </button>

        <button 
          onClick={() => setActiveTab('sorter')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl transition-all duration-150 cursor-pointer ${activeTab === 'sorter' ? 'text-black bg-neon-cyan shadow-[0_0_12px_rgba(0,243,255,0.5)]' : 'text-neutral-400 hover:text-neutral-200'}`}
        >
          <ListOrdered strokeWidth={activeTab === 'sorter' ? 2.5 : 2} size={15} className="mb-0.5" />
          <span className="text-[6.5px] min-[350px]:text-[7px] sm:text-[8px] tracking-tighter uppercase font-medium font-sans">Organizar</span>
        </button>

        <button 
          onClick={() => setActiveTab('activities')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl transition-all duration-150 cursor-pointer ${activeTab === 'activities' ? 'text-black bg-neon-cyan shadow-[0_0_12px_rgba(0,243,255,0.5)]' : 'text-neutral-400 hover:text-neutral-200'}`}
        >
          <History strokeWidth={activeTab === 'activities' ? 2.5 : 2} size={15} className="mb-0.5" />
          <span className="text-[6.5px] min-[350px]:text-[7px] sm:text-[8px] tracking-tighter uppercase font-medium font-sans">Historial</span>
        </button>

      </nav>

      <QuickAddModal
        isOpen={showQuickAddModal}
        onClose={() => setShowQuickAddModal(false)}
        ownedStickers={ownedStickers}
        repeatedStickers={repeatedStickers}
        onAddStickers={handleQuickAddManual}
        isOnline={isOnline}
      />
    </div>
  );
}
