type RemoteStatus = { syncStatus: string; syncError?: string | null };
type AutomaticTransport = {
  status: (visitId: string) => Promise<RemoteStatus>;
  create: (payload: any) => Promise<{ visitId?: string; syncStarted?: boolean }>;
  start: (visitId: string) => Promise<unknown>;
};

export const submitAutomaticVisit = async (
  visitId: string,
  payload: any,
  transport: AutomaticTransport,
): Promise<'sent' | 'syncing'> => {
  let remote: RemoteStatus | null = null;
  try {
    remote = await transport.status(visitId);
  } catch (error: any) {
    if (error?.status !== 404) throw error;
  }
  if (remote?.syncStatus === 'enviado') return 'sent';
  if (remote?.syncStatus === 'erro') throw new Error(remote.syncError || 'O envio precisa de uma nova tentativa.');
  if (remote?.syncStatus === 'enviando') return 'syncing';
  if (!remote) {
    const created = await transport.create({ ...payload, visitId });
    if (created.visitId && created.visitId !== visitId) throw new Error('O servidor retornou outro identificador de visita.');
    if (created.syncStarted) return 'syncing';
  }
  await transport.start(visitId);
  return 'syncing';
};
