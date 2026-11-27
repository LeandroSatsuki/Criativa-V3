export const cameraSections = ['FACHADA', 'ANTES', 'DEPOIS', 'ESTOQUE', 'TROCAS', 'CHECKOUT'] as const;
export const outcomes = ['saved', 'cancel', 'switched', 'denied', 'timeout', 'open_error', 'capture_error', 'write_error', 'interrupted'] as const;
export type Outcome = typeof outcomes[number];
export type CameraEvent = {
  id: string; at: number; section: string; mode: 'lite' | 'native'; build: string; opened: boolean; result: Outcome;
};
export const technicalFailure = (result: Outcome) => !['saved', 'cancel', 'switched', 'denied'].includes(result);
export const outcomeLabel: Record<Outcome, string> = {
  saved: 'Foto salva', cancel: 'Cancelada', switched: 'Trocou de câmera', denied: 'Permissão negada',
  timeout: 'Tempo de abertura esgotado', open_error: 'Falha ao abrir', capture_error: 'Falha na captura',
  write_error: 'Falha ao salvar', interrupted: 'Tentativa interrompida',
};
export type CameraRow = { owner: string; saved: number; attempts: number; failures: number; denied: number;
  cancelled: number; last: CameraEvent; liteBefore: number; lastLiteBefore: number; lastFailure: CameraEvent | null; alerts: string[] };
export type CameraReport = { asOf: number; rows: CameraRow[]; clusters: { build: string; result: Outcome; count: number }[] };
