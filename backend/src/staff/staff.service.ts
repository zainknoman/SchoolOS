import { Injectable } from '@nestjs/common';
import { EmployeeType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from '../common/student-access.service';

export interface StaffSummary {
  id: string;
  name: string;
  employeeType: EmployeeType;
  employmentStatus: string;
  campusName: string;
}

const WITH_CAMPUS = { campus: { select: { name: true } } } as const;

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  private toSummary(record: {
    id: string; name: string; employeeType: EmployeeType; employmentStatus: string;
    campus: { name: string };
  }): StaffSummary {
    return {
      id: record.id,
      name: record.name,
      employeeType: record.employeeType,
      employmentStatus: record.employmentStatus,
      campusName: record.campus.name,
    };
  }

  async list(actingUser: RequestUser, employeeType?: EmployeeType): Promise<StaffSummary[]> {
    let where: Prisma.StaffWhereInput | undefined = employeeType ? { employeeType } : undefined;
    if (actingUser.role !== 'SUPER_ADMIN') {
      const admin = await this.prisma.user.findUnique({ where: { id: actingUser.id } });
      if (!admin?.schoolId) {
        return [];
      }
      where = { ...where, campus: { schoolId: admin.schoolId } };
    }
    const records = await this.prisma.staff.findMany({
      where,
      include: WITH_CAMPUS,
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toSummary(r));
  }
}