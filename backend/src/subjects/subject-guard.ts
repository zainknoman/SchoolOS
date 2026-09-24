import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * BL-02: a timetable slot, diary entry or assessment may only use an ACTIVE subject of the same
 * school as its section/class. A school-less (legacy) subject is still accepted until the M4
 * backfill has assigned it (expand phase).
 */
export async function assertSubjectUsable(
  prisma: Pick<PrismaService, 'subject' | 'section' | 'class'>,
  subjectId: string,
  target: { sectionId: string } | { classId: string },
): Promise<void> {
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: { schoolId: true, isActive: true },
  });
  if (!subject) throw new BadRequestException('Subject not found');
  if (!subject.isActive) {
    throw new BadRequestException('This subject is inactive');
  }
  if (!subject.schoolId) return;
  const schoolId =
    'sectionId' in target
      ? (
          await prisma.section.findUnique({
            where: { id: target.sectionId },
            select: {
              class: { select: { campus: { select: { schoolId: true } } } },
            },
          })
        )?.class.campus.schoolId
      : (
          await prisma.class.findUnique({
            where: { id: target.classId },
            select: { campus: { select: { schoolId: true } } },
          })
        )?.campus.schoolId;
  if (schoolId && schoolId !== subject.schoolId) {
    throw new BadRequestException('This subject belongs to another school');
  }
}
