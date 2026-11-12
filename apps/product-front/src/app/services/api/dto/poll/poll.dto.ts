import { PollOptionDto } from './poll-option.dto';

export class PollDto {
    id!: string;
    creatorId?: string;
    question!: string;
    templateReference?: string;
    created!: number;
    modified!: number;
    status!: string;
    started?: number;
    closed?: number;
    options?: Array<PollOptionDto>;
}
