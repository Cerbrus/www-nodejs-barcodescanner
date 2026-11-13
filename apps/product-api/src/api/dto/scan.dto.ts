import { IsIn, IsString, Matches } from 'class-validator';

import { ScanSource } from '../../data/entities';

export class ScanDto {
    @IsString()
    @Matches(/^\d{6,14}$/)
    public code: string;

    @IsIn(['handheld', 'phone'])
    public source: ScanSource;
}
