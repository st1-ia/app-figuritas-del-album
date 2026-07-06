import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

let aiClient: GoogleGenAI | null = null;

function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not defined. Please add it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// API routes first!
app.post("/api/classify-sticker", async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { image } = req.body;
    if (!image) {
      res.status(400).json({ error: "No se proporcionó ninguna imagen para analizar." });
      return;
    }

    let mimeType = "image/jpeg";
    let base64Data = image;

    const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      mimeType = matches[1];
      base64Data = matches[2];
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            }
          },
          {
            text: `Analyze the sticker (figurita/cromo) from the Qatar 2022 World Cup album in this image.
Identify its country code/prefix and sticker number. Look for visual markers if the text is unclear.
Map it to one of these valid prefixes:
FWC, MEX, RSA, KOR, CZE, CAN, BIH, QAT, SUI, BRA, MAR, HAI, SCO, USA, PAR, AUS, TUR, GER, CUW, CIV, ECU, NED, JPN, SWE, TUN, BEL, EGY, IRN, NZL, ESP, CPV, KSA, URU, FRA, SEN, IRQ, NOR, ARG, ALG, AUT, JOR, POR, COD, UZB, COL, ENG, CRO, GHA, PAN, CC.
Note that the '00' double-zero sticker corresponds to id '00', prefix '00' and number 0. All other stickers are formatted as PREFIX-NUMBER (e.g. ARG-10, GER-1).
Return a JSON object conforming to the schema. If you are extremely uncertain (e.g., no sticker is in the picture), set confidence low.`
          }
        ]
      },
      config: {
        systemInstruction: "You are an advanced AI trained to recognize collectible stickers from the World Cup / Panini Qatar 2022 album. Return a structured JSON classification.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            id: { 
              type: Type.STRING, 
              description: "The official sticker ID, e.g. 'ARG-10' or '00' for FWC-0 or 'CC-1'." 
            },
            prefix: { 
              type: Type.STRING, 
              description: "The uppercase prefix, e.g. 'ARG' or 'FWC' or 'CC'. For the double-zero sticker, use '00'." 
            },
            number: { 
              type: Type.INTEGER, 
              description: "The sticker number (e.g. 10). For the '00' sticker, use 0." 
            },
            playerName: { 
              type: Type.STRING, 
              description: "The name of the player, stadium, mascot or shield shown on the sticker (e.g. 'Lionel Messi')." 
            },
            teamName: { 
              type: Type.STRING, 
              description: "The country or team name (e.g. 'Argentina')." 
            },
            confidence: { 
              type: Type.NUMBER, 
              description: "Confidence score between 0.0 and 1.0 indicating your certainty." 
            },
          },
          required: ["id", "prefix", "number"],
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No se pudo obtener una respuesta válida de la IA.");
    }

    const classification = JSON.parse(resultText.trim());
    res.json(classification);
  } catch (error: any) {
    console.error("Gemini classification failed:", error);
    res.status(500).json({ 
      error: "Error al analizar la figurita con IA.", 
      details: error.message || String(error) 
    });
  }
});

// Configure Vite or Static files serving
async function configureServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

configureServer();
