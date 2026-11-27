import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

import { AppConfig } from '../../config/app.config';

const API_REVISION = '2026-05-20';
const TIMEOUT_MILLISECONDS = 25000;

interface Interaction {
    steps?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }>;
    usage?: { total_tokens?: number };
}

export interface Question {
    input: string;
    schema: object;
    readLinks: boolean;
}

export interface Answer {
    value: unknown;
    linkRead: boolean;
}

@Injectable()
export class GeminiService {
    private readonly logger = new Logger('Gemini');

    constructor(private readonly config: AppConfig) {}

    public get enabled(): boolean {
        return this.config.geminiApiKey !== '';
    }

    public async ask({ input, schema, readLinks }: Question): Promise<Answer> {
        if (!this.enabled) {
            throw new ServiceUnavailableException('The AI service is not set up');
        }

        const interaction = await this.post({
            model: this.config.geminiModel,
            input,
            response_format: { type: 'text', mime_type: 'application/json', schema },
            ...(readLinks ? { tools: [{ type: 'url_context' }] } : {})
        });
        const text = (interaction.steps ?? [])
            .filter((step) => step.type === 'model_output')
            .flatMap((step) => step.content ?? [])
            .map((block) => block.text ?? '')
            .join('');
        const linkRead = (interaction.steps ?? []).some((step) => step.type === 'url_context_result');
        this.logger.log(
            `${this.config.geminiModel} answered, ${interaction.usage?.total_tokens ?? '?'} tokens${readLinks ? `, link ${linkRead ? 'read' : 'not read'}` : ''}`
        );

        try {
            return { value: JSON.parse(text), linkRead };
        } catch {
            this.logger.warn('the answer was not JSON');
            throw new BadGatewayException('The AI service gave an answer that cannot be read');
        }
    }

    private async post(body: object): Promise<Interaction> {
        let answer: Response;
        try {
            answer = await fetch(`${this.config.geminiApiUrl}/interactions`, {
                method: 'POST',
                headers: {
                    'x-goog-api-key': this.config.geminiApiKey,
                    'Content-Type': 'application/json',
                    'Api-Revision': API_REVISION
                },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(TIMEOUT_MILLISECONDS)
            });
        } catch (error) {
            this.logger.warn(`could not be reached: ${error}`);
            throw new BadGatewayException('The AI service could not be reached');
        }
        if (!answer.ok) {
            this.logger.warn(`answered ${answer.status}`);
            throw new BadGatewayException(`The AI service answered ${answer.status}`);
        }

        return (await answer.json()) as Interaction;
    }
}
