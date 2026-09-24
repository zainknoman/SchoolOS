import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import '../test_harness.dart';

/// BL-21/BL-64: a parent signing in with an admin-issued temporary password is held on the
/// change-password screen until they choose their own password.
void main() {
  ApiClient api({required List<http.Request> calls}) => ApiClient(
    baseUrl: 'http://test',
    client: MockClient((request) async {
      calls.add(request);
      if (request.url.path == '/api/v1/auth/login') {
        return http.Response(
          jsonEncode({'accessToken': 'a1', 'refreshToken': 'r1', 'role': 'PARENT', 'mustChangePassword': true}),
          201,
        );
      }
      if (request.url.path == '/api/v1/auth/change-password') {
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        if (body['currentPassword'] != 'Temp-Pass-123') {
          return http.Response(jsonEncode({'message': 'Invalid credentials'}), 401);
        }
        return http.Response(
          jsonEncode({'accessToken': 'a2', 'refreshToken': 'r2', 'role': 'PARENT', 'mustChangePassword': false}),
          201,
        );
      }
      if (request.url.path == '/api/v1/me/children') {
        return http.Response(jsonEncode([]), 200);
      }
      return http.Response(jsonEncode({'statusCode': 404}), 404);
    }),
  );

  Future<void> signIn(WidgetTester tester) async {
    await tester.enterText(find.byKey(const Key('identifierField')), 'parent-a@schoolos.edu.pk');
    await tester.enterText(find.byKey(const Key('passwordField')), 'Temp-Pass-123');
    await tester.tap(find.byKey(const Key('submitButton')));
    await tester.pumpAndSettle();
  }

  testWidgets('a temporary password leads to the change-password screen, not home', (tester) async {
    final calls = <http.Request>[];
    await tester.pumpWidget(buildTestApp(api: api(calls: calls)));
    await tester.pumpAndSettle();
    await signIn(tester);

    expect(find.text('Set a new password'), findsOneWidget);
    expect(find.text('Calendar'), findsNothing);
  });

  testWidgets('validates locally before calling the API', (tester) async {
    final calls = <http.Request>[];
    await tester.pumpWidget(buildTestApp(api: api(calls: calls)));
    await tester.pumpAndSettle();
    await signIn(tester);

    await tester.enterText(find.byKey(const Key('currentPasswordField')), 'Temp-Pass-123');
    await tester.enterText(find.byKey(const Key('newPasswordField')), 'MyOwnPass9');
    await tester.enterText(find.byKey(const Key('confirmPasswordField')), 'Different9');
    await tester.tap(find.byKey(const Key('changePasswordSubmit')));
    await tester.pumpAndSettle();

    expect(find.text('The new passwords do not match.'), findsOneWidget);
    expect(calls.where((r) => r.url.path == '/api/v1/auth/change-password'), isEmpty);
  });

  testWidgets('shows the server error for a wrong temporary password', (tester) async {
    final calls = <http.Request>[];
    await tester.pumpWidget(buildTestApp(api: api(calls: calls)));
    await tester.pumpAndSettle();
    await signIn(tester);

    await tester.enterText(find.byKey(const Key('currentPasswordField')), 'wrong-temp');
    await tester.enterText(find.byKey(const Key('newPasswordField')), 'MyOwnPass9');
    await tester.enterText(find.byKey(const Key('confirmPasswordField')), 'MyOwnPass9');
    await tester.tap(find.byKey(const Key('changePasswordSubmit')));
    await tester.pumpAndSettle();

    expect(find.text('Invalid credentials'), findsOneWidget);
    expect(find.text('Set a new password'), findsOneWidget);
  });

  testWidgets('a successful change lands on home with the new session', (tester) async {
    final calls = <http.Request>[];
    await tester.pumpWidget(buildTestApp(api: api(calls: calls)));
    await tester.pumpAndSettle();
    await signIn(tester);

    await tester.enterText(find.byKey(const Key('currentPasswordField')), 'Temp-Pass-123');
    await tester.enterText(find.byKey(const Key('newPasswordField')), 'MyOwnPass9');
    await tester.enterText(find.byKey(const Key('confirmPasswordField')), 'MyOwnPass9');
    await tester.tap(find.byKey(const Key('changePasswordSubmit')));
    await tester.pumpAndSettle();

    expect(find.text('Set a new password'), findsNothing);
    expect(find.text('Calendar'), findsOneWidget);
    final children = calls.lastWhere((r) => r.url.path == '/api/v1/me/children');
    expect(children.headers['Authorization'], 'Bearer a2');
  });
}
