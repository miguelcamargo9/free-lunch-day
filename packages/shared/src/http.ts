import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2 as HttpResult,
} from 'aws-lambda';
import { z } from 'zod';
import type { Logger } from './logger.js';

export type { HttpResult };

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export function jsonResponse(statusCode: number, body: unknown): HttpResult {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function parseJsonBody<TSchema extends z.ZodType>(
  event: APIGatewayProxyEventV2,
  schema: TSchema,
): z.infer<TSchema> {
  const body = event.isBase64Encoded
    ? Buffer.from(event.body ?? '', 'base64').toString('utf8')
    : event.body;
  let raw: unknown;
  try {
    raw = JSON.parse(body || '{}');
  } catch {
    throw new HttpError(400, 'Body must be valid JSON');
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw new HttpError(400, z.prettifyError(result.error));
  return result.data;
}

export function httpHandler(
  logger: Logger,
  handle: (event: APIGatewayProxyEventV2) => Promise<HttpResult>,
) {
  return async (event: APIGatewayProxyEventV2): Promise<HttpResult> => {
    try {
      return await handle(event);
    } catch (error) {
      if (error instanceof HttpError)
        return jsonResponse(error.statusCode, { message: error.message });
      logger.error('Unhandled HTTP error', { error: error as Error });
      return jsonResponse(500, { message: 'Internal error' });
    }
  };
}
