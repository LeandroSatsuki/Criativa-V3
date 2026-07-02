import { getEnv } from './env';
import { buildTransformedPayloads, saveVisit, type VisitRecord } from './visits';
import { getBrasiliaISO } from './time';

export type SyncResult = {
  visitId: string;
  syncStatus: VisitRecord['syncStatus'];
  syncError?: string | null;
};

export const syncVisitRecord = async (visit: VisitRecord): Promise<SyncResult> => {
  const webhookUrl = getEnv('BACKEND_MAKE_WEBHOOK_URL');
  if (!webhookUrl) {
    const errored = await saveVisit({
      ...visit,
      syncStatus: 'erro',
      syncError: 'BACKEND_MAKE_WEBHOOK_URL não configurada.',
      updatedAt: getBrasiliaISO(),
    });

    return {
      visitId: errored.visitId,
      syncStatus: errored.syncStatus,
      syncError: errored.syncError,
    };
  }

  const sending = await saveVisit({
    ...visit,
    syncStatus: 'enviando',
    syncError: null,
    updatedAt: getBrasiliaISO(),
  });

  try {
    const transformedPayloads = buildTransformedPayloads(sending.payload);
    const makeResponses: Array<{ status: number; ok: boolean; body: string }> = [];

    for (const transformedPayload of transformedPayloads) {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transformedPayload),
      });
      const responseText = await response.text().catch(() => '');
      const responseBody = responseText.slice(0, 1000);
      makeResponses.push({ status: response.status, ok: response.ok, body: responseBody });

      if (!response.ok) {
        const syncError = `Make retornou HTTP ${response.status}: ${responseBody || response.statusText}`;
        const errored = await saveVisit({
          ...sending,
          syncStatus: 'erro',
          syncError,
          makeResponse: { status: response.status, ok: false, body: responseBody },
          updatedAt: getBrasiliaISO(),
        });

        return {
          visitId: errored.visitId,
          syncStatus: errored.syncStatus,
          syncError: errored.syncError,
        };
      }
    }

    const sent = await saveVisit({
      ...sending,
      syncStatus: 'enviado',
      syncError: null,
      makeResponse: {
        status: makeResponses[makeResponses.length - 1]?.status || 200,
        ok: true,
        body: JSON.stringify(makeResponses).slice(0, 1000),
      },
      updatedAt: getBrasiliaISO(),
    });

    return {
      visitId: sent.visitId,
      syncStatus: sent.syncStatus,
      syncError: sent.syncError || null,
    };
  } catch (error: any) {
    const errored = await saveVisit({
      ...sending,
      syncStatus: 'erro',
      syncError: error.message || 'Falha na sincronização',
      updatedAt: getBrasiliaISO(),
    });

    return {
      visitId: errored.visitId,
      syncStatus: errored.syncStatus,
      syncError: errored.syncError,
    };
  }
};
