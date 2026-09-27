import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/screens/reset_password_screen.dart';
import '../test_harness.dart';

void main() {
  testWidgets('BL-35: the e-mailed link opens the reset screen with the code filled in and resets '
      'through the parent endpoint', (tester) async {
    Map<String, dynamic>? body;
    String? path;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'POST' && request.url.path.endsWith('reset-password')) {
          path = request.url.path;
          body = jsonDecode(request.body) as Map<String, dynamic>;
          return http.Response(jsonEncode({'message': 'ok'}), 201);
        }
        return http.Response('not found', 404);
      }),
    );
    await tester.pumpWidget(buildTestApp(api: api));
    await tester.pumpAndSettle();

    // Signed out: the deep-link location (what Android hands the router) is allowed through.
    GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/reset-password?token=abc123');
    await tester.pumpAndSettle();
    expect(find.byType(ResetPasswordScreen), findsOneWidget);
    expect(find.widgetWithText(TextField, 'abc123'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('newPasswordField')), 'NewHorseBattery9!');
    await tester.tap(find.byKey(const Key('resetSubmitButton')));
    await tester.pumpAndSettle();
    expect(path, '/api/v1/auth/parent/reset-password');
    expect(body, {'token': 'abc123', 'newPassword': 'NewHorseBattery9!'});
    expect(find.byKey(const Key('resetPasswordMessage')), findsOneWidget);
  });

  testWidgets('BL-35: "Forgot password" uses the parent flow', (tester) async {
    String? path;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        path = request.url.path;
        return http.Response(jsonEncode({'message': 'ok'}), 201);
      }),
    );
    await api.forgotPassword('03001234567');
    expect(path, '/api/v1/auth/parent/forgot-password');
  });
}
