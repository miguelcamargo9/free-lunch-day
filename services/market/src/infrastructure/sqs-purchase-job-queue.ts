import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import type { PurchaseJobQueue } from '../application/ports.js';
import type { PurchaseJob } from '../domain/purchase.js';

export class SqsPurchaseJobQueue implements PurchaseJobQueue {
  constructor(
    private readonly queueUrl: string,
    private readonly client: SQSClient = new SQSClient({}),
  ) {}

  async enqueue(job: PurchaseJob, delaySeconds: number): Promise<void> {
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(job),
        DelaySeconds: delaySeconds,
      }),
    );
  }
}
