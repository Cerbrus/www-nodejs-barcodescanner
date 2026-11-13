import { IsISO8601, IsOptional, IsString, Matches } from 'class-validator';

export class ScanDto {
    @IsString()
    @Matches(/^\d{6,14}$/)
    public code: string;

    @IsOptional()
    @IsISO8601()
    public scannedAt?: string;
}
