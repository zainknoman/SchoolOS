import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';

export interface HolidaySummary {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  campusId: string | null;
}

@Injectable()
export class HolidaysService {
  constructor(private readonly prisma: PrismaService) {}

  private toSummary(record: {
    id: string;
    title: string;
    startDate: Date;
    endDate: Date;
    campusId: string | null;
  }): HolidaySummary {
    return {
      id: record.id,
      title: record.title,
      startDate: record.startDate.toISOString().slice(0, 10),
      endDate: record.endDate.toISOString().slice(0, 10),
      campusId: record.campusId,
    };
  }

  async create(dto: CreateHolidayDto): Promise<HolidaySummary> {
    const record = await this.prisma.holiday.create({
      data: {
        title: dto.title,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        campusId: dto.campusId ?? null,
      },
    });
    return this.toSummary(record);
  }

  async findMany(params: { campusId?: string; from?: string; to?: string }): Promise<HolidaySummary[]> {
    const records = await this.prisma.holiday.findMany({
      where: {
        ...(params.campusId ? { OR: [{ campusId: params.campusId }, { campusId: null }] } : {}),
        ...(params.from ? { endDate: { gte: new Date(params.from) } } : {}),
        ...(params.to ? { startDate: { lte: new Date(params.to) } } : {}),
      },
      orderBy: { startDate: 'asc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  async update(id: string, dto: UpdateHolidayDto): Promise<HolidaySummary> {
    const existing = await this.prisma.holiday.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Holiday not found');
    }
    const record = await this.prisma.holiday.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.startDate !== undefined ? { startDate: new Date(dto.startDate) } : {}),
        ...(dto.endDate !== undefined ? { endDate: new Date(dto.endDate) } : {}),
        ...(dto.campusId !== undefined ? { campusId: dto.campusId } : {}),
      },
    });
    return this.toSummary(record);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.holiday.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Holiday not found');
    }
    await this.prisma.holiday.delete({ where: { id } });
  }

  /**
   * A `campusId: null` Holiday row applies school-wide, so it counts for every campus in
   * addition to any campus-specific row — never dedupe/short-circuit on the first match's scope.
   */
  async isHoliday(date: Date, campusId: string): Promise<boolean> {
    const match = await this.prisma.holiday.findFirst({
      where: {
        startDate: { lte: date },
        endDate: { gte: date },
        OR: [{ campusId }, { campusId: null }],
      },
      select: { id: true },
    });
    return !!match;
  }
}
