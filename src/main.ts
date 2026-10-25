import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { validationPipe } from './common/pipes/validation.pipe.js';

const logger = new Logger('App');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('PORT');

  app.enableShutdownHooks();
  app.useGlobalPipes(validationPipe);

  await app.listen(port);
  logger.log(`Listening on :${port}`);
}
await bootstrap();
