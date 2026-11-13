import { Injectable, Logger } from '@nestjs/common';

import { AppConfig } from '../../config/app.config';
import { AHConnector } from '../connectors/ah.connector';
import { ProductConnector, ProductSuggestion } from '../connectors/connector.model';
import { OpenFoodFactsConnector } from '../connectors/off.connector';

export interface LookupResult {
    suggestions: Array<ProductSuggestion>;
    failed: Array<string>;
}

interface ConnectorAnswer {
    connectorId: string;
    suggestion?: ProductSuggestion;
    failed?: boolean;
}

@Injectable()
export class ConnectorService {
    private readonly logger = new Logger(ConnectorService.name);
    private connectors: Array<ProductConnector>;

    constructor(config: AppConfig, ah: AHConnector, openFoodFacts: OpenFoodFactsConnector) {
        this.connectors = [ah, openFoodFacts].filter((connector) => config.connectors.includes(connector.id));
    }

    public async lookupAll(code: string): Promise<LookupResult> {
        const answers = await Promise.all(this.connectors.map((connector) => this.lookup(connector, code)));

        return {
            suggestions: answers.flatMap((answer) => (answer.suggestion ? [answer.suggestion] : [])),
            failed: answers.flatMap((answer) => (answer.failed ? [answer.connectorId] : []))
        };
    }

    private async lookup(connector: ProductConnector, code: string): Promise<ConnectorAnswer> {
        try {
            return { connectorId: connector.id, suggestion: await connector.lookup(code) };
        } catch (error) {
            this.logger.warn(`Connector ${connector.id} failed for ${code}: ${error}`);

            return { connectorId: connector.id, failed: true };
        }
    }
}
