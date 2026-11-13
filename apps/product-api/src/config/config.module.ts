import { Global, Module } from '@nestjs/common';

import { AuthConfig } from './auth.config';

@Global()
@Module({
    providers: [AuthConfig],
    exports: [AuthConfig]
})
export class AppConfigModule {
}
