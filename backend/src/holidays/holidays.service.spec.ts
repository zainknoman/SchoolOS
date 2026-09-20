import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { HolidaysService } from './holidays.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';

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
    user: { findUnique: jest.Mock };
    campus: { findMany: jest.Mock };
    teacher: { findUnique: jest.Mock };
    enrollment: { findMany: jest.Mock };
  };
  const superAdmin = { id: 'super-1', role: 'SUPER_ADMIN' };

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
      user: { findUnique: jest.fn() },
      campus: { findMany: jest.fn() },
      teacher: { findUnique: jest.fn() },
      enrollment: { findMany: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        HolidaysService,
        OrgScopeService,
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

  it('findMany scoped to a campus includes both that campus AND school-wide (null) rows, for a SUPER_ADMIN', async () => {
    prisma.holiday.findMany.mockResolvedValue([]);

    await service.findMany(superAdmin, { campusId: 'campus-1' });

    expect(prisma.holiday.findMany).toHaveBeenCalledWith({
      where: { OR: [{ campusId: 'campus-1' }, { campusId: null }] },
      orderBy: { startDate: 'asc' },
    });
  });

  it('findMany with no campusId omits the campus filter entirely for a SUPER_ADMIN (school-wide calendar view)', async () => {
    prisma.holiday.findMany.mockResolvedValue([]);

    await service.findMany(superAdmin, {});

    expect(prisma.holiday.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { startDate: 'asc' },
    });
  });

  it('findMany applies from/to date-range filters for a SUPER_ADMIN', async () => {
    prisma.holiday.findMany.mockResolvedValue([]);

    await service.findMany(superAdmin, {
      from: '2026-01-01',
      to: '2026-01-31',
    });

    expect(prisma.holiday.findMany).toHaveBeenCalledWith({
      where: {
        endDate: { gte: new Date('2026-01-01') },
        startDate: { lte: new Date('2026-01-31') },
      },
      orderBy: { startDate: 'asc' },
    });
  });

  describe('caller scoping (cross-school leak fix)', () => {
    it("scopes a SCHOOL_ADMIN's calendar to their own school's campuses plus school-wide rows", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        schoolId: 'school-1',
      });
      prisma.campus.findMany.mockResolvedValue([
        { id: 'campus-1' },
        { id: 'campus-2' },
      ]);
      prisma.holiday.findMany.mockResolvedValue([]);

      await service.findMany({ id: 'admin-1', role: 'SCHOOL_ADMIN' }, {});

      expect(prisma.holiday.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { campusId: null },
            { campusId: { in: ['campus-1', 'campus-2'] } },
          ],
        },
        orderBy: { startDate: 'asc' },
      });
    });

    it("scopes a campus principal's calendar to their own campus only", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'p1',
        schoolId: 's1',
        campusId: 'c1',
      });
      prisma.campus.findMany.mockResolvedValue([{ id: 'c1' }]);
      prisma.holiday.findMany.mockResolvedValue([]);

      await service.findMany({ id: 'p1', role: 'SCHOOL_ADMIN' }, {});

      expect(prisma.campus.findMany).toHaveBeenCalledWith({
        where: { id: 'c1', schoolId: 's1' },
        select: { id: true },
      });
      expect(prisma.holiday.findMany).toHaveBeenCalledWith({
        where: { OR: [{ campusId: null }, { campusId: { in: ['c1'] } }] },
        orderBy: { startDate: 'asc' },
      });
    });

    it("scopes a TEACHER's calendar to their own campus plus school-wide rows", async () => {
      prisma.teacher.findUnique.mockResolvedValue({
        id: 't1',
        campusId: 'campus-1',
      });
      prisma.holiday.findMany.mockResolvedValue([]);

      await service.findMany({ id: 'teacher-1', role: 'TEACHER' }, {});

      expect(prisma.holiday.findMany).toHaveBeenCalledWith({
        where: { OR: [{ campusId: null }, { campusId: { in: ['campus-1'] } }] },
        orderBy: { startDate: 'asc' },
      });
    });

    it("scopes a PARENT's calendar to their children's campuses plus school-wide rows", async () => {
      prisma.enrollment.findMany.mockResolvedValue([{ campusId: 'campus-3' }]);
      prisma.holiday.findMany.mockResolvedValue([]);

      await service.findMany({ id: 'parent-1', role: 'PARENT' }, {});

      expect(prisma.enrollment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            student: {
              parents: { some: { parentProfile: { userId: 'parent-1' } } },
            },
          },
        }),
      );
      expect(prisma.holiday.findMany).toHaveBeenCalledWith({
        where: { OR: [{ campusId: null }, { campusId: { in: ['campus-3'] } }] },
        orderBy: { startDate: 'asc' },
      });
    });

    it("combines a caller's campus scope with an explicit campusId query param via AND", async () => {
      prisma.teacher.findUnique.mockResolvedValue({
        id: 't1',
        campusId: 'campus-1',
      });
      prisma.holiday.findMany.mockResolvedValue([]);

      await service.findMany(
        { id: 'teacher-1', role: 'TEACHER' },
        { campusId: 'campus-1' },
      );

      expect(prisma.holiday.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            { OR: [{ campusId: null }, { campusId: { in: ['campus-1'] } }] },
            { OR: [{ campusId: 'campus-1' }, { campusId: null }] },
          ],
        },
        orderBy: { startDate: 'asc' },
      });
    });

    it('fails closed (returns an empty list) for a SCHOOL_ADMIN with no schoolId', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        schoolId: null,
      });

      const result = await service.findMany(
        { id: 'admin-1', role: 'SCHOOL_ADMIN' },
        {},
      );

      expect(result).toEqual([]);
      expect(prisma.holiday.findMany).not.toHaveBeenCalled();
    });

    it('fails closed (returns an empty list) for a TEACHER with no Teacher profile', async () => {
      prisma.teacher.findUnique.mockResolvedValue(null);

      const result = await service.findMany(
        { id: 'ghost-1', role: 'TEACHER' },
        {},
      );

      expect(result).toEqual([]);
      expect(prisma.holiday.findMany).not.toHaveBeenCalled();
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
