import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { HolidaysService } from './holidays.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HolidaysService', () => {
  let service: HolidaysService;
  let prisma: {
    holiday: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findFirst: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      holiday: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        HolidaysService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(HolidaysService);
  });

  it('creates a school-wide holiday when no campusId is given', async () => {
    prisma.holiday.create.mockResolvedValue({
      id: 'h1',
      title: 'Eid',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-04-02'),
      campusId: null,
    });

    const result = await service.create({
      title: 'Eid',
      startDate: '2026-04-01',
      endDate: '2026-04-02',
    });

    expect(prisma.holiday.create).toHaveBeenCalledWith({
      data: {
        title: 'Eid',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-04-02'),
        campusId: null,
      },
    });
    expect(result).toEqual({
      id: 'h1',
      title: 'Eid',
      startDate: '2026-04-01',
      endDate: '2026-04-02',
      campusId: null,
    });
  });

  it('creates a campus-scoped holiday when campusId is given', async () => {
    prisma.holiday.create.mockResolvedValue({
      id: 'h2',
      title: 'Campus Sports Day',
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-05-01'),
      campusId: 'campus-1',
    });

    await service.create({
      title: 'Campus Sports Day',
      startDate: '2026-05-01',
      endDate: '2026-05-01',
      campusId: 'campus-1',
    });

    expect(prisma.holiday.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ campusId: 'campus-1' }),
      }),
    );
  });

  it('findMany scoped to a campus includes both that campus AND school-wide (null) rows', async () => {
    prisma.holiday.findMany.mockResolvedValue([]);

    await service.findMany({ campusId: 'campus-1' });

    expect(prisma.holiday.findMany).toHaveBeenCalledWith({
      where: { OR: [{ campusId: 'campus-1' }, { campusId: null }] },
      orderBy: { startDate: 'asc' },
    });
  });

  it('findMany with no campusId omits the campus filter entirely (school-wide calendar view)', async () => {
    prisma.holiday.findMany.mockResolvedValue([]);

    await service.findMany({});

    expect(prisma.holiday.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { startDate: 'asc' },
    });
  });

  it('findMany applies from/to date-range filters', async () => {
    prisma.holiday.findMany.mockResolvedValue([]);

    await service.findMany({ from: '2026-01-01', to: '2026-01-31' });

    expect(prisma.holiday.findMany).toHaveBeenCalledWith({
      where: {
        endDate: { gte: new Date('2026-01-01') },
        startDate: { lte: new Date('2026-01-31') },
      },
      orderBy: { startDate: 'asc' },
    });
  });

  it('update throws NotFoundException for an unknown holiday', async () => {
    prisma.holiday.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { title: 'X' })).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.holiday.update).not.toHaveBeenCalled();
  });

  it('update only sends the fields actually provided (undefined fields omitted)', async () => {
    prisma.holiday.findUnique.mockResolvedValue({ id: 'h1' });
    prisma.holiday.update.mockResolvedValue({
      id: 'h1',
      title: 'Renamed',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-04-02'),
      campusId: null,
    });

    await service.update('h1', { title: 'Renamed' });

    expect(prisma.holiday.update).toHaveBeenCalledWith({
      where: { id: 'h1' },
      data: { title: 'Renamed' },
    });
  });

  it('delete throws NotFoundException for an unknown holiday', async () => {
    prisma.holiday.findUnique.mockResolvedValue(null);

    await expect(service.delete('missing')).rejects.toThrow(NotFoundException);
    expect(prisma.holiday.delete).not.toHaveBeenCalled();
  });

  it('delete removes an existing holiday', async () => {
    prisma.holiday.findUnique.mockResolvedValue({ id: 'h1' });
    prisma.holiday.delete.mockResolvedValue({});

    await service.delete('h1');

    expect(prisma.holiday.delete).toHaveBeenCalledWith({ where: { id: 'h1' } });
  });

  it('isHoliday returns true when a campus-specific OR school-wide row covers the date', async () => {
    prisma.holiday.findFirst.mockResolvedValue({ id: 'h1' });

    const result = await service.isHoliday(new Date('2026-04-01'), 'campus-1');

    expect(result).toBe(true);
    expect(prisma.holiday.findFirst).toHaveBeenCalledWith({
      where: {
        startDate: { lte: new Date('2026-04-01') },
        endDate: { gte: new Date('2026-04-01') },
        OR: [{ campusId: 'campus-1' }, { campusId: null }],
      },
      select: { id: true },
    });
  });

  it('isHoliday returns false when no row covers the date', async () => {
    prisma.holiday.findFirst.mockResolvedValue(null);

    expect(await service.isHoliday(new Date('2026-04-01'), 'campus-1')).toBe(
      false,
    );
  });
});
