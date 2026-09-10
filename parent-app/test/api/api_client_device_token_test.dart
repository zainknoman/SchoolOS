import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';

void main() {
  test('registerDeviceToken posts the token and platform with auth header', () async {
    Map<String, dynamic>? sentBody;
    String? sentAuth;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        sentBody = jsonDecode(request.body) as Map<String, dynamic>;
        sentAuth = request.headers['Authorization'];
        return http.Response('', 201);
      }),
    );

    await api.registerDeviceToken('tok-access', 'fcm-abc', 'android');

    expect(sentBody, {'token': 'fcm-abc', 'platform': 'android'});
    expect(sentAuth, 'Bearer tok-access');
  });

  test('registerDeviceToken throws ApiException on a non-2xx response', () async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        return http.Response(jsonEncode({'message': 'Bad platform'}), 400);
      }),
    );

    expect(
      () => api.registerDeviceToken('tok-access', 'fcm-abc', 'windows-phone'),
      throwsA(isA<ApiException>()),
    );
  });
}