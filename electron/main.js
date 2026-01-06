import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { fileURLToPath } from "url";

/* ---------------------------------
   FIX __dirname FOR ES MODULES
---------------------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load .env from root (parent of electron folder)
const envPath = path.join(__dirname, "..", ".env");
dotenv.config({ path: envPath });

import fs from "fs";

// Fallback: Manually read .env if dotenv failed
if (!process.env.GOOGLE_API_KEY) {
  try {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      console.log("DEBUG: Manually reading .env content...");
      const match = envContent.match(/GOOGLE_API_KEY\s*=\s*([^\s]+)/);
      if (match && match[1]) {
        process.env.GOOGLE_API_KEY = match[1].trim();
        console.log("DEBUG: Manually extracted API Key.");
      }
    }
  } catch (err) {
    console.error("DEBUG: Failed to manually read .env", err);
  }
}

console.log("--------------------------------------------------");
console.log("DEBUG: Electron Main Process Started");
console.log("DEBUG: Loading .env from:", envPath);
console.log("DEBUG: GOOGLE_API_KEY present:", !!process.env.GOOGLE_API_KEY);
if (process.env.GOOGLE_API_KEY) {
  console.log("DEBUG: API Key length:", process.env.GOOGLE_API_KEY.length);
} else {
  console.error("❌ ERROR: GOOGLE_API_KEY is missing!");
}
console.log("--------------------------------------------------");



/* ---------------------------------
   JSON CLEANER
---------------------------------- */
function extractJSON(text) {
  if (!text) throw new Error("Empty Gemini response");

  let cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("No JSON object found");
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

/* ---------------------------------
   GEMINI CURVE GENERATOR
---------------------------------- */
async function generateCurveFromPrompt(prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `
You are a geometry API.
Return ONLY valid JSON.
No explanation.

Format:
{
  "anchors": [{ "x": number, "y": number, "z": number }],
  "controls": [
    {
      "cp1": { "x": number, "y": number, "z": number },
      "cp2": { "x": number, "y": number, "z": number }
    }
  ]
}

Prompt:
${prompt}
`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.4
        },
        safetySettings: [
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }
        ]
      })
    }
  );

  const data = await response.json();

  const candidate = data?.candidates?.[0];
  if (!candidate?.content?.parts) {
    console.error("❌ Gemini raw response:", data);
    throw new Error("No Gemini output");
  }

  // ✅ Combine ALL text parts safely
  const rawText = candidate.content.parts
    .map(p => p.text)
    .filter(Boolean)
    .join("\n");

  if (!rawText.trim()) {
    console.error("❌ Gemini returned empty text:", data);
    throw new Error("No Gemini output");
  }

  const curveJSON = extractJSON(rawText);

  console.log("🟢 AI CURVE JSON:");
  console.log(curveJSON);

  return curveJSON;
}

/* ---------------------------------
   IPC HANDLER
---------------------------------- */
ipcMain.handle("ai:generate-curve", async (_, prompt) => {
  try {
    return await generateCurveFromPrompt(prompt);
  } catch (err) {
    console.error("❌ AI ERROR:", err);
    throw err;
  }
});

/* ---------------------------------
   WINDOW
---------------------------------- */
function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL("http://localhost:5173"); // Vite dev
}

app.whenReady().then(createWindow);
