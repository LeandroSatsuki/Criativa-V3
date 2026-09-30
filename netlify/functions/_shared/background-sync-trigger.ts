const START_BACKGROUND_SYNC_HEADER = 'x-criativa-start-sync';

export const shouldStartBackgroundSync = (request: Request) =>
  request.headers.get(START_BACKGROUND_SYNC_HEADER)?.trim().toLowerCase() === 'background';

export const startBackgroundSync = async (request: Request, visitId: string) => {
  if (!shouldStartBackgroundSync(request)) return false;

  const authorization = request.headers.get('authorization');
  if (!authorization) return false;

  try {
    const url = new URL(`/api/sync/${encodeURIComponent(visitId)}/background`, request.url);
    const response = await fetch(url, {
      method: 'POST',
      headers: { authorization },
    });
    return response.ok;
  } catch (error) {
    console.error(JSON.stringify({
      event: 'visit_background_trigger_failed',
      visitId,
      errorType: error instanceof Error ? error.name : 'UnknownError',
    }));
    return false;
  }
};
