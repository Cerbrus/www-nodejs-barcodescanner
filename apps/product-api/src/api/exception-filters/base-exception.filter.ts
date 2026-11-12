import { ArgumentsHost, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { ExceptionHandler } from '@nestjs/core/errors/exception-handler';
import { Request, Response } from 'express';

export abstract class BaseExceptionFilter<TError extends Error> implements ExceptionFilter {
    public abstract statusCode(exception: TError): HttpStatus;

    public abstract errorTitle(exception: TError): string;

    public abstract errorMessage(exception: TError): string | Array<string>;

    public catch(exception: TError, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const errorMessage = this.errorMessage(exception);
        const statusCode = this.statusCode(exception);

        Logger.warn(`Error thrown on '${request.url}' - ${this.errorTitle(exception)}`, ExceptionHandler.name);
        Logger.warn(exception.stack, ExceptionHandler.name);

        response.status(statusCode).json({
            message: this.errorTitle(exception),
            error: Array.isArray(errorMessage) ? errorMessage : [errorMessage],
            statusCode,
        });
    }
}
