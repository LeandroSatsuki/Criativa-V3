import type { GoogleAuth } from 'google-auth-library';
import type { PhotoBatchJob, VisitFinalizeJob } from './contracts.js';
import { deterministicTaskName } from './idempotency.js';

export type TaskPublisher = {
  publishPhotoBatch(job: PhotoBatchJob): Promise<void>;
  publishFinalize(job: VisitFinalizeJob): Promise<void>;
};

export class GoogleCloudTaskPublisher implements TaskPublisher {
  constructor(
    private readonly auth: GoogleAuth,
    private readonly projectId: string,
    private readonly location: string,
    private readonly queue: string,
    private readonly workerUrl: string,
    private readonly serviceAccountEmail: string,
  ) {}

  private async publish(kind: string, key: string, path: string, payload: unknown) {
    const parent = `projects/${this.projectId}/locations/${this.location}/queues/${this.queue}`;
    const taskName = `${parent}/tasks/${deterministicTaskName(kind, key)}`;
    const token = await this.auth.getAccessToken();
    const response = await fetch(`https://cloudtasks.googleapis.com/v2/${parent}/tasks`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        task: {
          name: taskName,
          dispatchDeadline: '300s',
          httpRequest: {
            httpMethod: 'POST',
            url: `${this.workerUrl.replace(/\/$/, '')}${path}`,
            headers: { 'Content-Type': 'application/json' },
            body: Buffer.from(JSON.stringify(payload)).toString('base64'),
            oidcToken: {
              serviceAccountEmail: this.serviceAccountEmail,
              audience: this.workerUrl,
            },
          },
        },
      }),
    });
    if (!response.ok && response.status !== 409) {
      throw new Error(`Falha ao enfileirar tarefa: HTTP ${response.status}`);
    }
  }

  publishPhotoBatch(job: PhotoBatchJob) {
    return this.publish('photo-batch', job.batchId, '/v1/worker/photo-batch', job);
  }

  publishFinalize(job: VisitFinalizeJob) {
    return this.publish('visit-finalize', job.idempotencyKey, '/v1/worker/finalize', job);
  }
}
