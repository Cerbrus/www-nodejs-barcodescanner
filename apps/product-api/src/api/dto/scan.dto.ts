import { IsString, Matches } from 'class-validator';

export class ScanDto {
    @IsString()
    @Matches(/^\d{6,14}$/)
    public code: string;
}
