import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class PollVotesRequestDto {
    @IsUUID()
    optionId!: string;

    @IsNotEmpty()
    @IsString()
    voteId!: string;
}
