import { BaseException } from './base.exception';

export class MissingEntityException extends BaseException {
    constructor(type: string, id: string) {
        super(`The object of type '${type}' could not be found with id: ${id}.`);
    }

    public static returnOrThrow<TEntity>(type: string, id: string): (entity: TEntity) => TEntity | never {
        return (entity: TEntity) => {
            if (entity === undefined || entity === null) {
                throw new MissingEntityException(type, id);
            }
            return entity;
        };
    }
}
