import { Test } from '@nestjs/testing';
import { ApplicationsService } from './applications.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';

describe('ApplicationsService', () => {
  let service: ApplicationsService;
  let prisma: {
    application: { findMany: jest.Mock };
    user: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      application: { findMany: jest.fn() },
      user: { findUnique: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [ApplicationsService, { provide: PrismaService, useValue: prisma }, OrgScopeService],
    }).compile();
    service = moduleRef.get(ApplicationsService);
  });

  describe('findMany', () => {
    it('lists every application for a SUPER_ADMIN, optionally filtered by academicSessionId/status', async () => {
      prisma.application.findMany.mockResolvedValue([]);

      await service.findMany({ id: 'super-1', role: 'SUPER_ADMIN' }, 'as1', 'SUBMITTED');

      expect(prisma.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { academicSessionId: 'as1', status: 'SUBMITTED' } }),
      );
    });

    it("scopes a SCHOOL_ADMIN/ACCOUNTS's application list to their own school via the desired class's campus", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', schoolId: 'school-1' });
      prisma.application.findMany.mockResolvedValue([]);

      await service.findMany({ id: 'admin-1', role: 'ACCOUNTS' });

      expect(prisma.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { desiredClass: { campus: { schoolId: 'school-1' } } } }),
      );
    });

    it('fails closed (returns an empty list) for a SCHOOL_ADMIN with no schoolId', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', schoolId: null });

      const result = await service.findMany({ id: 'admin-1', role: 'SCHOOL_ADMIN' });

      expect(result).toEqual([]);
      expect(prisma.application.findMany).not.toHaveBeenCalled();
    });
  });
});
