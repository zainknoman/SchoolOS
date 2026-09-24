import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AccountAccessController } from './account-access.controller';
import { AccountAccessService } from './account-access.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PasswordChangeGuard } from './guards/password-change.guard';
import { ACCESS_TOKEN_TTL } from './auth.constants';
import { resolveAccessTokenSecret } from './jwt-secret';
import { NotificationsModule } from '../notifications/notifications.module';

// Exported so its secret-resolution can be unit-tested without booting the whole Nest DI
// container. Takes a ConfigService (populated from .env by ConfigModule.forRoot() before any
// provider is instantiated) rather than reading `process.env` directly at import time — see the
// registerAsync call below for why that distinction matters here specifically.
export function jwtModuleFactory(config: ConfigService) {
  return {
    secret: resolveAccessTokenSecret(config),
    signOptions: { expiresIn: ACCESS_TOKEN_TTL },
  };
}

@Module({
  imports: [
    PassportModule,
    NotificationsModule,
    // registerAsync (not register()) is required: AppModule imports AuthModule before it calls
    // ConfigModule.forRoot(), so a plain `JwtModule.register({ secret: process.env.X })` would
    // evaluate `process.env.X` at import time — before .env is loaded — while JwtStrategy (a
    // provider, instantiated later in the DI lifecycle) sees the real value. That mismatch signs
    // tokens with the fallback secret but verifies them against the real one. registerAsync
    // defers evaluation to provider-instantiation time via ConfigService, same as JwtStrategy, so
    // both always agree.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: jwtModuleFactory,
    }),
  ],
  controllers: [AuthController, AccountAccessController],
  providers: [
    AuthService,
    AccountAccessService,
    JwtStrategy,
    // Every route is authenticated + role-checked by default (deny-by-default); only routes
    // explicitly marked with @Public() (e.g. login) skip JWT verification.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // After JwtAuthGuard: request.user.mustChangePassword is read fresh from the DB (BL-21).
    { provide: APP_GUARD, useClass: PasswordChangeGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
