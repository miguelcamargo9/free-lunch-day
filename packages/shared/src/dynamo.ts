import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  TransactionCanceledException,
  type DynamoDBClientConfig,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export function createDocumentClient(config: DynamoDBClientConfig = {}): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(new DynamoDBClient(config), {
    marshallOptions: { removeUndefinedValues: true },
  });
}

export function isConditionFailure(error: unknown): boolean {
  if (error instanceof ConditionalCheckFailedException) return true;
  return (
    error instanceof TransactionCanceledException &&
    (error.CancellationReasons ?? []).some((reason) => reason.Code === 'ConditionalCheckFailed')
  );
}
