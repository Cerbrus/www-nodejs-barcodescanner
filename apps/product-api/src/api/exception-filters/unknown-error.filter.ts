import { Catch, HttpStatus } from '@nestjs/common';

import { BaseExceptionFilter } from './base-exception.filter';
import { MissingEntityException } from '../../core/exceptions/missing-entity.exception';

@Catch()
export class UnknownErrorFilter extends BaseExceptionFilter<Error> {
    public errorTitle(): string {
        return 'Internal Server Error';
    }

    public errorMessage(e: MissingEntityException): string {
        return e.message;
    }

    public statusCode(): HttpStatus {
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
}
