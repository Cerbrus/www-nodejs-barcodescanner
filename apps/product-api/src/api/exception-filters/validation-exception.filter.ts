import { Catch, HttpStatus } from '@nestjs/common';

import { BaseExceptionFilter } from './base-exception.filter';
import { ValidationException } from '../../core/exceptions/validation.exception';

@Catch(ValidationException)
export class ValidationExceptionFilter extends BaseExceptionFilter<ValidationException> {
    public errorTitle(): string {
        return 'Bad Request';
    }

    public errorMessage(exception: ValidationException): string {
        return exception.message;
    }

    public statusCode(): number {
        return HttpStatus.BAD_REQUEST;
    }
}
