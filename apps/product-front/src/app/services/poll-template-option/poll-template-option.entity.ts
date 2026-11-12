import { fromUnixTime, getUnixTime } from 'date-fns';
import { PollTemplateOptionDto } from '../api/dto';

export class PollTemplateOptionEntity {
    public readonly id: string;
    public readonly created: Date;
    public readonly modified: Date;
    public value: string;
    public order?: number;

    constructor(id: string, created: Date, modified: Date, value: string, order?: number) {
        this.id = id;
        this.created = created;
        this.modified = modified;
        this.value = value;
        this.order = order;
    }

    public toDto(): PollTemplateOptionDto {
        return {
            id: this.id,
            created: getUnixTime(this.created),
            modified: getUnixTime(this.modified),
            value: this.value,
            order: this.order,
        };
    }

    public static fromDto(dto: PollTemplateOptionDto): PollTemplateOptionEntity {
        return new PollTemplateOptionEntity(
            dto.id,
            fromUnixTime(dto.created),
            fromUnixTime(dto.modified),
            dto.value,
            dto.order,
        );
    }
}
