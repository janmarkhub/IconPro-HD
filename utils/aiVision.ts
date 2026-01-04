
import { GoogleGenAI, Type } from "@google/genai";
import { PersonBio, GeneratedPackItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getPackRecommendations(source: string): Promise<string[]> {
  const seed = Math.floor(Math.random() * 100000);
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Suggest 5 diverse sub-categories or specific entities related to "${source}" for an icon pack. Seed: ${seed}. Return as a JSON array of strings only.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });
  return JSON.parse(response.text || '[]');
}

export async function getSubThemes(parentTheme: string): Promise<string[]> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `The parent theme is "${parentTheme}". Provide 4 contrasting sub-themes for a desktop icon set. Return as a JSON array of 4 strings.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });
  return JSON.parse(response.text || '[]');
}

export async function getPersonProfile(name: string): Promise<PersonBio | null> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Provide a personality profile for "${name}" (could be fictional or real). Focus on their "known for" (one sentence) and their likely desktop "vibe" (colors, aesthetic). If you cannot find information for this person, return NULL.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          knownFor: { type: Type.STRING },
          vibe: { type: Type.STRING },
          wallpaperColors: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["name", "knownFor", "vibe", "wallpaperColors"]
      }
    }
  });
  const text = response.text;
  if (!text || text.toUpperCase().includes('NULL')) return null;
  return JSON.parse(text);
}

export async function generatePackPrompts(source: string, category: string, style: string): Promise<{ items: GeneratedPackItem[], masterPrompt: string }> {
  const groundingResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Describe the visual archetypes for "${source}" (${category}). Specifically, what objects would perfectly represent 'My PC', 'Recycle Bin', and 'Network' in this universe? Ensure you note the difference between an empty and full recycle bin.`,
    config: {
      tools: [{googleSearch: {}}],
    },
  });
  
  const groundedContext = groundingResponse.text;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Create a professional 5x2 sprite sheet of 10 icons for "${source}" (${category}) in "${style}" style.
    
    Context: ${groundedContext}
    
    The icons MUST follow this exact 5-column, 2-row layout:
    Row 1: 1. Recycle Bin (EMPTY version), 2. Recycle Bin (FULL version - overflowing with junk), 3. Start Button Logo (Hero visual), 4. My Computer/PC, 5. Control Panel/Settings.
    Row 2: 6. Network/Globe, 7. User/Identity, 8. Folder/Stash, 9. ${category} Special Item 1, 10. ${category} Special Item 2.
    
    MASTERPROMPT REQUIREMENTS:
    - Background: SOLID PURE WHITE #FFFFFF (Critical for extraction).
    - Consistency: All 10 icons must share the same materials, lighting, and art style.
    - Spacing: Massive white gaps between icons. No elements should touch or overlap.
    - Sizing: Each icon must be chunky, centered, and high-fidelity. No thin lines.
    - States: Icon 1 and 2 MUST be versions of the same container (one empty, one full).
    
    Return as JSON: { "items": [{ "label": "..." }], "masterPrompt": "..." }`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING }
              }
            }
          },
          masterPrompt: { type: Type.STRING }
        },
        required: ["items", "masterPrompt"]
      }
    }
  });
  return JSON.parse(response.text || '{"items": [], "masterPrompt": ""}');
}

export async function generateIconGrid(masterPrompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: `A 5x2 grid of 10 professional high-res app icons. 
        MANDATORY: Background is PURE FLAT SOLID #FFFFFF WHITE. 
        THEME: ${masterPrompt}. 
        Each icon is perfectly centered in its own 1/10th zone with massive white margins. 
        Style must be high-end digital illustration, chunky and legible.` }
      ]
    },
    config: { imageConfig: { aspectRatio: "1:1" } }
  });

  for (const part of response.candidates?.[0].content.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  throw new Error("Grid generation failed");
}

export async function generateIconImage(prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: `A single high-fidelity centered app icon: ${prompt}. 
        MANDATORY: BACKGROUND IS SOLID FLAT #FFFFFF WHITE. 
        The icon is centered with generous white padding. Bold shapes, no thin lines.` }
      ]
    },
    config: { imageConfig: { aspectRatio: "1:1" } }
  });

  for (const part of response.candidates?.[0].content.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  throw new Error("Icon generation failed");
}
