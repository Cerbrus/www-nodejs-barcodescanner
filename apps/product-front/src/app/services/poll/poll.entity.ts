import { fromUnixTime, getUnixTime } from 'date-fns';
import { PollDto, PollOptionDto } from '../api/dto';

export class PollEntity {
    public readonly id: string;
    public readonly creatorId?: string;
    public readonly question: string;
    public readonly template?: string;
    public readonly created: Date;
    public readonly modified: Date;
    public readonly status!: string;
    public readonly started?: Date;
    public readonly closed?: Date;
    public readonly options?: Array<PollOptionDto>;

    constructor(
        id: string,
        question: string,
        created: Date,
        modified: Date,
        status: string,
        template?: string,
        creatorId?: string,
        started?: Date,
        closed?: Date,
        options?: Array<PollOptionDto>,
    ) {
        this.id = id;
        this.question = question;
        this.template = template;
        this.created = created;
        this.modified = modified;
        this.status = status;
        this.creatorId = creatorId;
        this.started = started;
        this.closed = closed;
        this.options = options;
    }

    public toDto(): PollDto {
        return {
            id: this.id,
            question: this.question,
            templateReference: this.template,
            created: getUnixTime(this.created),
            modified: getUnixTime(this.modified),
            started: this.started ? getUnixTime(this.started) : undefined,
            status: this.status,
            closed: this.closed ? getUnixTime(this.closed) : undefined,
            creatorId: this.creatorId,
            options: this.options,
        };
    }

    public static fromDto(dto: PollDto): PollEntity {
        return new PollEntity(
            dto.id,
            dto.question,
            fromUnixTime(dto.created),
            fromUnixTime(dto.modified),
            dto.status,
            dto.templateReference,
            dto.creatorId,
            dto.started ? fromUnixTime(dto.started) : undefined,
            dto.closed ? fromUnixTime(dto.closed) : undefined,
            dto.options,
        );
    }
}
