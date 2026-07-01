import { getEnv } from './env';
import { buildTransformedPayload, saveVisit, type VisitRecord } from './visits';
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
    const transformedPayload = buildTransformedPayload(sending.payload);
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transformedPayload),
    });
    const responseText = await response.text().catch(() => '');
    const responseBody = responseText.slice(0, 1000);

    if (!response.ok) {
      const errored = await saveVisit({
        ...sending,
        syncStatus: 'erro',
        syncError: responseBody || response.statusText,
        makeResponse: { status: response.status, ok: false, body: responseBody },
        updatedAt: getBrasiliaISO(),
      });

      return {
        visitId: errored.visitId,
        syncStatus: errored.syncStatus,
        syncError: errored.syncError,
      };
    }

    const sent = await saveVisit({
      ...sending,
      syncStatus: 'enviado',
      syncError: null,
      makeResponse: { status: response.status, ok: true, body: responseBody },
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
