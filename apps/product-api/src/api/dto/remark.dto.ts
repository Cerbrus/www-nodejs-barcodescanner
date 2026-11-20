import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

import { MAX_REMARK_TEXT_LENGTH, REMARK_KINDS, REMARK_STATES, RemarkKind, RemarkState } from '../../core/rules/remarks';

export class RemarkCreateDto {
    @IsIn(REMARK_KINDS)
    public kind: RemarkKind;

    @IsString()
    @IsNotEmpty()
    @MaxLength(MAX_REMARK_TEXT_LENGTH)
    public text: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    public page?: string;

    @IsOptional()
    @IsObject()
    public target?: Record<string, unknown>;

    @IsOptional()
    @IsObject()
    public context?: Record<string, unknown>;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    public writtenAt?: Date;
}

export class RemarkTextDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(MAX_REMARK_TEXT_LENGTH)
    public text: string;
}

export class RemarkStateDto {
    @IsIn(REMARK_STATES)
    public state: RemarkState;
}

export class RemarkIssueDto {
    @IsOptional()
    @IsBoolean()
    public includeDevice?: boolean;

    @IsOptional()
    @IsBoolean()
    public includeAccount?: boolean;

    @IsOptional()
    @IsBoolean()
    public investigate?: boolean;
}
