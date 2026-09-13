// backend/src/teacher/create-teacher-with-user.ts
import * as argon2 from 'argon2';
import { Prisma } from '@prisma/client';

export interface CreateTeacherWithUserInput {
  identifier: string;
  password: string;
  name: string;
  campusId: string;
}

export interface CreatedTeacher {
  id: string;
  name: string;
  identifier: string;
}

/**
 * The one place a Teacher's User + Teacher row are created together — called from
 * TeacherService.create() (its own transaction) and from the bulk-import Teachers path (its own
 * transaction) — mirrors createParentWithUser's and createStudentWithEnrollment's exact shape.
 */
export async function createTeacherWithUser(
  tx: Prisma.TransactionClient,
  input: CreateTeacherWithUserInput,
): Promise<CreatedTeacher> {
  const passwordHash = await argon2.hash(input.password);
  const user = await tx.user.create({
    data: { identifier: input.identifier, passwordHash, role: 'TEACHER' },
  });
  const teacher = await tx.teacher.create({
    data: { userId: user.id, name: input.name, campusId: input.campusId },
  });
  return { id: teacher.id, name: teacher.name, identifier: user.identifier };
}
