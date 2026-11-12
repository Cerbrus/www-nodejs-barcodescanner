import { BaseException } from './base.exception';

export class ValidationException extends BaseException {
    public static validate(errorMessage: string, validationFn: () => boolean): void | never {
        if (validationFn()) {
            throw new ValidationException(errorMessage);
        }
    }
}
