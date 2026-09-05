import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/src/api/models.dart';

void main() {
  test('TimetableEntry.toJson round-trips through fromJson', () {
    const entry = TimetableEntry(
      dayOfWeek: 1,
      period: 2,
      startTime: '08:00',
      endTime: '08:40',
      subject: 'Math',
      teacher: 'Mr. A',
      room: '3A',
    );

    final restored = TimetableEntry.fromJson(entry.toJson());

    expect(restored.dayOfWeek, entry.dayOfWeek);
    expect(restored.period, entry.period);
    expect(restored.startTime, entry.startTime);
    expect(restored.endTime, entry.endTime);
    expect(restored.subject, entry.subject);
    expect(restored.teacher, entry.teacher);
    expect(restored.room, entry.room);
  });

  test('AttendanceReport.toJson round-trips nested days and summary', () {
    const report = AttendanceReport(
      days: [AttendanceDay(date: '2026-08-27', status: 'PRESENT')],
      summary: AttendanceSummary(
        present: 18,
        absent: 2,
        late: 1,
        holiday: 0,
        leave: 0,
        attendancePercentage: 86,
      ),
    );

    final restored = AttendanceReport.fromJson(report.toJson());

    expect(restored.days.single.date, '2026-08-27');
    expect(restored.days.single.status, 'PRESENT');
    expect(restored.summary.attendancePercentage, 86);
  });

  test('DiaryEntry.toJson round-trips nested attachments', () {
    const entry = DiaryEntry(
      id: 'd1',
      date: '2026-08-27',
      dueDate: '2026-08-29',
      subject: 'Urdu',
      text: 'کتاب لائیں',
      attachments: [DiaryAttachment(id: 'a1', originalName: 'sheet.pdf', mimeType: 'application/pdf')],
    );

    final restored = DiaryEntry.fromJson(entry.toJson());

    expect(restored.id, 'd1');
    expect(restored.text, 'کتاب لائیں');
    expect(restored.attachments.single.originalName, 'sheet.pdf');
  });

  test('CircularSummary.toJson round-trips nested attachments', () {
    const circular = CircularSummary(
      id: 'c1',
      title: 'PTM',
      description: 'PTM in September.',
      scope: 'school',
      priority: 'normal',
      publishedAt: '2026-08-01T00:00:00.000Z',
      expiresAt: null,
      attachments: [DiaryAttachment(id: 'a1', originalName: 'notice.pdf', mimeType: 'application/pdf')],
      readAt: null,
    );

    final restored = CircularSummary.fromJson(circular.toJson());

    expect(restored.id, 'c1');
    expect(restored.title, 'PTM');
    expect(restored.attachments.single.id, 'a1');
    expect(restored.readAt, isNull);
  });
}
