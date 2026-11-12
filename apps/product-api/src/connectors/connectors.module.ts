import { Injectable, Logger, Module } from '@nestjs/common';

import { AHConnector } from './ah.connector';
import { ProductConnector, ProductSuggestion } from './connector.model';
import { OpenFoodFactsConnector } from './off.connector';

const DEFAULT_CONNECTORS = 'ah,off';

@Injectable()
export class ConnectorService {
    private readonly logger = new Logger(ConnectorService.name);
    private readonly connectors: Array<ProductConnector>;

    constructor(ah: AHConnector, openFoodFacts: OpenFoodFactsConnector) {
        const enabled = (process.env['CONNECTORS'] ?? DEFAULT_CONNECTORS).split(',').map((id) => id.trim());
        this.connectors = [ah, openFoodFacts].filter((connector) => enabled.includes(connector.id));
    }

    public async lookupAll(code: string): Promise<Array<ProductSuggestion>> {
        const results = await Promise.all(this.connectors.map((connector) => this.lookup(connector, code)));
        return results.filter((suggestion): suggestion is ProductSuggestion => suggestion !== undefined);
    }

    private async lookup(connector: ProductConnector, code: string): Promise<ProductSuggestion | undefined> {
        try {
            return await connector.lookup(code);
        } catch (error) {
            this.logger.warn(`Connector ${connector.id} failed for ${code}: ${error}`);
            return undefined;
        }
    }
}

@Module({
    providers: [AHConnector, OpenFoodFactsConnector, ConnectorService],
    exports: [ConnectorService]
})
export class ConnectorsModule {
}
