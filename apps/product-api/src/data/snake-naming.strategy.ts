import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';

export function snakeCase(text: string): string {
    return text
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
        .toLowerCase();
}

export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
    public override tableName(className: string, customName?: string): string {
        return customName ?? snakeCase(className);
    }

    public override columnName(propertyName: string, customName: string | undefined, prefixes: Array<string>): string {
        return snakeCase([...prefixes, ''].join('_')) + (customName ?? snakeCase(propertyName));
    }

    public override relationName(propertyName: string): string {
        return snakeCase(propertyName);
    }

    public override joinColumnName(relationName: string, referencedColumnName: string): string {
        return snakeCase(`${relationName}_${referencedColumnName}`);
    }
}
