import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';

describe('ApplicationsService', () => {
  let service: ApplicationsService;
  let prisma: {
    application: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
    };
    user: { findUnique: jest.Mock };
    class: { findUnique: jest.Mock };
    section: { findUnique: jest.Mock };
    academicSession: { findUnique: jest.Mock };
    applicant: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      application: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      class: { findUnique: jest.fn() },
      section: { findUnique: jest.fn() },
      academicSession: { findUnique: jest.fn() },
      applicant: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: PrismaService, useValue: prisma },
        OrgScopeService,
      ],
    }).compile();
    service = moduleRef.get(ApplicationsService);
    // BL-40: list methods also count the matching rows.
    Object.assign(prisma.application, {
      count: jest.fn().mockResolvedValue(0),
    });
  });

  describe('findMany', () => {
    it('lists every application for a SUPER_ADMIN, optionally filtered by academicSessionId/status', async () => {
      prisma.application.findMany.mockResolvedValue([]);

      await service.findMany(
        { id: 'super-1', role: 'SUPER_ADMIN' },
        'as1',
        'SUBMITTED',
      );

      expect(prisma.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { academicSessionId: 'as1', status: 'SUBMITTED' },
        }),
      );
    });

    it("scopes a SCHOOL_ADMIN/ACCOUNTS's application list to their own school via the desired class's campus", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        schoolId: 'school-1',
      });
      prisma.application.findMany.mockResolvedValue([]);

      await service.findMany({ id: 'admin-1', role: 'ACCOUNTS' });

      expect(prisma.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { desiredClass: { campus: { schoolId: 'school-1' } } },
        }),
      );
    });

    it('fails closed (returns an empty list) for a SCHOOL_ADMIN with no schoolId', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        schoolId: null,
      });

      const result = (
        await service.findMany({
          id: 'admin-1',
          role: 'SCHOOL_ADMIN',
        })
      ).items;

      expect(result).toEqual([]);
      expect(prisma.application.findMany).not.toHaveBeenCalled();
    });
  });

  // KG-16: an application and its approval must stay inside the caller's school.
  describe('school scope on create and approve', () => {
    const admin = { id: 'admin-1', role: 'SCHOOL_ADMIN' };
    const own = { campusId: 'c1', campus: { schoolId: 's1' } };
    const foreign = { campusId: 'c9', campus: { schoolId: 's9' } };
    const dto = {
      applicantId: 'ap1',
      desiredClassId: 'k1',
      academicSessionId: 'se1',
    };
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        schoolId: 's1',
        campusId: null,
      });
      prisma.academicSession.findUnique.mockResolvedValue({ schoolId: 's1' });
      prisma.applicant.findFirst.mockResolvedValue({ id: 'ap1' });
    });

    it('create refuses a class of another school', async () => {
      prisma.class.findUnique.mockResolvedValue(foreign);
      await expect(service.create(dto, admin)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.application.create).not.toHaveBeenCalled();
    });

    it('create refuses a session of another school', async () => {
      prisma.class.findUnique.mockResolvedValue(own);
      prisma.academicSession.findUnique.mockResolvedValue({ schoolId: 's9' });
      await expect(service.create(dto, admin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('create refuses an applicant who applied only to another school', async () => {
      prisma.class.findUnique.mockResolvedValue(own);
      prisma.applicant.findFirst.mockResolvedValue(null);
      await expect(service.create(dto, admin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('create accepts an own-school class, session and applicant', async () => {
      prisma.class.findUnique.mockResolvedValue(own);
      prisma.application.create.mockResolvedValue({
        id: 'a1',
        applicantId: 'ap1',
        applicant: { name: 'X' },
        desiredClassId: 'k1',
        academicSessionId: 'se1',
        status: 'SUBMITTED',
        decisionNotes: null,
        reviewedById: null,
        createdStudentId: null,
      });
      await expect(service.create(dto, admin)).resolves.toMatchObject({
        status: 'SUBMITTED',
      });
    });

    const pending = {
      id: 'a1',
      applicantId: 'ap1',
      applicant: { name: 'X' },
      desiredClassId: 'k1',
      academicSessionId: 'se1',
      status: 'SUBMITTED',
      desiredClass: own,
    };
    const approveDto = {
      sectionId: 'sec9',
      grNumber: 'GR1',
      parentProfileId: 'pp1',
      relationshipType: 'FATHER' as const,
    };

    it('approve refuses a section of another school', async () => {
      prisma.application.findUnique.mockResolvedValue(pending);
      prisma.section.findUnique.mockResolvedValue({
        id: 'sec9',
        class: foreign,
      });
      await expect(service.approve('a1', approveDto, admin)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('approve refuses (super admin too) a section outside the application’s school', async () => {
      prisma.application.findUnique.mockResolvedValue(pending);
      prisma.section.findUnique.mockResolvedValue({
        id: 'sec9',
        class: foreign,
      });
      await expect(
        service.approve('a1', approveDto, { id: 'sa', role: 'SUPER_ADMIN' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
