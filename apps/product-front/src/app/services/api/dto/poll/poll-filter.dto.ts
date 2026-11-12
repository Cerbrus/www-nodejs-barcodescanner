import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class PollFilterDto {
    @IsNotEmpty()
    @IsOptional()
    status?: string;

    @IsUUID()
    @IsOptional()
    templateReference?: string;
}
