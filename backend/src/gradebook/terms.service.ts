import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertCreatable } from '../common/prisma-create-guard';
import { assertDeletable } from '../common/prisma-delete-guard';
import { CreateTermDto } from './dto/create-term.dto';
import { UpdateTermDto } from './dto/update-term.dto';

export interface TermSummary {
  id: string;
  academicSessionId: string;
  label: string;
  order: number;
  startDate: string;
  endDate: string;
}

@Injectable()
export class TermsService {
  constructor(private readonly prisma: PrismaService) {}

  private toSummary(record: {
    id: string;
    academicSessionId: string;
    label: string;
    order: number;
    startDate: Date;
    endDate: Date;
  }): TermSummary {
    return {
      id: record.id,
      academicSessionId: record.academicSessionId,
      label: record.label,
      order: record.order,
      startDate: record.startDate.toISOString().slice(0, 10),
      endDate: record.endDate.toISOString().slice(0, 10),
    };
  }

  async create(dto: CreateTermDto): Promise<TermSummary> {
    let record;
    try {
      record = await this.prisma.term.create({
        data: {
          academicSessionId: dto.academicSessionId,
          label: dto.label,
          order: dto.order,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
        },
      });
    } catch (error) {
      assertCreatable(error, 'A term with this label already exists for this academic session.');
    }
    return this.toSummary(record);
  }

  async findMany(academicSessionId: string): Promise<TermSummary[]> {
    const records = await this.prisma.term.findMany({
      where: { academicSessionId },
      orderBy: { order: 'asc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  async update(id: string, dto: UpdateTermDto): Promise<TermSummary> {
    const existing = await this.prisma.term.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Term not found');
    }
    const record = await this.prisma.term.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
        ...(dto.startDate !== undefined ? { startDate: new Date(dto.startDate) } : {}),
        ...(dto.endDate !== undefined ? { endDate: new Date(dto.endDate) } : {}),
      },
    });
    return this.toSummary(record);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.term.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Term not found');
    }
    try {
      await this.prisma.term.delete({ where: { id } });
    } catch (error) {
      assertDeletable(error, 'Term');
    }
  }
}
