import { GoogleGenAI, Type } from "@google/genai";

export const analyzeProductPhoto = async (base64Image: string, industries: string[]) => {
  try {
    const apiKey = typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined;
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada nas variáveis de ambiente da Vercel.");

    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `Analise esta foto de gôndola para as marcas: ${industries.join(', ')}.
    Retorne um JSON: { "organization": "Bom/Ruim", "complianceStatus": "Conforme/Não Conforme", "ruptures": "Sim/Não", "observations": "texto" }`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [{ text: prompt }, { inlineData: { mimeType: "image/jpeg", data: base64Image } }]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            organization: { type: Type.STRING },
            complianceStatus: { type: Type.STRING },
            ruptures: { type: Type.STRING },
            observations: { type: Type.STRING }
          },
          required: ["organization", "complianceStatus", "ruptures", "observations"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Resposta vazia da IA");
    
    return JSON.parse(text);
  } catch (error: any) {
    throw new Error("Erro na IA: " + error.message);
  }
};
