import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MeModule } from './me/me.module';
import { TimetableModule } from './timetable/timetable.module';
import { AttendanceModule } from './attendance/attendance.module';
import { SectionsModule } from './sections/sections.module';
import { FilesModule } from './files/files.module';
import { SubjectsModule } from './subjects/subjects.module';
import { DiaryModule } from './diary/diary.module';
import { CircularsModule } from './circulars/circulars.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    MeModule,
    TimetableModule,
    AttendanceModule,
    SectionsModule,
    FilesModule,
    SubjectsModule,
    DiaryModule,
    CircularsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
