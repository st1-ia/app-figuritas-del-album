/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import Album from './components/Album';
import Scanner from './components/Scanner';
import Repeated from './components/Repeated';
import Exchange from './components/Exchange';
import { getAllStickers } from './data/stickers';
import { BookOpen, ScanLine, Settings, CheckCircle2, CopyPlus, ArrowRightLeft } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';

function SettingsTab({ clearAlbum }: { clearAlbum: () => void }) {
  return (
    <div className="w-full max-w-xl mx-auto p-4 pb-24">
      <div className="bg-[#111] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-[#333] overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-300">
        <h2 className="text-2xl font-display uppercase tracking-wider text-white text-center mb-6">Ajustes</h2>
        
        <div className="space-y-6">
          <div className="p-4 bg-[#1a1a1a] rounded-lg border border-[#333] flex items-center justify-between">
            <div>
              <h3 className="text-lg font-display uppercase text-[#00FF00] mb-1">Álbum Global</h3>
              <p className="text-xs text-gray-400">Todos los dispositivos comparten la misma colección sin necesidad de iniciar sesión.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
  const [activeTab, setActiveTab] = useState<'album' | 'repeated' | 'exchange' | 'scanner' | 'settings'>('album');
  const [isLoaded, setIsLoaded] = useState(false);
  const [ownedStickers, setOwnedStickers] = useState<Set<string>>(new Set());
  const [repeatedStickers, setRepeatedStickers] = useState<Record<string, number>>({});

  // Listen to Firestore for global album
  useEffect(() => {
    const docRef = doc(db, 'albums', 'global');
    
    // Subscribe to realtime updates
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.ownedStickers && Array.isArray(data.ownedStickers)) {
          setOwnedStickers(new Set(data.ownedStickers));
        }
        if (data.repeatedStickers && Array.isArray(data.repeatedStickers)) {
          setRepeatedStickers(deserializeRepeated(data.repeatedStickers));
        }
      } else {
        setOwnedStickers(new Set());
        setRepeatedStickers({});
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

  const persistToDB = async (newOwned: Set<string>, newRepeated: Record<string, number>) => {
    try {
      const docRef = doc(db, 'albums', 'global');
      await setDoc(docRef, {
        ownedStickers: Array.from(newOwned),
        repeatedStickers: serializeRepeated(newRepeated),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `albums/global`);
    }
  };

  const clearAlbum = async () => {
    const emptyOwned = new Set<string>();
    const emptyRepeated: Record<string, number> = {};
    setOwnedStickers(emptyOwned);
    setRepeatedStickers(emptyRepeated);
    await persistToDB(emptyOwned, emptyRepeated);
  };

  const toggleOwned = async (id: string, forceStatus?: boolean) => {
    let nextOwned = new Set<string>(ownedStickers);
    if (forceStatus !== undefined) {
      if (forceStatus) nextOwned.add(id);
      else nextOwned.delete(id);
    } else {
      if (nextOwned.has(id)) nextOwned.delete(id);
      else nextOwned.add(id);
    }
    setOwnedStickers(nextOwned);
    await persistToDB(nextOwned, repeatedStickers);
  };

  const updateRepeated = async (id: string, delta: number) => {
    let nextRepeated = { ...repeatedStickers };
    const current = nextRepeated[id] || 0;
    const newCount = current + delta;
    
    if (newCount <= 0) {
      delete nextRepeated[id];
    } else {
      nextRepeated[id] = newCount;
    }
    
    setRepeatedStickers(nextRepeated);
    await persistToDB(ownedStickers, nextRepeated);
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

    if (nextOwned.has(receivedId)) {
      nextRepeated[receivedId] = (nextRepeated[receivedId] || 0) + 1;
    } else {
      nextOwned.add(receivedId);
    }

    setOwnedStickers(nextOwned);
    setRepeatedStickers(nextRepeated);
    await persistToDB(nextOwned, nextRepeated);
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-20 selection:bg-[#00FF00] selection:text-black">
      <header className="bg-[#111] shadow-md border-b border-[#333] py-5 px-4 sticky top-0 z-20">
         <h1 className="text-xl font-display uppercase tracking-wider text-center flex flex-col items-center justify-center gap-0">
            <div className="flex items-center gap-2">
              <span className="text-white">Mundial</span> 
              <span className="text-[#00FF00]">Tracker</span>
            </div>
            <span className="text-[8px] text-gray-500 opacity-50 tracking-[4px] mt-1">VER 1.0.2 - CLOUD SYNC FIXED</span>
         </h1>
      </header>

      <main className="w-full mx-auto p-4 sm:p-6 lg:p-8">
        {!isLoaded ? (
          <div className="flex justify-center p-12">
            <div className="w-8 h-8 border-4 border-[#00FF00] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {activeTab === 'album' && <Album ownedStickers={ownedStickers} toggleOwned={toggleOwned} />}
            {activeTab === 'repeated' && <Repeated ownedStickers={ownedStickers} repeatedStickers={repeatedStickers} updateRepeated={updateRepeated} />}
            {activeTab === 'exchange' && <Exchange executeExchange={executeExchange} />}
            {activeTab === 'scanner' && <Scanner ownedStickers={ownedStickers} toggleOwned={toggleOwned} repeatedStickers={repeatedStickers} updateRepeated={updateRepeated} />}
            {activeTab === 'settings' && <SettingsTab clearAlbum={clearAlbum} />}
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a] border-t border-[#222] flex justify-around items-center p-2 pb-6 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-30">
        <button 
          onClick={() => setActiveTab('album')}
          className={`flex flex-col items-center justify-center w-1/5 py-2 transition-all duration-300 ${activeTab === 'album' ? 'text-[#00FF00]' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <BookOpen strokeWidth={activeTab === 'album' ? 2.5 : 2} size={22} className={activeTab === 'album' ? 'scale-110 mb-1' : 'mb-1'} />
          <span className="text-[9px] font-bold uppercase tracking-widest">Álbum</span>
        </button>
        <button 
          onClick={() => setActiveTab('repeated')}
          className={`flex flex-col items-center justify-center w-1/5 py-2 transition-all duration-300 ${activeTab === 'repeated' ? 'text-[#00FF00]' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <CopyPlus strokeWidth={activeTab === 'repeated' ? 2.5 : 2} size={22} className={activeTab === 'repeated' ? 'scale-110 mb-1' : 'mb-1'} />
          <span className="text-[9px] font-bold uppercase tracking-widest">Repetidas</span>
        </button>
        <button 
          onClick={() => setActiveTab('exchange')}
          className={`flex flex-col items-center justify-center w-1/5 py-2 transition-all duration-300 ${activeTab === 'exchange' ? 'text-[#00FF00]' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <ArrowRightLeft strokeWidth={activeTab === 'exchange' ? 2.5 : 2} size={22} className={activeTab === 'exchange' ? 'scale-110 mb-1' : 'mb-1'} />
          <span className="text-[9px] font-bold uppercase tracking-widest">Cambiar</span>
        </button>
        <button 
          onClick={() => setActiveTab('scanner')}
          className={`flex flex-col items-center justify-center w-1/5 py-2 transition-all duration-300 ${activeTab === 'scanner' ? 'text-[#00FF00]' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <ScanLine strokeWidth={activeTab === 'scanner' ? 2.5 : 2} size={22} className={activeTab === 'scanner' ? 'scale-110 mb-1' : 'mb-1'} />
          <span className="text-[9px] font-bold uppercase tracking-widest">Escáner</span>
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center w-1/5 py-2 transition-all duration-300 ${activeTab === 'settings' ? 'text-[#00FF00]' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <Settings strokeWidth={activeTab === 'settings' ? 2.5 : 2} size={22} className={activeTab === 'settings' ? 'scale-110 mb-1' : 'mb-1'} />
          <span className="text-[9px] font-bold uppercase tracking-widest">Ajustes</span>
        </button>
      </nav>
    </div>
  );
}

