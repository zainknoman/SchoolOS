class LoginResponse {
  const LoginResponse({required this.accessToken, required this.refreshToken, required this.role});

  final String accessToken;
  final String refreshToken;
  final String role;

  factory LoginResponse.fromJson(Map<String, dynamic> json) => LoginResponse(
    accessToken: json['accessToken'] as String,
    refreshToken: json['refreshToken'] as String,
    role: json['role'] as String,
  );
}

class ChildSummary {
  const ChildSummary({
    required this.id,
    required this.name,
    required this.grNumber,
    required this.campus,
    required this.schoolClass,
    required this.section,
  });

  final String id;
  final String name;
  final String grNumber;
  final String campus;
  final String schoolClass;
  final String section;

  factory ChildSummary.fromJson(Map<String, dynamic> json) => ChildSummary(
    id: json['id'] as String,
    name: json['name'] as String,
    grNumber: json['grNumber'] as String,
    campus: json['campus'] as String,
    schoolClass: json['class'] as String,
    section: json['section'] as String,
  );
}

class TimetableEntry {
  const TimetableEntry({
    required this.dayOfWeek,
    required this.period,
    required this.startTime,
    required this.endTime,
    required this.subject,
    required this.teacher,
    required this.room,
  });

  final int dayOfWeek;
  final int period;
  final String startTime;
  final String endTime;
  final String subject;
  final String? teacher;
  final String? room;

  factory TimetableEntry.fromJson(Map<String, dynamic> json) => TimetableEntry(
    dayOfWeek: json['dayOfWeek'] as int,
    period: json['period'] as int,
    startTime: json['startTime'] as String,
    endTime: json['endTime'] as String,
    subject: json['subject'] as String,
    teacher: json['teacher'] as String?,
    room: json['room'] as String?,
  );
}

class AttendanceDay {
  const AttendanceDay({required this.date, required this.status});

  final String date;
  final String status;

  factory AttendanceDay.fromJson(Map<String, dynamic> json) =>
      AttendanceDay(date: json['date'] as String, status: json['status'] as String);
}

class AttendanceSummary {
  const AttendanceSummary({
    required this.present,
    required this.absent,
    required this.late,
    required this.holiday,
    required this.leave,
    required this.attendancePercentage,
  });

  final int present;
  final int absent;
  final int late;
  final int holiday;
  final int leave;
  final int attendancePercentage;

  factory AttendanceSummary.fromJson(Map<String, dynamic> json) => AttendanceSummary(
    present: json['present'] as int,
    absent: json['absent'] as int,
    late: json['late'] as int,
    holiday: json['holiday'] as int,
    leave: json['leave'] as int,
    attendancePercentage: json['attendancePercentage'] as int,
  );
}

class AttendanceReport {
  const AttendanceReport({required this.days, required this.summary});

  final List<AttendanceDay> days;
  final AttendanceSummary summary;

  factory AttendanceReport.fromJson(Map<String, dynamic> json) => AttendanceReport(
    days: (json['days'] as List<dynamic>)
        .map((e) => AttendanceDay.fromJson(e as Map<String, dynamic>))
        .toList(),
    summary: AttendanceSummary.fromJson(json['summary'] as Map<String, dynamic>),
  );
}

class DiaryAttachment {
  const DiaryAttachment({required this.id, required this.originalName, required this.mimeType});
  final String id;
  final String originalName;
  final String mimeType;

  factory DiaryAttachment.fromJson(Map<String, dynamic> json) => DiaryAttachment(
    id: json['id'] as String,
    originalName: json['originalName'] as String,
    mimeType: json['mimeType'] as String,
  );
}

class DiaryEntry {
  const DiaryEntry({
    required this.id,
    required this.date,
    required this.dueDate,
    required this.subject,
    required this.text,
    required this.attachments,
  });

  final String id;
  final String date;
  final String? dueDate;
  final String subject;
  final String text;
  final List<DiaryAttachment> attachments;

