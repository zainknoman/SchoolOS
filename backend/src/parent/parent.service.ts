import { Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { assertDeletable } from '../common/prisma-delete-guard';
import { assertCreatable } from '../common/prisma-create-guard';
import { createParentWithUser } from './create-parent-with-user';
import { CreateParentDto } from './dto/create-parent.dto';
import { UpdateParentDto } from './dto/update-parent.dto';

export interface ParentSummary {
  id: string;
  identifier: string;
  name: string;
  phone: string | null;
  childrenCount: number;
}

const WITH_USER_AND_COUNT = { user: { select: { identifier: true } }, _count: { select: { children: true } } } as const;

@Injectable()
export class ParentService {
  constructor(private readonly prisma: PrismaService) {}

  private toSummary(record: {
    id: string;
    name: string;
    phone: string | null;
    user: { identifier: string };
    _count: { children: number };
  }): ParentSummary {
    return {
      id: record.id,
      identifier: record.user.identifier,
      name: record.name,
      phone: record.phone,
      childrenCount: record._count.children,
    };
  }

  async create(dto: CreateParentDto, actingUserId: string): Promise<ParentSummary> {
    let created;
    try {
      created = await this.prisma.$transaction((tx) => createParentWithUser(tx, dto));
    } catch (error) {
      assertCreatable(error, 'This identifier is already in use.');
    }
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'parent.create',
        entity: 'ParentProfile',
        entityId: created.id,
        metadata: JSON.stringify({ identifier: dto.identifier, name: dto.name }),
      },
    });
    return { id: created.id, identifier: created.identifier, name: created.name, phone: created.phone, childrenCount: 0 };
  }

  async list(): Promise<ParentSummary[]> {
    const records = await this.prisma.parentProfile.findMany({
      include: WITH_USER_AND_COUNT,
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  async update(id: string, dto: UpdateParentDto, actingUserId: string): Promise<ParentSummary> {
    const existing = await this.prisma.parentProfile.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Parent not found');
    }
    if (dto.password !== undefined) {
      const passwordHash = await argon2.hash(dto.password);
      await this.prisma.user.update({ where: { id: existing.userId }, data: { passwordHash } });
    }
    const record = await this.prisma.parentProfile.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      },
      include: WITH_USER_AND_COUNT,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'parent.update',
        entity: 'ParentProfile',
        entityId: id,
        metadata: JSON.stringify({ name: dto.name, phone: dto.phone, passwordChanged: dto.password !== undefined }),
      },
    });
    return this.toSummary(record);
  }

  async delete(id: string, actingUserId: string): Promise<void> {
    const existing = await this.prisma.parentProfile.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Parent not found');
    }
    try {
      await this.prisma.parentProfile.delete({ where: { id } });
      await this.prisma.user.delete({ where: { id: existing.userId } });
    } catch (error) {
      assertDeletable(error, 'Parent');
    }
    await this.prisma.auditLog.create({
      data: { userId: actingUserId, action: 'parent.delete', entity: 'ParentProfile', entityId: id },
    });
  }
}
