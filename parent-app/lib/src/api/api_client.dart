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

  /// A direct, headers-free download link — the backend's JwtStrategy accepts the token as
  /// ?access_token= specifically so links like this (opened via url_launcher) can authenticate.
  Uri fileDownloadUrl(String fileId, String accessToken) =>
      Uri.parse('$baseUrl/api/v1/files/$fileId').replace(queryParameters: {'access_token': accessToken});
}
