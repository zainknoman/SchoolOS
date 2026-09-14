import { Injectable } from '@nestjs/common';
import { EmployeeType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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

  async list(employeeType?: EmployeeType): Promise<StaffSummary[]> {
    const records = await this.prisma.staff.findMany({
      where: employeeType ? { employeeType } : undefined,
      include: WITH_CAMPUS,
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toSummary(r));
  }
}