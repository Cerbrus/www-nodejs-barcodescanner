import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class PushSubscriptionDto {
    @IsUrl({ protocols: ['https'], require_protocol: true })
    @MaxLength(1000)
    public endpoint: string;

    @IsString()
    @MaxLength(200)
    public p256dh: string;

    @IsString()
    @MaxLength(200)
    public auth: string;

    @IsOptional()
    @IsIn(['nl', 'en'])
    public language?: string;

    @IsOptional()
    @IsUrl({ protocols: ['https', 'http'], require_protocol: true, require_tld: false })
    @MaxLength(200)
    public origin?: string;
}

export class PushEndpointDto {
    @IsString()
    @MaxLength(1000)
    public endpoint: string;
}
