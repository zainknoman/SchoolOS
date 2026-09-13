// backend/src/student/create-student-with-enrollment.ts
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createParentWithUser, type CreateParentInput } from '../parent/create-parent-with-user';

export interface CreateStudentWithEnrollmentInput {
  grNumber: string;
  name: string;
  sectionId: string;
  campusId: string;
  academicSessionId: string;
  parentProfileId?: string;
  newParent?: CreateParentInput;
}

/**
 * The one place a Student + Enrollment (+ ParentProfile/User, if a new parent is supplied) are
 * created together — called from StudentService.create() (its own transaction) and from
 * AdmissionsService.approve() (its own transaction), so there is exactly one student-creation
 * code path, not two. Takes a Prisma transaction client, not PrismaService, so the caller controls
 * the transaction boundary — same shape as createParentWithUser.
 *
 * Input validation (the parentProfileId/newParent XOR check) and the section/academic-session
 * lookups are the caller's job, done with the caller's own PrismaService *before* opening the
 * transaction — that way a bad request never pays for starting one, and each caller resolves
 * academicSessionId the way that's correct for it (StudentService wants "whichever session is
 * currently active"; AdmissionsService.approve() wants the specific session the application
 * targeted, which need not be the currently-active one).
 */
export async function createStudentWithEnrollment(
  tx: Prisma.TransactionClient,
  input: CreateStudentWithEnrollmentInput,
  actingUserId: string,
): Promise<{ studentId: string }> {
  const hasExisting = input.parentProfileId != null;

  const student = await tx.student.create({ data: { grNumber: input.grNumber, name: input.name } });
  await tx.enrollment.create({
    data: {
      studentId: student.id,
      campusId: input.campusId,
      sectionId: input.sectionId,
      academicSessionId: input.academicSessionId,
      startDate: new Date(),
      status: 'ACTIVE',
    },
  });

  let parentProfileId: string;
  if (hasExisting) {
    const parent = await tx.parentProfile.findUnique({ where: { id: input.parentProfileId! } });
    if (!parent) {
      throw new BadRequestException('Parent not found');
    }
    parentProfileId = parent.id;
  } else {
    const newParent = await createParentWithUser(tx, input.newParent!);
    parentProfileId = newParent.id;
    await tx.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'parent.create',
        entity: 'ParentProfile',
        entityId: newParent.id,
        metadata: JSON.stringify({ identifier: input.newParent!.identifier, name: input.newParent!.name }),
      },
    });
  }
  await tx.studentParent.create({ data: { studentId: student.id, parentProfileId } });
  await tx.auditLog.create({
    data: {
      userId: actingUserId,
      action: 'student.create',
      entity: 'Student',
      entityId: student.id,
      metadata: JSON.stringify({ grNumber: input.grNumber, name: input.name, sectionId: input.sectionId }),
    },
  });

  return { studentId: student.id };
}
