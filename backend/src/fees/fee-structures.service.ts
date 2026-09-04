import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';

@Injectable()
export class FeeStructuresService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateFeeStructureDto) {
    return this.prisma.feeStructure.create({ data: { name: dto.name, amount: dto.amount } });
  }

  list() {
    return this.prisma.feeStructure.findMany({ orderBy: { createdAt: 'desc' } });
  }
}
