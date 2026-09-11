class LoginResponse {
  const LoginResponse({
    required this.accessToken,
    required this.refreshToken,
    required this.role,
  });

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

  Map<String, dynamic> toJson() => {
    'dayOfWeek': dayOfWeek,
    'period': period,
    'startTime': startTime,
    'endTime': endTime,
    'subject': subject,
    'teacher': teacher,
    'room': room,
  };
}

class AttendanceDay {
  const AttendanceDay({required this.date, required this.status});

  final String date;
  final String status;

  factory AttendanceDay.fromJson(Map<String, dynamic> json) => AttendanceDay(
    date: json['date'] as String,
    status: json['status'] as String,
  );

  Map<String, dynamic> toJson() => {'date': date, 'status': status};
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

  factory AttendanceSummary.fromJson(Map<String, dynamic> json) =>
      AttendanceSummary(
        present: json['present'] as int,
        absent: json['absent'] as int,
        late: json['late'] as int,
        holiday: json['holiday'] as int,
        leave: json['leave'] as int,
        attendancePercentage: json['attendancePercentage'] as int,
      );

  Map<String, dynamic> toJson() => {
    'present': present,
    'absent': absent,
    'late': late,
    'holiday': holiday,
    'leave': leave,
    'attendancePercentage': attendancePercentage,
  };
}

class AttendanceReport {
  const AttendanceReport({required this.days, required this.summary});

  final List<AttendanceDay> days;
  final AttendanceSummary summary;

  factory AttendanceReport.fromJson(Map<String, dynamic> json) =>
      AttendanceReport(
        days: (json['days'] as List<dynamic>)
            .map((e) => AttendanceDay.fromJson(e as Map<String, dynamic>))
            .toList(),
        summary: AttendanceSummary.fromJson(
          json['summary'] as Map<String, dynamic>,
        ),
      );

  Map<String, dynamic> toJson() => {
    'days': days.map((d) => d.toJson()).toList(),
    'summary': summary.toJson(),
  };
}

class DiaryAttachment {
  const DiaryAttachment({
    required this.id,
    required this.originalName,
    required this.mimeType,
  });
  final String id;
  final String originalName;
  final String mimeType;

  factory DiaryAttachment.fromJson(Map<String, dynamic> json) =>
      DiaryAttachment(
        id: json['id'] as String,
        originalName: json['originalName'] as String,
        mimeType: json['mimeType'] as String,
      );

  Map<String, dynamic> toJson() => {
    'id': id,
    'originalName': originalName,
    'mimeType': mimeType,
  };
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

  Map<String, dynamic> toJson() => {
    'id': id,
    'date': date,
    'dueDate': dueDate,
    'subject': subject,
    'text': text,
    'attachments': attachments.map((a) => a.toJson()).toList(),
  };
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

  factory CircularSummary.fromJson(Map<String, dynamic> json) =>
      CircularSummary(
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

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'description': description,
    'scope': scope,
    'priority': priority,
    'publishedAt': publishedAt,
    'expiresAt': expiresAt,
    'attachments': attachments.map((a) => a.toJson()).toList(),
    'readAt': readAt,
  };
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

  factory ConversationSummary.fromJson(Map<String, dynamic> json) =>
      ConversationSummary(
        id: json['id'] as String,
        recipientType: json['recipientType'] as String,
        studentId: json['studentId'] as String?,
        otherPartyName: json['otherPartyName'] as String,
        lastMessageAt: json['lastMessageAt'] as String,
        unread: json['unread'] as bool,
      );

  Map<String, dynamic> toJson() => {
    'id': id,
    'recipientType': recipientType,
    'studentId': studentId,
    'otherPartyName': otherPartyName,
    'lastMessageAt': lastMessageAt,
    'unread': unread,
  };
}

class MessageSummary {
  const MessageSummary({
    required this.id,
    required this.senderId,
    required this.senderName,
    required this.body,
    required this.createdAt,
  });

  final String id;
  final String senderId;
  final String senderName;
  final String body;
  final String createdAt;

