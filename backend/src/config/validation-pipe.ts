import {
  ArgumentMetadata,
  Logger,
  ValidationPipe,
  type ValidationPipeOptions,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';

const PRIMITIVES = new Set<unknown>([String, Boolean, Number, Array, Object]);

/** Dotted paths of the properties class-validator would strip as unknown. */
function unknownPaths(errors: ValidationError[], prefix = ''): string[] {
  return errors.flatMap((e) => {
    const path = prefix ? `${prefix}.${e.property}` : e.property;
    const own = e.constraints?.whitelistValidation ? [path] : [];
    return [...own, ...unknownPaths(e.children ?? [], path)];
  });
}

/**
 * KI-10: the global pipe still strips request fields a DTO does not declare (`whitelist`, which
 * also guards against mass assignment), but now logs the field names — never their values — so a
 * client sending a misspelt or obsolete field is visible instead of silently ignored.
 */
export class ReportingValidationPipe extends ValidationPipe {
  private readonly logger = new Logger('RequestValidation');

  constructor(options: ValidationPipeOptions = {}) {
    super({ whitelist: true, transform: true, ...options });
  }

  async transform(
    value: unknown,
    metadata: ArgumentMetadata,
  ): Promise<unknown> {
    const { metatype } = metadata;
    if (
      metatype &&
      !PRIMITIVES.has(metatype) &&
      value !== null &&
      typeof value === 'object'
    ) {
      const probe = plainToInstance(
        metatype as new () => object,
        structuredClone(value),
      );
      const errors = await validate(probe, {
        whitelist: true,
        forbidNonWhitelisted: true,
        skipMissingProperties: true,
      });
      const paths = unknownPaths(errors);
      if (paths.length > 0) {
        this.logger.warn(
          `${metatype.name} ${metadata.type}: ignored unknown field(s) ${paths.join(', ')}`,
        );
      }
    }
    return super.transform(value, metadata);
  }
}
