import { Catch, HttpException, HttpStatus } from '@nestjs/common';

import { BaseExceptionFilter } from './base-exception.filter';
import { MissingEntityException } from '../../core/exceptions/missing-entity.exception';

@Catch(MissingEntityException)
export class MissingEntityExceptionFilter extends BaseExceptionFilter<HttpException> {
    public errorTitle(): string {
        return 'Not Found';
    }

    public errorMessage(e: MissingEntityException): string {
        return e.message;
    }

    public statusCode(): number {
        return HttpStatus.NOT_FOUND;
    }
}
