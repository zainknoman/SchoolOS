import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/screens/circulars_tab.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('lists circulars, marks one read on tap, and reports the new unread count', (
    tester,
  ) async {
    var readCalled = false;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'GET' && request.url.path == '/api/v1/circulars') {
          return http.Response(
            jsonEncode([
              {
                'id': 'c1',
                'title': 'PTM',
                'description': 'PTM in September.',
                'scope': 'school',
                'priority': 'normal',
                'publishedAt': '2026-08-01T00:00:00.000Z',
                'expiresAt': null,
                'attachments': [],
                'readAt': readCalled ? '2026-08-27T00:00:00.000Z' : null,
              },
            ]),
            200,
          );
        }
        if (request.method == 'POST' && request.url.path == '/api/v1/circulars/c1/read') {
          readCalled = true;
          return http.Response('', 201);
        }
        return http.Response('not found', 404);
      }),
    );

    int? lastUnreadCount;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CircularsTab(
            accessToken: 'tok',
            api: api,
            onUnreadChanged: (count) => lastUnreadCount = count,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('PTM'), findsOneWidget);
    expect(lastUnreadCount, 1);

    await tester.tap(find.text('PTM'));
    await tester.pumpAndSettle();

    expect(readCalled, true);
    expect(lastUnreadCount, 0);
  });

  testWidgets(
    'falls back to cached circulars with a Last updated timestamp when the live fetch fails',
    (tester) async {
      final cachedAt = DateTime.now().subtract(const Duration(hours: 3));
      SharedPreferences.setMockInitialValues({
        'cache:circulars': jsonEncode({
          'fetchedAt': cachedAt.toIso8601String(),
          'data': [
            {
              'id': 'c1',
              'title': 'Cached Circular',
              'description': 'From cache.',
              'scope': 'school',
              'priority': 'normal',
              'publishedAt': '2026-08-01T00:00:00.000Z',
              'expiresAt': null,
              'attachments': [],
              'readAt': null,
            },
          ],
        }),
      });
      final api = ApiClient(
        baseUrl: 'http://test',
        client: MockClient((request) async => http.Response('server down', 500)),
      );

      await tester.pumpWidget(
        MaterialApp(home: Scaffold(body: CircularsTab(accessToken: 'tok', api: api))),
      );
      await tester.pumpAndSettle();

      expect(find.text('Cached Circular'), findsOneWidget);
      expect(find.textContaining('Last updated'), findsOneWidget);
    },
  );
}
