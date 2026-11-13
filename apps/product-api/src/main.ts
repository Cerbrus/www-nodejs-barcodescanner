import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { API_PREFIX, configureApi } from './api/configure-api';
import { AppModule } from './app.module';
import { AppConfig } from './config/app.config';
import { BufferedLogger } from './core/services/log.service';

const logger = new Logger('Main');
const COMMIT_LENGTH = 7;

async function bootstrap(): Promise<void> {
    const config = new AppConfig();
    const app = await NestFactory.create(AppModule, {
        cors: config.development,
        logger: new BufferedLogger(config.logFile)
    });

    configureApi(app);
    app.enableShutdownHooks();

    await app.listen(config.port);
    logger.log(`Listening on port ${config.port}, API under /${API_PREFIX}, version ${config.version} (${config.commit?.slice(0, COMMIT_LENGTH) ?? 'local'})`);
}

bootstrap();
