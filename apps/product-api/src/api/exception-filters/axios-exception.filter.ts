import { Catch } from '@nestjs/common';

import { BaseExceptionFilter } from './base-exception.filter';
import { AxiosError } from 'axios';

@Catch(AxiosError)
export class AxiosExceptionFilter extends BaseExceptionFilter<AxiosError> {
    public errorTitle(error: AxiosError): string {
        return `${error.name}\n\tRequest path: ${error.response.config.url}`;
    }

    public errorMessage(exception: AxiosError): string | Array<string> {
        return exception.message;
    }

    public statusCode(exception: AxiosError): number {
        return exception.status;
    }
}
