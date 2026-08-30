import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/screens/notifications_sheet.dart';

void main() {
  testWidgets('lists notifications and reports the tapped type after marking it read', (tester) async {
    var markedRead = false;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'GET' && request.url.path == '/api/v1/notifications') {
          return http.Response(
            jsonEncode([
              {
                'id': 'n1',
                'type': 'message',
                'title': 'New reply',
                'body': 'Sure thing.',
                'entityRef': 'conv-1',
                'readAt': markedRead ? '2026-08-29T01:00:00.000Z' : null,
                'createdAt': '2026-08-29T00:00:00.000Z',
              },
            ]),
            200,
          );
        }
        if (request.method == 'POST' && request.url.path == '/api/v1/notifications/n1/read') {
          markedRead = true;
          return http.Response('', 201);
        }
        return http.Response('not found', 404);
      }),
    );

    String? openedType;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: NotificationsSheet(accessToken: 'tok', api: api, onOpenType: (t) => openedType = t),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('New reply'), findsOneWidget);

    await tester.tap(find.byKey(const Key('notification-n1')));
    await tester.pumpAndSettle();

    expect(markedRead, true);
    expect(openedType, 'message');
  });

  testWidgets('"Mark all read" calls the bulk endpoint', (tester) async {
    var markedAllRead = false;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'GET' && request.url.path == '/api/v1/notifications') {
          return http.Response(
            jsonEncode([
              {
                'id': 'n1',
                'type': 'message',
                'title': 'New reply',
                'body': 'Sure thing.',
                'entityRef': 'conv-1',
                'readAt': null,
                'createdAt': '2026-08-29T00:00:00.000Z',
              },
            ]),
            200,
          );
        }
        if (request.method == 'POST' && request.url.path == '/api/v1/notifications/read-all') {
          markedAllRead = true;
          return http.Response('', 201);
        }
        return http.Response('not found', 404);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: NotificationsSheet(accessToken: 'tok', api: api, onOpenType: (_) {}),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('markAllRead')));
    await tester.pumpAndSettle();

    expect(markedAllRead, true);
  });
}
