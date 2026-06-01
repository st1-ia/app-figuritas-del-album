/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import Album from './components/Album';
import Scanner from './components/Scanner';
import ActivitiesList from './components/ActivitiesList';
import Sorter from './components/Sorter';
import { getAllStickers } from './data/stickers';
import { BookOpen, ScanLine, FileQuestion, Sparkles, CopyPlus, ArrowRightLeft, History, ListOrdered, Settings, Trophy } from 'lucide-react';
import Missing from './components/Missing';
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
  const [activeTab, setActiveTab] = useState<'album' | 'missing' | 'scanner' | 'sorter' | 'activities'>('album');
  const [isLoaded, setIsLoaded] = useState(false);
  const [ownedStickers, setOwnedStickers] = useState<Set<string>>(new Set());
  const [repeatedStickers, setRepeatedStickers] = useState<Record<string, number>>({});
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  // Listen to Firestore for global album
  useEffect(() => {
    const docRef = doc(db, 'albums', 'global');
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.ownedStickers && Array.isArray(data.ownedStickers)) {
          setOwnedStickers(new Set(data.ownedStickers));
        }
        if (data.repeatedStickers && Array.isArray(data.repeatedStickers)) {
          setRepeatedStickers(deserializeRepeated(data.repeatedStickers));
        }
        if (data.activities && Array.isArray(data.activities)) {
          setActivities(data.activities);
        }
      } else {
        setOwnedStickers(new Set());
        setRepeatedStickers({});
        setActivities([]);
      }
      setIsLoaded(true);
    }, (error) => {
      console.error("Firestore Listen Error:", error);
      setIsLoaded(true); 
      try {
        handleFirestoreError(error, OperationType.GET, `albums/global`);
      } catch (e) {
        // Safe catch
      }
    });

    return () => unsubscribe();
  }, []);

  const persistToDB = async (newOwned: Set<string>, newRepeated: Record<string, number>, newActivities: ActivityLog[] = activities) => {
    try {
      const docRef = doc(db, 'albums', 'global');
      await setDoc(docRef, {
        ownedStickers: Array.from(newOwned),
        repeatedStickers: serializeRepeated(newRepeated),
        activities: newActivities,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `albums/global`);
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
           <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 px-2.5 py-1 rounded-full select-none">
             <span className="relative flex h-1.5 w-1.5">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-neon-green shadow-[0_0_6px_#39ff14]"></span>
             </span>
             <span className="text-[9px] font-medium tracking-wide text-neutral-400 uppercase">Sincronizado</span>
           </div>

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
            <div className={activeTab === 'album' ? 'block' : 'hidden'}>
              <Album ownedStickers={ownedStickers} repeatedStickers={repeatedStickers} toggleOwned={toggleOwned} />
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
            <div className={activeTab === 'missing' ? 'block' : 'hidden'}>
              <Missing ownedStickers={ownedStickers} toggleOwned={toggleOwned} />
            </div>
          </div>
        )}
      </main>

      {/* Bottom Floating Glass Dock */}
      <nav className="fixed bottom-4 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[500px] bg-neutral-950/90 backdrop-blur-md border border-neutral-800 flex justify-around items-center p-1.5 rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.8)] z-35">
        
        <button 
          onClick={() => setActiveTab('album')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl transition-all duration-200 cursor-pointer ${activeTab === 'album' ? 'text-black bg-neon-cyan shadow-[0_0_12px_rgba(0,243,255,0.5)] font-bold' : 'text-neutral-400 hover:text-neutral-200'}`}
        >
          <BookOpen strokeWidth={activeTab === 'album' ? 2.5 : 2} size={16} className="mb-0.5" />
          <span className="text-[8px] tracking-tight uppercase font-medium">Álbum</span>
        </button>

        <button 
          onClick={() => setActiveTab('missing')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl transition-all duration-200 cursor-pointer ${activeTab === 'missing' ? 'text-black bg-neon-cyan shadow-[0_0_12px_rgba(0,243,255,0.5)] font-bold' : 'text-neutral-400 hover:text-neutral-200'}`}
        >
          <FileQuestion strokeWidth={activeTab === 'missing' ? 2.5 : 2} size={16} className="mb-0.5" />
          <span className="text-[8px] tracking-tight uppercase font-medium">Faltan</span>
        </button>

        <button 
          onClick={() => setActiveTab('scanner')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl transition-all duration-200 cursor-pointer ${activeTab === 'scanner' ? 'text-black bg-neon-cyan shadow-[0_0_12px_rgba(0,243,255,0.5)] font-bold' : 'text-neutral-400 hover:text-neutral-200'}`}
        >
          <ScanLine strokeWidth={activeTab === 'scanner' ? 2.5 : 2} size={16} className="mb-0.5" />
          <span className="text-[8px] tracking-tight uppercase font-medium">Escáner</span>
        </button>

        <button 
          onClick={() => setActiveTab('sorter')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl transition-all duration-200 cursor-pointer ${activeTab === 'sorter' ? 'text-black bg-neon-cyan shadow-[0_0_12px_rgba(0,243,255,0.5)] font-bold' : 'text-neutral-400 hover:text-neutral-200'}`}
        >
          <ListOrdered strokeWidth={activeTab === 'sorter' ? 2.5 : 2} size={16} className="mb-0.5" />
          <span className="text-[8px] tracking-tight uppercase font-medium font-sans">Organizar</span>
        </button>

        <button 
          onClick={() => setActiveTab('activities')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl transition-all duration-200 cursor-pointer ${activeTab === 'activities' ? 'text-black bg-neon-cyan shadow-[0_0_12px_rgba(0,243,255,0.5)] font-bold' : 'text-neutral-400 hover:text-neutral-200'}`}
        >
          <History strokeWidth={activeTab === 'activities' ? 2.5 : 2} size={16} className="mb-0.5" />
          <span className="text-[8px] tracking-tight uppercase font-medium">Historial</span>
        </button>

      </nav>
    </div>
  );
}
