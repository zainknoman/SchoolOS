import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';

@Injectable()
export class FeeStructuresService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFeeStructureDto, actingUserId: string) {
    const structure = await this.prisma.feeStructure.create({
      data: { name: dto.name, amount: dto.amount },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'fee-structure.create',
        entity: 'FeeStructure',
        entityId: structure.id,
        metadata: JSON.stringify({ name: dto.name, amount: dto.amount }),
      },
    });

    return structure;
  }

  list() {
    return this.prisma.feeStructure.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
