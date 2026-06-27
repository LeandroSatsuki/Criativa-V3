import type { Config, Context } from '@netlify/functions';
import { GoogleGenAI, Type } from '@google/genai';
import { authenticate } from './_shared/auth';
import { json } from './_shared/json';
import { getEnv } from './_shared/env';
import { getVisit, upsertVisit, updateVisit } from './_shared/visits';
import { getBrasiliaISO } from './_shared/time';

export default async (request: Request, _context: Context) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = authenticate(request);
  if (!auth) {
    return json({ error: 'Não autorizado' }, 401);
  }

  const apiKey = getEnv('BACKEND_GEMINI_API_KEY');
  if (!apiKey) {
    return json({ error: 'BACKEND_GEMINI_API_KEY não configurada.' }, 503);
  }

  const body = await request.json().catch(() => null) as {
    base64Image?: string;
    industries?: string[];
    visitId?: string;
    sectionId?: string;
  } | null;

  const base64Image = body?.base64Image || '';
  const industries = body?.industries || [];
  const visitId = body?.visitId?.trim() || '';
  const sectionId = (body?.sectionId || 'DEPOIS').trim() || 'DEPOIS';
  if (!base64Image) {
    return json({ error: 'Imagem não informada' }, 400);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Analise esta foto de gôndola para as marcas: ${industries.join(', ')}.
Retorne um JSON: { "organization": "Bom/Ruim", "complianceStatus": "Conforme/Não Conforme", "ruptures": "Sim/Não", "observations": "texto" }`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            organization: { type: Type.STRING },
            complianceStatus: { type: Type.STRING },
            ruptures: { type: Type.STRING },
            observations: { type: Type.STRING },
          },
          required: ['organization', 'complianceStatus', 'ruptures', 'observations'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      return json({ error: 'Resposta vazia da IA' }, 502);
    }

    const parsed = JSON.parse(text);

    if (visitId) {
      try {
        const existing = await getVisit(visitId);
        const aiResults = {
          ...(existing?.payload?.aiResults || {}),
          [sectionId]: parsed,
        };

        if (existing) {
          await updateVisit(visitId, {
            payload: {
              ...existing.payload,
              aiResults,
              updatedAt: getBrasiliaISO(),
            },
          });
        } else {
          await upsertVisit({
            visitId,
            aiResults,
            updatedAt: getBrasiliaISO(),
            user: {
              id: auth.sub,
              name: auth.name,
              role: auth.role,
              region: auth.region,
              user: auth.user,
            },
          });
        }
      } catch {
        // Best effort: never block the AI response because persistence failed.
      }
    }

    return json({
      ...parsed,
      visitId: visitId || null,
      sectionId,
      saved: Boolean(visitId),
    });
  } catch (error: any) {
    return json({ error: `Erro na IA: ${error.message}` }, 500);
  }
};

export const config: Config = {
  path: '/api/ai/analyze',
  method: ['POST'],
};
