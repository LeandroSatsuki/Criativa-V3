import { getEnv } from './env';
import { buildTransformedPayloads, saveVisit, type VisitRecord } from './visits';
import { getBrasiliaISO } from './time';
import { syncVisitRecordV2 } from './make-sync-v2';

export type SyncResult = {
  visitId: string;
  syncStatus: VisitRecord['syncStatus'];
  syncError?: string | null;
  progress?: {
    sent: number;
    total: number;
  };
};

export const syncVisitRecord = async (visit: VisitRecord): Promise<SyncResult> => {
  const syncMode = (getEnv('BACKEND_MAKE_SYNC_MODE') || 'legacy').trim().toLowerCase();
  const webhookVariable = syncMode === 'visit-v2'
    ? 'BACKEND_MAKE_WEBHOOK_V2_URL'
    : 'BACKEND_MAKE_WEBHOOK_URL';
  const webhookUrl = getEnv(webhookVariable);
  if (!webhookUrl) {
    const errored = await saveVisit({
      ...visit,
      syncStatus: 'erro',
      syncError: `${webhookVariable} não configurada.`,
      updatedAt: getBrasiliaISO(),
    });

    return {
      visitId: errored.visitId,
      syncStatus: errored.syncStatus,
      syncError: errored.syncError,
    };
  }

  if (syncMode === 'visit-v2') {
    return syncVisitRecordV2(visit, webhookUrl);
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
