import { IsUUID } from 'class-validator';

export class PollRequestDto {
    @IsUUID()
    templateId!: string;
}
