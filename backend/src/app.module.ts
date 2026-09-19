import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { OrgScopeModule } from './common/org-scope.module';
import { AuthModule } from './auth/auth.module';
import { MeModule } from './me/me.module';
import { TimetableModule } from './timetable/timetable.module';
import { AttendanceModule } from './attendance/attendance.module';
import { SectionsModule } from './sections/sections.module';
import { FilesModule } from './files/files.module';
import { SubjectsModule } from './subjects/subjects.module';
import { TeachersModule } from './teachers/teachers.module';
import { DiaryModule } from './diary/diary.module';
import { CircularsModule } from './circulars/circulars.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MessagesModule } from './messages/messages.module';
import { FeesModule } from './fees/fees.module';
import { LeaveModule } from './leave/leave.module';
import { SchoolModule } from './school/school.module';
import { CampusModule } from './campus/campus.module';
import { AcademicSessionModule } from './academic-session/academic-session.module';
import { ClassModule } from './class/class.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ParentModule } from './parent/parent.module';
import { TeacherModule } from './teacher/teacher.module';
import { StudentModule } from './student/student.module';
import { StaffModule } from './staff/staff.module';
import { HiringModule } from './hiring/hiring.module';
import { PromotionsModule } from './promotions/promotions.module';
import { HolidaysModule } from './holidays/holidays.module';
import { ComplaintsModule } from './complaints/complaints.module';
import { ReportCardsModule } from './report-cards/report-cards.module';
import { AiDraftingModule } from './ai-drafting/ai-drafting.module';
import { AttendanceRiskModule } from './attendance-risk/attendance-risk.module';
import { GradebookModule } from './gradebook/gradebook.module';
import { AdmissionsModule } from './admissions/admissions.module';
import { BulkImportModule } from './bulk-import/bulk-import.module';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import {
  GENERAL_THROTTLE_LIMIT,
  THROTTLE_TTL_MS,
} from './config/throttler.config';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'default', ttl: THROTTLE_TTL_MS, limit: GENERAL_THROTTLE_LIMIT },
    ]),
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    OrgScopeModule,
    AuthModule,
    MeModule,
    TimetableModule,
    AttendanceModule,
    SectionsModule,
    FilesModule,
    SubjectsModule,
    TeachersModule,
    DiaryModule,
    CircularsModule,
    NotificationsModule,
    MessagesModule,
    FeesModule,
    LeaveModule,
    SchoolModule,
    CampusModule,
    AcademicSessionModule,
    ClassModule,
    DashboardModule,
    ParentModule,
    TeacherModule,
    StudentModule,
    StaffModule,
    HiringModule,
    PromotionsModule,
    HolidaysModule,
    ComplaintsModule,
    ReportCardsModule,
    AiDraftingModule,
    AttendanceRiskModule,
    GradebookModule,
    AdmissionsModule,
    BulkImportModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
