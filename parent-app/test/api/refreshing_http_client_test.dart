import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/refreshing_http_client.dart';

void main() {
  test('passes through a successful request unchanged', () async {
    final inner = MockClient((request) async => http.Response('ok', 200));
    final client = RefreshingHttpClient(
      inner: inner,
      onUnauthorized: () async => 'should-not-be-called',
    );

    final res = await client.get(
      Uri.parse('http://test/api/v1/me'),
      headers: {'Authorization': 'Bearer old'},
    );

    expect(res.statusCode, 200);
  });

  test('does not intercept a request with no Authorization header', () async {
    var calls = 0;
    final inner = MockClient((request) async {
      calls++;
      return http.Response('unauthorized', 401);
    });
    final client = RefreshingHttpClient(inner: inner, onUnauthorized: () async => 'new-token');

    final res = await client.get(Uri.parse('http://test/api/v1/auth/login'));

    expect(res.statusCode, 401);
    expect(calls, 1);
  });

  test('on a 401, calls onUnauthorized and retries once with the new token', () async {
    var calls = 0;
    String? lastAuthHeader;
    final inner = MockClient((request) async {
      calls++;
      lastAuthHeader = request.headers['Authorization'];
      if (calls == 1) return http.Response('unauthorized', 401);
      return http.Response('ok', 200);
    });
    final client = RefreshingHttpClient(inner: inner, onUnauthorized: () async => 'new-access-token');

    final res = await client.get(
      Uri.parse('http://test/api/v1/me'),
      headers: {'Authorization': 'Bearer expired'},
    );

    expect(res.statusCode, 200);
    expect(calls, 2);
    expect(lastAuthHeader, 'Bearer new-access-token');
  });

  test('returns the original 401 when onUnauthorized fails to refresh', () async {
    var calls = 0;
    final inner = MockClient((request) async {
      calls++;
      return http.Response('unauthorized', 401);
    });
    final client = RefreshingHttpClient(inner: inner, onUnauthorized: () async => null);

    final res = await client.get(
      Uri.parse('http://test/api/v1/me'),
      headers: {'Authorization': 'Bearer expired'},
    );

    expect(res.statusCode, 401);
    expect(calls, 1);
  });

  test('retries a POST with its body intact', () async {
    var calls = 0;
    final bodiesSeen = <String>[];
    final inner = MockClient((request) async {
      calls++;
      bodiesSeen.add(request.body);
      if (calls == 1) return http.Response('unauthorized', 401);
      return http.Response('ok', 200);
    });
    final client = RefreshingHttpClient(inner: inner, onUnauthorized: () async => 'new-token');

    final res = await client.post(
      Uri.parse('http://test/api/v1/attendance'),
      headers: {'Authorization': 'Bearer expired', 'Content-Type': 'application/json'},
      body: jsonEncode({'studentId': 's1'}),
    );

    expect(res.statusCode, 200);
    expect(calls, 2);
    expect(bodiesSeen[1], jsonEncode({'studentId': 's1'}));
  });
}
