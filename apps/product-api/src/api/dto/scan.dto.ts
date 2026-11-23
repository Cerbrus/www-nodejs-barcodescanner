import { IsBoolean, IsISO8601, IsOptional, IsString, Matches } from 'class-validator';

export class ScanDto {
    @IsString()
    @Matches(/^(\d{6,14}|R\d;[\x20-\x7e]{0,2000})$/)
    public code: string;

    @IsOptional()
    @IsISO8601()
    public scannedAt?: string;

    @IsOptional()
    @IsBoolean()
    public collecting?: boolean;
}
