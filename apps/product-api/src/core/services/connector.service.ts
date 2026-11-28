import { Injectable, Logger } from '@nestjs/common';

import { ProductSuggestion } from '@barcodescanner/shared';

import { AppConfig } from '../../config/app.config';
import { AHConnector } from '../connectors/ah.connector';
import { BarcodeHit, ProductConnector } from '../connectors/connector.model';
import { OpenFoodFactsConnector } from '../connectors/off.connector';
import { sectionForCategory } from '../rules/shop-sections';

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

    public async lookupAll(code: string, except?: string): Promise<LookupResult> {
        const asked = this.connectors.filter((connector) => connector.id !== except);
        const answers = await Promise.all(asked.map((connector) => this.lookup(connector, code)));

        return {
            suggestions: answers.flatMap((answer) => (answer.suggestion ? [answer.suggestion] : [])),
            failed: answers.flatMap((answer) => (answer.failed ? [answer.connectorId] : []))
        };
    }

    public async searchAll(words: string): Promise<Array<BarcodeHit>> {
        return (await Promise.all(this.connectors.map((connector) => this.search(connector, words)))).flat();
    }

    private async search(connector: ProductConnector, words: string): Promise<Array<BarcodeHit>> {
        try {
            return (await connector.search?.(words)) ?? [];
        } catch (error) {
            this.logger.warn(`Connector ${connector.id} failed to search for "${words}": ${error}`);

            return [];
        }
    }

    private async lookup(connector: ProductConnector, code: string): Promise<ConnectorAnswer> {
        try {
            const suggestion = await connector.lookup(code);
            const sectionId = sectionForCategory(suggestion?.category);

            return {
                connectorId: connector.id,
                suggestion: suggestion && sectionId ? { ...suggestion, sectionId } : suggestion
            };
        } catch (error) {
            this.logger.warn(`Connector ${connector.id} failed for ${code}: ${error}`);

            return { connectorId: connector.id, failed: true };
        }
    }
}
