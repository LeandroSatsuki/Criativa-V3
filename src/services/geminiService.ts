import { requestJson } from './httpClient';

type GeminiResult = {
  organization: string;
  complianceStatus: string;
  ruptures: string;
  observations: string;
};

export const analyzeProductPhoto = async (base64Image: string, industries: string[]) => {
  try {
    return await requestJson<GeminiResult>('/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({ base64Image, industries }),
    });
  } catch (error: any) {
    throw new Error('Erro na IA: ' + error.message);
  }
};
