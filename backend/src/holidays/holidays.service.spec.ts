import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { HolidaysService } from './holidays.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';

/** BL-20: every holiday belongs to one school; a campus-less holiday never crosses schools. */
describe('HolidaysService', () => {
  let service: HolidaysService;
  let prisma: {
    holiday: Record<
      'create' | 'findMany' | 'findUnique' | 'update' | 'delete' | 'findFirst',
      jest.Mock
    >;
    user: { findUnique: jest.Mock };
    campus: { findMany: jest.Mock; findUnique: jest.Mock };
    school: { findUnique: jest.Mock };
    teacher: { findUnique: jest.Mock };
    enrollment: { findMany: jest.Mock };
  };
  const superAdmin = { id: 'super-1', role: 'SUPER_ADMIN' };
  const adminA = { id: 'admin-a', role: 'SCHOOL_ADMIN' };
  const row = (over: Record<string, unknown> = {}) => ({
    id: 'h1',
    title: 'Eid',
    startDate: new Date('2026-04-01'),
    endDate: new Date('2026-04-02'),
    campusId: null,
    schoolId: 'school-a',
    ...over,
  });
  const asAdminOf = (schoolId: string | null, campusId: string | null = null) =>
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-a',
      schoolId,
      campusId,
    });

  beforeEach(async () => {
    prisma = {
      holiday: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      campus: { findMany: jest.fn(), findUnique: jest.fn() },
      school: { findUnique: jest.fn() },
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

  describe('create', () => {
    it("a school admin's school-wide holiday belongs to their school", async () => {
      asAdminOf('school-a');
      prisma.holiday.create.mockResolvedValue(row());
      const result = await service.create(
        { title: 'Eid', startDate: '2026-04-01', endDate: '2026-04-02' },
        adminA,
      );
      expect(prisma.holiday.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ campusId: null, schoolId: 'school-a' }),
      });
      expect(result).toMatchObject({ campusId: null, schoolId: 'school-a' });
    });

    it('a campus holiday takes the campus school; a foreign campus is refused', async () => {
      asAdminOf('school-a');
      prisma.campus.findUnique.mockResolvedValueOnce({
        id: 'c-a',
        schoolId: 'school-a',
      });
      prisma.holiday.create.mockResolvedValue(row({ campusId: 'c-a' }));
      await service.create(
        {
          title: 'Sports day',
          startDate: '2026-04-01',
          endDate: '2026-04-01',
          campusId: 'c-a',
        },
        adminA,
      );
      expect(prisma.holiday.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          campusId: 'c-a',
          schoolId: 'school-a',
        }),
      });

      prisma.campus.findUnique.mockResolvedValueOnce({
        id: 'c-b',
        schoolId: 'school-b',
      });
      await expect(
        service.create(
          {
            title: 'x',
            startDate: '2026-04-01',
            endDate: '2026-04-01',
            campusId: 'c-b',
          },
          adminA,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('a super admin must name the school of a school-wide holiday', async () => {
      await expect(
        service.create(
          { title: 'x', startDate: '2026-04-01', endDate: '2026-04-01' },
          superAdmin,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      prisma.school.findUnique.mockResolvedValue({ id: 'school-b' });
      prisma.holiday.create.mockResolvedValue(row({ schoolId: 'school-b' }));
      await service.create(
        {
          title: 'x',
          startDate: '2026-04-01',
          endDate: '2026-04-01',
          schoolId: 'school-b',
        },
        superAdmin,
      );
      expect(prisma.holiday.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ schoolId: 'school-b', campusId: null }),
      });
    });

    it('a campus principal cannot create a school-wide holiday', async () => {
      asAdminOf('school-a', 'c-a');
      await expect(
        service.create(
          { title: 'x', startDate: '2026-04-01', endDate: '2026-04-01' },
          adminA,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('findMany scoping', () => {
    it("a school admin sees their campuses' rows and only their own school's campus-less rows", async () => {
      asAdminOf('school-a');
      prisma.campus.findMany.mockResolvedValue([
        { id: 'c1', schoolId: 'school-a' },
        { id: 'c2', schoolId: 'school-a' },
      ]);
      await service.findMany(adminA, {});
      expect(prisma.holiday.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { campusId: { in: ['c1', 'c2'] } },
              { campusId: null, schoolId: { in: ['school-a'] } },
            ],
          },
        }),
      );
    });

    it("a parent sees their children's campuses and those schools' campus-less rows", async () => {
      prisma.enrollment.findMany.mockResolvedValue([
        { campus: { id: 'c-a', schoolId: 'school-a' } },
        { campus: { id: 'c-b', schoolId: 'school-b' } },
      ]);
      await service.findMany({ id: 'p1', role: 'PARENT' }, {});
      expect(prisma.holiday.findMany.mock.calls[0][0].where).toEqual({
        OR: [
          { campusId: { in: ['c-a', 'c-b'] } },
          { campusId: null, schoolId: { in: ['school-a', 'school-b'] } },
        ],
      });
    });

    it('fails closed for an admin without a school and a user without a teacher profile', async () => {
      asAdminOf(null);
      await expect(service.findMany(adminA, {})).resolves.toEqual([]);
      prisma.teacher.findUnique.mockResolvedValue(null);
      await expect(
        service.findMany({ id: 't', role: 'TEACHER' }, {}),
      ).resolves.toEqual([]);
      expect(prisma.holiday.findMany).not.toHaveBeenCalled();
    });

    it("a campusId filter includes that campus's school-wide rows only", async () => {
      prisma.campus.findUnique.mockResolvedValue({ schoolId: 'school-a' });
      await service.findMany(superAdmin, { campusId: 'c-a' });
      expect(prisma.holiday.findMany.mock.calls[0][0].where).toEqual({
        OR: [{ campusId: 'c-a' }, { campusId: null, schoolId: 'school-a' }],
      });
    });
  });

  describe('update / delete', () => {
    it("refuses to change or delete another school's holiday", async () => {
      asAdminOf('school-a');
      prisma.holiday.findUnique.mockResolvedValue(
        row({ schoolId: 'school-b' }),
      );
      await expect(
        service.update('h1', { title: 'x' }, adminA),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.delete('h1', adminA)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.holiday.delete).not.toHaveBeenCalled();
    });

    it('updates only the provided fields and deletes within scope', async () => {
      asAdminOf('school-a');
      prisma.holiday.findUnique.mockResolvedValue(row());
      prisma.holiday.update.mockResolvedValue(row({ title: 'Renamed' }));
      await service.update('h1', { title: 'Renamed' }, adminA);
      expect(prisma.holiday.update).toHaveBeenCalledWith({
        where: { id: 'h1' },
        data: { title: 'Renamed' },
      });
      await service.delete('h1', adminA);
      expect(prisma.holiday.delete).toHaveBeenCalledWith({
        where: { id: 'h1' },
      });
    });

    it('404s for an unknown holiday', async () => {
      prisma.holiday.findUnique.mockResolvedValue(null);
      await expect(
        service.delete('missing', superAdmin),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('isHoliday', () => {
    it("matches the campus's own rows and its school's campus-less rows only", async () => {
      prisma.campus.findUnique.mockResolvedValue({ schoolId: 'school-a' });
      prisma.holiday.findFirst.mockResolvedValue({ id: 'h1' });
      await expect(
        service.isHoliday(new Date('2026-04-01'), 'c-a'),
      ).resolves.toBe(true);
      expect(prisma.holiday.findFirst.mock.calls[0][0].where.OR).toEqual([
        { campusId: 'c-a' },
        { campusId: null, schoolId: 'school-a' },
      ]);
      prisma.holiday.findFirst.mockResolvedValue(null);
      await expect(
        service.isHoliday(new Date('2026-05-01'), 'c-a'),
      ).resolves.toBe(false);
    });
  });
});
