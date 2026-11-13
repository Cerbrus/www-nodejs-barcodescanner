import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { ScannerState } from '../../core/services/agent-status.service';

export class AgentStatusDto {
    @IsIn(['connected', 'waiting'])
    public scanner: ScannerState;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    public device?: string;
}
