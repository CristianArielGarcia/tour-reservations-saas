import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse() as Record<string, unknown>;

      // Pass through structured API errors created by our services
      if (response && typeof response === 'object' && 'error' in response) {
        return reply.status(status).send(response);
      }

      // NestJS validation errors
      const code = httpStatusToCode(status);
      const message =
        Array.isArray(response['message'])
          ? (response['message'] as string[]).join('; ')
          : String(response['message'] ?? exception.message);

      return reply.status(status).send({
        error: { code, message },
      } satisfies ApiError);
    }

    // Unexpected errors
    console.error(exception);
    return reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      error: {
        code: 'internal_error',
        message: 'An unexpected error occurred.',
      },
    } satisfies ApiError);
  }
}

function httpStatusToCode(status: number): string {
  switch (status) {
    case 400: return 'validation_error';
    case 401: return 'unauthenticated';
    case 403: return 'forbidden';
    case 404: return 'not_found';
    case 409: return 'conflict';
    case 422: return 'unprocessable';
    default:  return 'internal_error';
  }
}
