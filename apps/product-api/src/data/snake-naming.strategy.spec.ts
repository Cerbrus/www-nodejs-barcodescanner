import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SnakeNamingStrategy, snakeCase } from './snake-naming.strategy';

describe('snake case names', () => {
    it('turns property names into the column names the migrations use', () => {
        assert.equal(snakeCase('catalogItemId'), 'catalog_item_id');
        assert.equal(snakeCase('lookupFailed'), 'lookup_failed');
        assert.equal(snakeCase('p256dh'), 'p256dh');
        assert.equal(snakeCase('CatalogItemEntity'), 'catalog_item_entity');
        assert.equal(snakeCase('HTTPStatus'), 'http_status');
    });

    it('keeps a chosen name and names join columns after the relation', () => {
        const naming = new SnakeNamingStrategy();
        assert.equal(naming.tableName('ListEntryEntity', 'list_entry'), 'list_entry');
        assert.equal(naming.columnName('updatedAt', undefined, []), 'updated_at');
        assert.equal(naming.columnName('code', 'barcode', []), 'barcode');
        assert.equal(naming.joinColumnName('catalogItem', 'id'), 'catalog_item_id');
    });
});
