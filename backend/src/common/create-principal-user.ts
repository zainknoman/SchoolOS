import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { assertCreatable } from './prisma-create-guard';
import { normalizeIdentifier } from './normalize-identifier';

export class LoginProvisionDto {
  // Trimmed before validation so "   " / " ab " cannot pass @MinLength and then collapse to nothing.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  identifier!: string;
  @IsOptional() @IsString() @MinLength(8) password?: string;
}

export interface ProvisionedLogin {
  identifier: string;
  // Only set when the server generated the password; a caller-supplied one is never echoed.
  temporaryPassword: string | null;
}

export interface CreatePrincipalUserInput {
  identifier: string;
  password?: string;
  schoolId: string;
  campusId: string | null;
}

/**
 * The one place a principal login is created — called from SchoolService.create (campusId null →
 * school-wide admin) and CampusService.create (campusId set → campus principal), inside the
 * caller's own transaction so a duplicate identifier rolls the School/Campus back too.
 */
export async function createPrincipalUser(
  tx: Prisma.TransactionClient,
  input: CreatePrincipalUserInput,
): Promise<{ login: ProvisionedLogin; userId: string }> {
  // Stored in the same canonical form login() resolves, so what the operator types back matches.
  const identifier = normalizeIdentifier(input.identifier);
  const generated = input.password ? null : randomBytes(12).toString('base64url');
  const password = input.password ?? (generated as string);
  const passwordHash = await argon2.hash(password);
  let userId!: string;
  try {
    const user = await tx.user.create({
      data: {
        identifier,
        passwordHash,
        role: 'SCHOOL_ADMIN',
        isPrincipal: true,
        mustChangePassword: true,
        schoolId: input.schoolId,
        campusId: input.campusId,
      },
    });
    userId = user.id;
  } catch (error) {
    assertCreatable(error, 'This login identifier is already in use.');
  }
  return { login: { identifier, temporaryPassword: generated }, userId };
}
