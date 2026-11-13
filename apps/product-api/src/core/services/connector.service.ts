import { Injectable, Logger } from '@nestjs/common';

import { AppConfig } from '../../config/app.config';
import { AHConnector } from '../connectors/ah.connector';
import { ProductConnector, ProductSuggestion } from '../connectors/connector.model';
import { OpenFoodFactsConnector } from '../connectors/off.connector';

@Injectable()
export class ConnectorService {
    private readonly logger = new Logger(ConnectorService.name);
    private readonly connectors: Array<ProductConnector>;

    constructor(config: AppConfig, ah: AHConnector, openFoodFacts: OpenFoodFactsConnector) {
        this.connectors = [ah, openFoodFacts].filter((connector) => config.connectors.includes(connector.id));
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
