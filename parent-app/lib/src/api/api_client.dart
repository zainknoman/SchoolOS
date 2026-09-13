import 'dart:convert';
import 'package:http/http.dart' as http;
import 'models.dart';

class ApiException implements Exception {
  ApiException(this.message, this.statusCode);
  final String message;
  final int statusCode;

  @override
  String toString() => message;
}

/// Matches the backend's dev/test-only default (see resolveStubWebhookSecret in
/// backend/src/fees/gateways/gateway-config.ts). Only ever reaches a real deployment's webhook
/// route if that route is somehow left wired up outside dev/test — which the backend's own
/// fail-fast on PAYMENT_STUB_WEBHOOK_SECRET is designed to prevent.
const stubWebhookSecret = 'dev-only-stub-webhook-secret';

/// Thin wrapper over the shared SEEDS backend — the same `/api/v1` contract the staff console
/// calls. Takes an injected [http.Client] so tests can supply `MockClient` instead of hitting a
/// real server.
class ApiClient {
  ApiClient({required this.baseUrl, http.Client? client}) : _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;

  String _errorMessage(http.Response res) {
    try {
      final body = jsonDecode(res.body);
      if (body is Map && body['message'] is String) return body['message'] as String;
      if (body is Map && body['message'] is List) {
        return (body['message'] as List).join(', ');
      }
    } catch (_) {
      // response wasn't JSON — fall through to the generic message below
    }
    return 'Something went wrong. Please try again.';
  }

