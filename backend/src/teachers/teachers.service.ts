import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TeacherSummary {
  id: string;
  name: string;
}

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll(): Promise<TeacherSummary[]> {
    const teachers = await this.prisma.teacher.findMany({ orderBy: { name: 'asc' } });
    return teachers.map((t) => ({ id: t.id, name: t.name }));
  }
}
