import { ValidationException } from '../exceptions';

type EnumValueType = string | number | symbol;
type EnumType = { [key in EnumValueType]: EnumValueType };

export class EnumValidator {
    static validate<E extends EnumType>(value: string | number | undefined, enumType: E): E[keyof E] | undefined {
        if (!value) return undefined;

        const validatedEnum = Object.values(enumType).find(
            (v) => value?.toString().toLowerCase() === v.toString().toLowerCase(),
        );
        if (!validatedEnum) {
            throw new ValidationException('Not a valid status!');
        }
        return validatedEnum as E[keyof E];
    }
}
