import { PollVoteDto } from './poll-vote.dto';

export class PollOptionDto {
    id!: string;
    value!: string;
    created?: number;
    modified?: number;
    votes?: Array<PollVoteDto>;
}
