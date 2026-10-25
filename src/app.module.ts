import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { CoreModule } from './modules/core/core.module.js';
import { ApiKeyGuard } from './common/guards/api-key.guard.js';
import { ApiErrorLoggingFilter } from './common/filters/api-error-logging.filter.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), CoreModule],
  controllers: [AppController],
  providers: [
    { provide: APP_FILTER, useClass: ApiErrorLoggingFilter },
    { provide: APP_GUARD, useClass: ApiKeyGuard },
  ],
})
export class AppModule {}
