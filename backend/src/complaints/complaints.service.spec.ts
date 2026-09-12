import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ComplaintsService } from './complaints.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ComplaintsService', () => {
  let service: ComplaintsService;
  let prisma: {
    complaint: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  const record = {
    id: 'c1',
    studentId: 's1',
    raisedById: 'teacher-1',
    subject: 'Bullying concern',
    description: 'Details here',
    status: 'open',
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      complaint: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ComplaintsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(ComplaintsService);
  });

  it('creates a complaint with status "open", attributed to the raising staff member', async () => {
    prisma.complaint.create.mockResolvedValue(record);

    const result = await service.create(
      {
        studentId: 's1',
        subject: 'Bullying concern',
        description: 'Details here',
      },
      'teacher-1',
    );

    expect(prisma.complaint.create).toHaveBeenCalledWith({
      data: {
        studentId: 's1',
        raisedById: 'teacher-1',
        subject: 'Bullying concern',
        description: 'Details here',
        status: 'open',
      },
    });
    expect(result.status).toBe('open');
    expect(result.createdAt).toBe('2026-09-01T00:00:00.000Z');
  });

  it('findForStudent orders complaints newest-first', async () => {
    prisma.complaint.findMany.mockResolvedValue([record]);

    await service.findForStudent('s1');

    expect(prisma.complaint.findMany).toHaveBeenCalledWith({
      where: { studentId: 's1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('updateStatus throws NotFoundException for an unknown complaint', async () => {
    prisma.complaint.findUnique.mockResolvedValue(null);

    await expect(service.updateStatus('missing', 'resolved')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.complaint.update).not.toHaveBeenCalled();
  });

  it("updateStatus updates an existing complaint's status", async () => {
    prisma.complaint.findUnique.mockResolvedValue(record);
    prisma.complaint.update.mockResolvedValue({
      ...record,
      status: 'resolved',
    });

    const result = await service.updateStatus('c1', 'resolved');

    expect(prisma.complaint.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { status: 'resolved' },
    });
    expect(result.status).toBe('resolved');
  });
});
