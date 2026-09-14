import { Prisma, EmployeeType } from '@prisma/client';
import { createTeacherWithUser } from '../teacher/create-teacher-with-user';

export interface CreateStaffInput {
  name: string;
  employeeType: EmployeeType;
  campusId: string;
  dateOfBirth?: string;
  cnic?: string;
  mobile?: string;
  email?: string;
  joiningDate?: string;
  login?: { identifier: string; password: string };
}

export interface CreatedStaff {
  id: string;
  name: string;
}

/**
 * The one place a Staff row (+ linked Teacher + User, for employeeType TEACHER) is created —
 * called from HiringApplicationsService.approve() inside its own transaction. Mirrors
 * createStudentWithEnrollment's/createTeacherWithUser's shape: takes a transaction client, not
 * PrismaService, so the caller controls the transaction boundary.
 *
 * Scope cut (docs/database/data-model-design.md, Sub-project 3): only TEACHER hires get a
 * linked User/login. `login` is ignored for every other employeeType.
 */
export async function createStaffWithOptionalTeacher(
  tx: Prisma.TransactionClient,
  input: CreateStaffInput,
): Promise<CreatedStaff> {
  let userId: string | undefined;
  let teacherId: string | undefined;

  if (input.employeeType === 'TEACHER') {
    if (!input.login) {
      // The caller (HiringApplicationsService.approve()) already validates this before opening
      // the transaction — this is a defensive invariant, not user-facing validation.
      throw new Error('login is required when employeeType is TEACHER');
    }
    const teacher = await createTeacherWithUser(tx, {
      identifier: input.login.identifier,
      password: input.login.password,
      name: input.name,
      campusId: input.campusId,
    });
    teacherId = teacher.id;
    const teacherRow = await tx.teacher.findUniqueOrThrow({ where: { id: teacher.id } });
    userId = teacherRow.userId;
  }

  const staff = await tx.staff.create({
    data: {
      name: input.name,
      employeeType: input.employeeType,
      campusId: input.campusId,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
      cnic: input.cnic,
      mobile: input.mobile,
      email: input.email,
      joiningDate: input.joiningDate ? new Date(input.joiningDate) : undefined,
      userId,
      teacherId,
    },
  });

  return { id: staff.id, name: staff.name };
}