  factory MessageSummary.fromJson(Map<String, dynamic> json) => MessageSummary(
    id: json['id'] as String,
    senderId: json['senderId'] as String,
    senderName: json['senderName'] as String,
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

  factory ConversationDetail.fromJson(Map<String, dynamic> json) =>
      ConversationDetail(
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

  factory NotificationSummary.fromJson(Map<String, dynamic> json) =>
      NotificationSummary(
        id: json['id'] as String,
        type: json['type'] as String,
        title: json['title'] as String,
        body: json['body'] as String,
        entityRef: json['entityRef'] as String?,
        readAt: json['readAt'] as String?,
        createdAt: json['createdAt'] as String,
      );
}

class FeeVoucherItem {
  const FeeVoucherItem({required this.label, required this.amount});
  final String label;
  final int amount;

  factory FeeVoucherItem.fromJson(Map<String, dynamic> json) => FeeVoucherItem(
    label: json['label'] as String,
    amount: json['amount'] as int,
  );

  Map<String, dynamic> toJson() => {'label': label, 'amount': amount};
}

class FeeVoucherSummary {
  const FeeVoucherSummary({
    required this.id,
    required this.studentId,
    required this.month,
    required this.dueDate,
    required this.items,
    required this.totalAmount,
    required this.amountPaid,
    required this.amountDue,
    required this.status,
  });

  final String id;
  final String studentId;
  final String month;
  final String dueDate;
  final List<FeeVoucherItem> items;
  final int totalAmount;
  final int amountPaid;
  final int amountDue;
  final String status;

  factory FeeVoucherSummary.fromJson(Map<String, dynamic> json) =>
      FeeVoucherSummary(
        id: json['id'] as String,
        studentId: json['studentId'] as String,
        month: json['month'] as String,
        dueDate: json['dueDate'] as String,
        items: (json['items'] as List<dynamic>)
            .map((e) => FeeVoucherItem.fromJson(e as Map<String, dynamic>))
            .toList(),
        totalAmount: json['totalAmount'] as int,
        amountPaid: json['amountPaid'] as int,
        amountDue: json['amountDue'] as int,
        status: json['status'] as String,
      );

  Map<String, dynamic> toJson() => {
    'id': id,
    'studentId': studentId,
    'month': month,
    'dueDate': dueDate,
    'items': items.map((i) => i.toJson()).toList(),
    'totalAmount': totalAmount,
    'amountPaid': amountPaid,
    'amountDue': amountDue,
    'status': status,
  };
}

class FeePaymentSummary {
  const FeePaymentSummary({
    required this.id,
    required this.amount,
    required this.method,
    required this.status,
    required this.voucherIds,
    required this.receiptId,
  });

  final String id;
  final int amount;
  final String method;
  final String status;
  final List<String> voucherIds;
  final String? receiptId;

  factory FeePaymentSummary.fromJson(Map<String, dynamic> json) =>
      FeePaymentSummary(
        id: json['id'] as String,
        amount: json['amount'] as int,
        method: json['method'] as String,
        status: json['status'] as String,
        voucherIds: (json['voucherIds'] as List<dynamic>).cast<String>(),
        receiptId: json['receiptId'] as String?,
      );
}

class PaymentInitiation {
  const PaymentInitiation({required this.paymentId, required this.redirectUrl});
  final String paymentId;
  final String redirectUrl;

  factory PaymentInitiation.fromJson(Map<String, dynamic> json) =>
      PaymentInitiation(
        paymentId: json['paymentId'] as String,
        redirectUrl: json['redirectUrl'] as String,
      );
}

class LeaveRequestSummary {
  const LeaveRequestSummary({
    required this.id,
    required this.studentId,
    required this.startDate,
    required this.endDate,
    required this.reason,
    required this.status,
  });

  final String id;
  final String studentId;
  final String startDate;
  final String endDate;
  final String reason;
  final String status;

  factory LeaveRequestSummary.fromJson(Map<String, dynamic> json) =>
      LeaveRequestSummary(
        id: json['id'] as String,
        studentId: json['studentId'] as String,
        startDate: json['startDate'] as String,
        endDate: json['endDate'] as String,
        reason: json['reason'] as String,
        status: json['status'] as String,
      );
}

class Holiday {
  const Holiday({
    required this.id,
    required this.title,
    required this.startDate,
    required this.endDate,
    this.campusId,
  });

  final String id;
  final String title;
  final String startDate;
  final String endDate;
  final String? campusId;

  factory Holiday.fromJson(Map<String, dynamic> json) => Holiday(
    id: json['id'] as String,
    title: json['title'] as String,
    startDate: json['startDate'] as String,
    endDate: json['endDate'] as String,
    campusId: json['campusId'] as String?,
  );

  /// Inclusive [DateTime] range check against this holiday's [startDate]/[endDate].
  bool covers(String isoDate) {
    final date = DateTime.parse(isoDate);
    final start = DateTime.parse(startDate);
    final end = DateTime.parse(endDate);
    return !date.isBefore(start) && !date.isAfter(end);
  }
}

class Complaint {
  const Complaint({
    required this.id,
    required this.studentId,
    required this.subject,
    required this.description,
    required this.status,
    required this.createdAt,
  });

  final String id;
  final String studentId;
  final String subject;
  final String description;
  final String status;
  final String createdAt;

  factory Complaint.fromJson(Map<String, dynamic> json) => Complaint(
    id: json['id'] as String,
    studentId: json['studentId'] as String,
    subject: json['subject'] as String,
    description: json['description'] as String,
    status: json['status'] as String,
    createdAt: json['createdAt'] as String,
  );
}

class ReportCard {
  const ReportCard({
    required this.id,
    required this.studentId,
    required this.academicSessionId,
    required this.fileId,
    required this.createdAt,
  });

  final String id;
  final String studentId;
  final String academicSessionId;
  final String fileId;
  final String createdAt;

  factory ReportCard.fromJson(Map<String, dynamic> json) => ReportCard(
    id: json['id'] as String,
    studentId: json['studentId'] as String,
    academicSessionId: json['academicSessionId'] as String,
    fileId: json['fileId'] as String,
    createdAt: json['createdAt'] as String,
  );
}
