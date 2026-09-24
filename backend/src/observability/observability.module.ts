import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { HealthController } from './health.controller';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { ERROR_REPORTER, createErrorReporter } from './error-reporter';

/** BL-11: health endpoints, the global exception filter and the error reporter. */
@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: ERROR_REPORTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createErrorReporter((k) => config.get<string>(k)),
    },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
  exports: [ERROR_REPORTER],
})
export class ObservabilityModule {}