  Future<dynamic> _get(String path, String accessToken) async {
    final res = await _client.get(
      Uri.parse('$baseUrl$path'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }
    return jsonDecode(res.body);
  }

  Future<LoginResponse> login(String identifier, String password) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/v1/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'identifier': identifier, 'password': password}),
    );

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }

    return LoginResponse.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
  }

  Future<LoginResponse> refresh(String refreshToken) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/v1/auth/refresh'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'refreshToken': refreshToken}),
    );

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }

    return LoginResponse.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
  }

  Future<List<ChildSummary>> meChildren(String accessToken) async {
    final list = await _get('/api/v1/me/children', accessToken) as List<dynamic>;
    return list.map((e) => ChildSummary.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<TimetableEntry>> timetable(String accessToken, String studentId) async {
    final list = await _get('/api/v1/students/$studentId/timetable', accessToken) as List<dynamic>;
    return list.map((e) => TimetableEntry.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<AttendanceReport> attendance(String accessToken, String studentId, String month) async {
    final json =
        await _get('/api/v1/students/$studentId/attendance?month=$month', accessToken)
            as Map<String, dynamic>;
    return AttendanceReport.fromJson(json);
  }

  Future<List<DiaryEntry>> diary(String accessToken, String studentId, String month) async {
    final list =
        await _get('/api/v1/students/$studentId/diary?month=$month', accessToken) as List<dynamic>;
    return list.map((e) => DiaryEntry.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<CircularSummary>> circulars(String accessToken) async {
    final list = await _get('/api/v1/circulars', accessToken) as List<dynamic>;
    return list.map((e) => CircularSummary.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> markCircularRead(String accessToken, String circularId) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/v1/circulars/$circularId/read'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }
  }

  Future<List<ConversationSummary>> conversations(String accessToken, {String? q}) async {
    final path = (q == null || q.isEmpty)
        ? '/api/v1/conversations'
        : '/api/v1/conversations?q=${Uri.encodeQueryComponent(q)}';
    final list = await _get(path, accessToken) as List<dynamic>;
    return list.map((e) => ConversationSummary.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<ConversationDetail> conversation(String accessToken, String id) async {
    final json = await _get('/api/v1/conversations/$id', accessToken) as Map<String, dynamic>;
    return ConversationDetail.fromJson(json);
  }

  Future<void> startConversation(
    String accessToken, {
    required String recipientType,
    String? studentId,
    required String body,
  }) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/v1/conversations'),
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $accessToken'},
      body: jsonEncode({
        'recipientType': recipientType,
        'studentId': ?studentId,
        'body': body,
      }),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }
  }

  Future<void> sendMessage(String accessToken, String conversationId, String body) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/v1/conversations/$conversationId/messages'),
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $accessToken'},
      body: jsonEncode({'body': body}),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }
  }

  Future<void> markConversationRead(String accessToken, String conversationId) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/v1/conversations/$conversationId/read'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }
  }

  Future<List<NotificationSummary>> notifications(String accessToken) async {
    final list = await _get('/api/v1/notifications', accessToken) as List<dynamic>;
    return list.map((e) => NotificationSummary.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> markNotificationRead(String accessToken, String id) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/v1/notifications/$id/read'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }
  }

  Future<void> markAllNotificationsRead(String accessToken) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/v1/notifications/read-all'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }
  }

  Future<void> registerDeviceToken(String accessToken, String token, String platform) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/v1/me/device-tokens'),
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $accessToken'},
      body: jsonEncode({'token': token, 'platform': platform}),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }
  }

  /// Partial update — omit whichever field isn't changing so the backend leaves it untouched.
  Future<void> updateNotificationPreferences(
    String accessToken, {
    String? channel,
    bool? digestEnabled,
  }) async {
    final res = await _client.patch(
      Uri.parse('$baseUrl/api/v1/me/notification-preferences'),
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $accessToken'},
      body: jsonEncode({
        'channel': ?channel,
        'digestEnabled': ?digestEnabled,
      }),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }
  }


  /// A direct, headers-free download link — the backend's JwtStrategy accepts the token as
  /// ?access_token= specifically so links like this (opened via url_launcher) can authenticate.
  Uri fileDownloadUrl(String fileId, String accessToken) =>
      Uri.parse('$baseUrl/api/v1/files/$fileId').replace(queryParameters: {'access_token': accessToken});

  Future<List<FeeVoucherSummary>> studentFees(String accessToken, String studentId) async {
    final list = await _get('/api/v1/students/$studentId/fees', accessToken) as List<dynamic>;
    return list.map((e) => FeeVoucherSummary.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<FeePaymentSummary>> studentFeePayments(String accessToken, String studentId) async {
    final list =
        await _get('/api/v1/students/$studentId/fees/payments', accessToken) as List<dynamic>;
    return list.map((e) => FeePaymentSummary.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<PaymentInitiation> payVoucher(String accessToken, String voucherId, String method) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/v1/fee-vouchers/$voucherId/pay'),
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $accessToken'},
      body: jsonEncode({'method': method}),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }
    return PaymentInitiation.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
  }

  /// Simulates a real gateway's webhook call for the stub gateway only — local dev/tests have no
  /// real JazzCash/EasyPaisa server to receive a checkout and call the webhook itself, so this
  /// plays that role instead, going through the exact same signature-checked backend route a
  /// real gateway would hit.
  Future<void> completeStubPayment(String reference) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/v1/payments/webhook/stub'),
      headers: {'Content-Type': 'application/json', 'x-stub-signature': stubWebhookSecret},
      body: jsonEncode({'reference': reference, 'status': 'completed'}),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }
  }

  Future<FeePaymentSummary> getPayment(String accessToken, String paymentId) async {
    final json = await _get('/api/v1/fee-payments/$paymentId', accessToken) as Map<String, dynamic>;
    return FeePaymentSummary.fromJson(json);
  }

  Uri voucherPdfUrl(String voucherId, String accessToken) => Uri.parse(
    '$baseUrl/api/v1/fee-vouchers/$voucherId/pdf',
  ).replace(queryParameters: {'access_token': accessToken});

  Uri receiptPdfUrl(String paymentId, String accessToken) => Uri.parse(
    '$baseUrl/api/v1/fee-payments/$paymentId/receipt.pdf',
  ).replace(queryParameters: {'access_token': accessToken});

  Future<List<LeaveRequestSummary>> leaveRequests(String accessToken, String studentId) async {
    final list =
        await _get('/api/v1/students/$studentId/leave-requests', accessToken) as List<dynamic>;
    return list.map((e) => LeaveRequestSummary.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> submitLeaveRequest(
    String accessToken, {
    required String studentId,
    required String startDate,
    required String endDate,
    required String reason,
  }) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/v1/leave-requests'),
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $accessToken'},
      body: jsonEncode({
        'studentId': studentId,
        'startDate': startDate,
        'endDate': endDate,
        'reason': reason,
      }),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }
  }

  Future<void> forgotPassword(String identifier) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/v1/auth/forgot-password'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'identifier': identifier}),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }
  }

  Future<void> resetPassword(String token, String newPassword) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/v1/auth/reset-password'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'token': token, 'newPassword': newPassword}),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }
  }

  // No campusId is passed here — ChildSummary only exposes the campus's display name, not its
  // id, so this reads every holiday rather than scoping to the child's own campus. Holidays
  // aren't per-student PII, so the over-broad read is a safe, documented trade-off.
  Future<List<Holiday>> holidays(String accessToken, {String? from, String? to}) async {
    final query = <String, String>{'from': ?from, 'to': ?to};
    final path = query.isEmpty
        ? '/api/v1/holidays'
        : '/api/v1/holidays?${Uri(queryParameters: query).query}';
    final list = await _get(path, accessToken) as List<dynamic>;
    return list.map((e) => Holiday.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<Complaint>> complaints(String accessToken, String studentId) async {
    final list =
        await _get('/api/v1/complaints?studentId=${Uri.encodeQueryComponent(studentId)}', accessToken)
            as List<dynamic>;
    return list.map((e) => Complaint.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<ReportCard>> reportCards(String accessToken, String studentId) async {
    final list =
        await _get('/api/v1/report-cards?studentId=${Uri.encodeQueryComponent(studentId)}', accessToken)
            as List<dynamic>;
    return list.map((e) => ReportCard.fromJson(e as Map<String, dynamic>)).toList();
  }

  Uri reportCardPdfUrl(String reportCardId, String accessToken) => Uri.parse(
    '$baseUrl/api/v1/report-cards/$reportCardId/pdf',
  ).replace(queryParameters: {'access_token': accessToken});

  Future<List<SubjectGrade>> studentGrades(String accessToken, String studentId, String termId) async {
    final list = await _get(
      '/api/v1/students/$studentId/grades?termId=${Uri.encodeQueryComponent(termId)}',
      accessToken,
    ) as List<dynamic>;
    return list.map((e) => SubjectGrade.fromJson(e as Map<String, dynamic>)).toList();
  }
}
