import { requestJson } from './httpClient';

type GeminiResult = {
  organization: string;
  complianceStatus: string;
  ruptures: string;
  observations: string;
};

type AnalyzeProductPhotoParams = {
  base64Image: string;
  industries: string[];
  visitId?: string | null;
  sectionId?: string;
};

export const analyzeProductPhoto = async ({ base64Image, industries, visitId, sectionId }: AnalyzeProductPhotoParams) => {
  try {
    return await requestJson<GeminiResult>('/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({ base64Image, industries, visitId, sectionId }),
    });
  } catch (error: any) {
    throw new Error('Erro na IA: ' + error.message);
  }
};
