import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Use the exact Firebase configuration to operate Firestore on the server-side
  const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  let db: any;
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
    const firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
    console.log("Firebase initialized successfully on background server.");
  } catch (err) {
    console.error("Failed to initialize Firebase in server:", err);
  }

  // Define World Cup teams for validator parity
  const WORLD_CUP_TEAMS = [
    { prefix: 'FWC', count: 19, startNumber: 0 },
    { prefix: 'MEX', count: 20 },
    { prefix: 'RSA', count: 20 },
    { prefix: 'KOR', count: 20 },
    { prefix: 'CZE', count: 20 },
    { prefix: 'CAN', count: 20 },
    { prefix: 'BIH', count: 20 },
    { prefix: 'QAT', count: 20 },
    { prefix: 'SUI', count: 20 },
    { prefix: 'BRA', count: 20 },
    { prefix: 'MAR', count: 20 },
    { prefix: 'HAI', count: 20 },
    { prefix: 'SCO', count: 20 },
    { prefix: 'USA', count: 20 },
    { prefix: 'PAR', count: 20 },
    { prefix: 'AUS', count: 20 },
    { prefix: 'TUR', count: 20 },
    { prefix: 'GER', count: 20 },
    { prefix: 'CUW', count: 20 },
    { prefix: 'CIV', count: 20 },
    { prefix: 'ECU', count: 20 },
    { prefix: 'NED', count: 20 },
    { prefix: 'JPN', count: 20 },
    { prefix: 'SWE', count: 20 },
    { prefix: 'TUN', count: 20 },
    { prefix: 'BEL', count: 20 },
    { prefix: 'EGY', count: 20 },
    { prefix: 'IRN', count: 20 },
    { prefix: 'NZL', count: 20 },
    { prefix: 'ESP', count: 20 },
    { prefix: 'CPV', count: 20 },
    { prefix: 'KSA', count: 20 },
    { prefix: 'URU', count: 20 },
    { prefix: 'FRA', count: 20 },
    { prefix: 'SEN', count: 20 },
    { prefix: 'IRQ', count: 20 },
    { prefix: 'NOR', count: 20 },
    { prefix: 'ARG', count: 20 },
    { prefix: 'ALG', count: 20 },
    { prefix: 'AUT', count: 20 },
    { prefix: 'JOR', count: 20 },
    { prefix: 'POR', count: 20 },
    { prefix: 'COD', count: 20 },
    { prefix: 'UZB', count: 20 },
    { prefix: 'COL', count: 20 },
    { prefix: 'ENG', count: 20 },
    { prefix: 'CRO', count: 20 },
    { prefix: 'GHA', count: 20 },
    { prefix: 'PAN', count: 20 },
    { prefix: 'CC', count: 14 }
  ];

  const PREFIXES = WORLD_CUP_TEAMS.map(t => t.prefix);

  // Replicate exact client-side parsing function to guarantee perfect alignment
  function parseCodes(rawInput: string): string[] {
    const results: string[] = [];
    const upperInput = rawInput.toUpperCase();
    const prefixStr = PREFIXES.join('|');
    const regex = new RegExp(`(${prefixStr})\\s*[-_\\.]?\\s*([0-9OISBLZ]{1,2})`, 'gi');
    
    let match;
    while ((match = regex.exec(upperInput)) !== null) {
      const rawPrefix = match[1];
      const rawNumStr = match[2];
      
      const cleanNumStr = rawNumStr
        .replace(/O/g, '0')
        .replace(/Q/g, '0')
        .replace(/I/g, '1')
        .replace(/L/g, '1')
        .replace(/S/g, '5')
        .replace(/B/g, '8')
        .replace(/Z/g, '2')
        .replace(/[^0-9]/g, '');
        
      if (cleanNumStr.length > 0) {
        const num = parseInt(cleanNumStr, 10);
        const team = WORLD_CUP_TEAMS.find(t => t.prefix === rawPrefix);
        if (team) {
          const start = team.startNumber ?? 1;
          if (num >= start && num <= team.count) {
            const id = team.prefix === 'FWC' && num === 0 ? '00' : `${team.prefix}-${num}`;
            results.push(id);
          }
        }
      }
    }

    // Capture standalone double-zero
    const doubleZeroRegex = /(?:\b|[^A-Z0-9])(00|OO|0O|O0)(?:\b|[^A-Z0-9])/g;
    let dzMatch;
    while ((dzMatch = doubleZeroRegex.exec(upperInput)) !== null) {
      results.push('00');
    }

    // Return unique items
    return Array.from(new Set(results));
  }

  // API Route for background iOS Shortcut direct syncing
  app.get('/api/add-shortcut', async (req, res) => {
    try {
      const codesQuery = (req.query.add || req.query.codes || '') as string;
      if (!codesQuery.trim()) {
        return res.status(400).send("❌ No se ingresó ningún texto o código de figurita.");
      }

      const parsed = parseCodes(codesQuery);
      if (parsed.length === 0) {
        return res.status(400).send("⚠️ No se reconocieron códigos de figuritas. Intentá ej: 'ARG 10', 'GER 5' o 'FWC 00'.");
      }

      if (!db) {
        return res.status(500).send("❌ Error interno: Base de datos no inicializada en el servidor.");
      }

      // Read current state from Firestore
      const docRef = doc(db, 'albums', 'global');
      const docSnap = await getDoc(docRef);
      
      let ownedList: string[] = [];
      let repeatedList: string[] = [];
      let activities: any[] = [];

      if (docSnap.exists()) {
        const currentData = docSnap.data();
        ownedList = Array.isArray(currentData.ownedStickers) ? currentData.ownedStickers : [];
        repeatedList = Array.isArray(currentData.repeatedStickers) ? currentData.repeatedStickers : [];
        activities = Array.isArray(currentData.activities) ? currentData.activities : [];
      }

      const newlyAdded: string[] = [];
      const newlyRepeated: string[] = [];

      parsed.forEach((id) => {
        if (!ownedList.includes(id)) {
          ownedList.push(id);
          newlyAdded.push(id);
        } else {
          repeatedList.push(id);
          newlyRepeated.push(id);
        }
      });

      // Construct a beautiful summary activity log message
      const addedText = newlyAdded.length > 0 ? `Álbum: ${newlyAdded.join(', ')}` : '';
      const repeatedText = newlyRepeated.length > 0 ? `Repetidas: ${newlyRepeated.join(', ')}` : '';
      const joiner = addedText && repeatedText ? ' | ' : '';
      const actionText = `[Atajo de iOS] Se cargaron de fondo: ${addedText}${joiner}${repeatedText}`;

      const newActivity = {
        id: Date.now().toString() + Math.random(),
        text: actionText,
        timestamp: Date.now()
      };

      // Put latest activity at the beginning and cap at 50 records
      activities = [newActivity, ...activities].slice(0, 50);

      // Write directly to Firestore
      await setDoc(docRef, {
        ownedStickers: ownedList,
        repeatedStickers: repeatedList,
        activities,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Build text outcome that displays directly inside the iOS Shortcut pop-up
      let responseMessage = "✅ ¡Sincronizado con Éxito en Firestore!\n\n";
      if (newlyAdded.length > 0) {
        responseMessage += `📥 Al Álbum (${newlyAdded.length}): ${newlyAdded.join(', ')}\n`;
      }
      if (newlyRepeated.length > 0) {
        responseMessage += `🔁 Repetidas (${newlyRepeated.length}): ${newlyRepeated.join(', ')}\n`;
      }
      responseMessage += `\nTu álbum se actualizó al instante sin abrir la App.`;

      return res.status(200).send(responseMessage);

    } catch (err: any) {
      console.error("Error writing background stickers to Firestore:", err);
      return res.status(500).send(`❌ Error de sincronización: ${err.message || err}`);
    }
  });

  // Vite development vs production serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
