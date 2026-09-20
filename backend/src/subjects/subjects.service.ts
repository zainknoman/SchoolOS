import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SubjectSummary {
  id: string;
  name: string;
}

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll(): Promise<SubjectSummary[]> {
    const subjects = await this.prisma.subject.findMany({
      orderBy: { name: 'asc' },
    });
    return subjects.map((s) => ({ id: s.id, name: s.name }));
  }
}
