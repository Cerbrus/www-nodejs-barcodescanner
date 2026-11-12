import { Catch, HttpException, Logger } from '@nestjs/common';

import { BaseExceptionFilter } from './base-exception.filter';

@Catch(HttpException)
export class HttpExceptionFilter extends BaseExceptionFilter<HttpException> {
    public errorTitle(exception: HttpException): string {
        return typeof exception.getResponse() === 'object'
            ? (exception.getResponse() as { error: string })['error']
            : exception.name;
    }

    public errorMessage(exception: HttpException): string | Array<string> {
        if (typeof exception.getResponse !== 'function') return exception.message;
        const resp = exception.getResponse();
        if (typeof resp === 'string') return resp;
        if (typeof resp === 'object') {
            const message: unknown = (resp as unknown as { message: unknown })['message'];
            if (typeof message === 'string') return message;
            if (Array.isArray(message)) return message.join(', ');
        }
        Logger.error('Could not extract error message from HttpException', exception.stack, HttpExceptionFilter.name);
    }

    public statusCode(exception: HttpException): number {
        return exception.getStatus();
    }
}