  factory DiaryEntry.fromJson(Map<String, dynamic> json) => DiaryEntry(
    id: json['id'] as String,
    date: json['date'] as String,
    dueDate: json['dueDate'] as String?,
    subject: json['subject'] as String,
    text: json['text'] as String,
    attachments: (json['attachments'] as List<dynamic>)
        .map((e) => DiaryAttachment.fromJson(e as Map<String, dynamic>))
        .toList(),
  );
}

class CircularSummary {
  const CircularSummary({
    required this.id,
    required this.title,
    required this.description,
    required this.scope,
    required this.priority,
    required this.publishedAt,
    required this.expiresAt,
    required this.attachments,
    required this.readAt,
  });

  final String id;
  final String title;
  final String description;
  final String scope;
  final String priority;
  final String publishedAt;
  final String? expiresAt;
  final List<DiaryAttachment> attachments;
  final String? readAt;

  factory CircularSummary.fromJson(Map<String, dynamic> json) => CircularSummary(
    id: json['id'] as String,
    title: json['title'] as String,
    description: json['description'] as String,
    scope: json['scope'] as String,
    priority: json['priority'] as String,
    publishedAt: json['publishedAt'] as String,
    expiresAt: json['expiresAt'] as String?,
    attachments: (json['attachments'] as List<dynamic>)
        .map((e) => DiaryAttachment.fromJson(e as Map<String, dynamic>))
        .toList(),
    readAt: json['readAt'] as String?,
  );
}

class ConversationSummary {
  const ConversationSummary({
    required this.id,
    required this.recipientType,
    required this.studentId,
    required this.otherPartyName,
    required this.lastMessageAt,
    required this.unread,
  });

  final String id;
  final String recipientType;
  final String? studentId;
  final String otherPartyName;
  final String lastMessageAt;
  final bool unread;

  factory ConversationSummary.fromJson(Map<String, dynamic> json) => ConversationSummary(
    id: json['id'] as String,
    recipientType: json['recipientType'] as String,
    studentId: json['studentId'] as String?,
    otherPartyName: json['otherPartyName'] as String,
    lastMessageAt: json['lastMessageAt'] as String,
    unread: json['unread'] as bool,
  );
}

class MessageSummary {
  const MessageSummary({
    required this.id,
    required this.senderId,
    required this.body,
    required this.createdAt,
  });

  final String id;
  final String senderId;
  final String body;
  final String createdAt;

  factory MessageSummary.fromJson(Map<String, dynamic> json) => MessageSummary(
    id: json['id'] as String,
    senderId: json['senderId'] as String,
    body: json['body'] as String,
    createdAt: json['createdAt'] as String,
  );
}

class ConversationDetail {
  const ConversationDetail({
    required this.id,
    required this.recipientType,
    required this.studentId,
    required this.messages,
  });

  final String id;
  final String recipientType;
  final String? studentId;
  final List<MessageSummary> messages;

  factory ConversationDetail.fromJson(Map<String, dynamic> json) => ConversationDetail(
    id: json['id'] as String,
    recipientType: json['recipientType'] as String,
    studentId: json['studentId'] as String?,
    messages: (json['messages'] as List<dynamic>)
        .map((e) => MessageSummary.fromJson(e as Map<String, dynamic>))
        .toList(),
  );
}

class NotificationSummary {
  const NotificationSummary({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.entityRef,
    required this.readAt,
    required this.createdAt,
  });

  final String id;
  final String type;
  final String title;
  final String body;
  final String? entityRef;
  final String? readAt;
  final String createdAt;

  factory NotificationSummary.fromJson(Map<String, dynamic> json) => NotificationSummary(
    id: json['id'] as String,
    type: json['type'] as String,
    title: json['title'] as String,
    body: json['body'] as String,
    entityRef: json['entityRef'] as String?,
    readAt: json['readAt'] as String?,
    createdAt: json['createdAt'] as String,
  );
}
