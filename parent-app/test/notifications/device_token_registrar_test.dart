import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/notifications/device_token_registrar.dart';
import 'package:parent_app/src/notifications/notification_target.dart';
import 'package:parent_app/src/notifications/push_token_provider.dart';

class _FakeTokenProvider implements PushTokenProvider {
  _FakeTokenProvider(this._token);
  final String? _token;

  @override
  Future<String?> getToken() async => _token;

  @override
  Stream<NotificationTarget> get onNotificationTapped => const Stream.empty();
}

void main() {
  test('registers the token against /me/device-tokens when a token is available', () async {
    Map<String, dynamic>? sentBody;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        sentBody = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response('', 201);
      }),
    );
    final registrar = DeviceTokenRegistrar(api: api, tokenProvider: _FakeTokenProvider('fcm-xyz'));

    await registrar.registerIfPossible('access-tok');

    expect(sentBody, isNotNull);
    expect(sentBody!['token'], 'fcm-xyz');
    // The registrar runs under flutter_test's default target platform, which is Android unless a
    // test overrides debugDefaultTargetPlatformOverride — see home_shell_test.dart for the case
    // that matters in practice.
    expect(sentBody!['platform'], 'android');
  });

  test('makes no API call when the token provider has no token yet', () async {
    var called = false;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        called = true;
        return http.Response('', 201);
      }),
    );
    final registrar = DeviceTokenRegistrar(api: api, tokenProvider: _FakeTokenProvider(null));

    await registrar.registerIfPossible('access-tok');

    expect(called, isFalse);
  });

  test('a registration failure is swallowed, not rethrown (best-effort convenience only)', () async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async => http.Response('server error', 500)),
    );
    final registrar = DeviceTokenRegistrar(api: api, tokenProvider: _FakeTokenProvider('fcm-xyz'));

    await expectLater(registrar.registerIfPossible('access-tok'), completes);
  });
}