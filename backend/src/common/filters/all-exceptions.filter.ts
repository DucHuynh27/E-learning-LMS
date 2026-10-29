import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Lỗi 5xx là bug phía server: log đầy đủ để trace, nhưng không lộ ra response.
    if (!isHttpException) {
      const error =
        exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(error.message, error.stack);
    }

    response.status(statusCode).json({
      statusCode,
      message: this.extractMessage(exception, isHttpException),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private extractMessage(
    exception: unknown,
    isHttpException: boolean,
  ): string | string[] {
    if (!isHttpException) return 'Internal server error';

    const body = (exception as HttpException).getResponse();
    if (typeof body === 'string') return body;
    if (typeof body === 'object' && body !== null && 'message' in body) {
      return (body as { message: string | string[] }).message;
    }
    return 'Error';
  }
}
