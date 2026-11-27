import { IsInt, Min } from 'class-validator';

export class DraftReplacementDto {
    @IsInt()
    @Min(1)
    public catalogItemId: number;
}
