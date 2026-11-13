import { IsIn, IsString, MaxLength } from 'class-validator';

import { LogLevel } from '../../core/services/log.service';

export class LogLineDto {
    @IsIn(['debug', 'info', 'warning', 'error'])
    public level: LogLevel;

    @IsString()
    @MaxLength(500)
    public message: string;
}
