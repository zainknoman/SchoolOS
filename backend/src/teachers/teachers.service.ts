import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from '../common/student-access.service';

export interface TeacherSummary {
  id: string;
  name: string;
}

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll(actingUser: RequestUser): Promise<TeacherSummary[]> {
    let where: Prisma.TeacherWhereInput | undefined;
    if (actingUser.role !== 'SUPER_ADMIN') {
      const admin = await this.prisma.user.findUnique({ where: { id: actingUser.id } });
      if (!admin?.schoolId) {
        return [];
      }
      where = { campus: { schoolId: admin.schoolId } };
    }
    const teachers = await this.prisma.teacher.findMany({ where, orderBy: { name: 'asc' } });
    return teachers.map((t) => ({ id: t.id, name: t.name }));
  }
}
