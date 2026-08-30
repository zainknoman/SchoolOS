import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import '../test_harness.dart';

Future<void> _loginWithTwoChildren(WidgetTester tester) async {
  final api = ApiClient(
    baseUrl: 'http://test',
    client: MockClient((request) async {
      if (request.url.path == '/api/v1/auth/login') {
        return http.Response(
          jsonEncode({'accessToken': 'a1', 'refreshToken': 'r1', 'role': 'PARENT'}),
          200,
        );
      }
      if (request.url.path == '/api/v1/me/children') {
        return http.Response(
          jsonEncode([
            {
              'id': 's1',
              'name': 'Eshaal',
              'grNumber': 'GR-1001',
              'campus': 'Gulistan-e-Jauhar',
              'class': 'Grade 3',
              'section': '3A',
            },
            {
              'id': 's2',
              'name': 'Ahmed',
              'grNumber': 'GR-2002',
              'campus': 'Gulshan-e-Iqbal',
              'class': 'Grade 6',
              'section': '6B',
            },
          ]),
          200,
        );
      }
      return http.Response('not found', 404);
    }),
  );

  await tester.pumpWidget(buildTestApp(api: api));
  await tester.pumpAndSettle();
  await tester.enterText(find.byKey(const Key('identifierField')), 'parent-a@seeds.edu.pk');
  await tester.enterText(find.byKey(const Key('passwordField')), 'ChangeMe123!');
  await tester.tap(find.byKey(const Key('submitButton')));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('multi-child switcher lists every linked child and switches the active one', (
    tester,
  ) async {
    await _loginWithTwoChildren(tester);

    expect(find.textContaining('Eshaal'), findsWidgets);

    await tester.tap(find.byKey(const Key('childSwitcher')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ahmed — Grade 6 6B').last);
    await tester.pumpAndSettle();

    expect(find.textContaining('Ahmed'), findsWidgets);
  });

  testWidgets('logging out returns to the login screen', (tester) async {
    await _loginWithTwoChildren(tester);

    await tester.tap(find.byKey(const Key('logoutButton')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('identifierField')), findsOneWidget);
  });

  testWidgets('the Notifications tab shows a badge for unread circulars', (tester) async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.url.path == '/api/v1/auth/login') {
          return http.Response(
            jsonEncode({'accessToken': 'a1', 'refreshToken': 'r1', 'role': 'PARENT'}),
            200,
          );
        }
        if (request.url.path == '/api/v1/me/children') {
          return http.Response(
            jsonEncode([
              {
                'id': 's1',
                'name': 'Eshaal',
                'grNumber': 'GR-1001',
                'campus': 'Gulistan-e-Jauhar',
                'class': 'Grade 3',
                'section': '3A',
              },
            ]),
            200,
          );
        }
        if (request.url.path == '/api/v1/circulars') {
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
                'readAt': null,
              },
            ]),
            200,
          );
        }
        return http.Response('not found', 404);
      }),
    );

    await tester.pumpWidget(buildTestApp(api: api));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('identifierField')), 'parent-a@seeds.edu.pk');
    await tester.enterText(find.byKey(const Key('passwordField')), 'ChangeMe123!');
    await tester.tap(find.byKey(const Key('submitButton')));
    await tester.pumpAndSettle();

    expect(find.text('1'), findsOneWidget);

    await tester.tap(find.text('Notifications'));
    await tester.pumpAndSettle();

    expect(find.text('PTM'), findsOneWidget);
  });

  Future<void> loginSingleChild(WidgetTester tester, http.Client client) async {
    final api = ApiClient(baseUrl: 'http://test', client: client);
    await tester.pumpWidget(buildTestApp(api: api));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('identifierField')), 'parent-a@seeds.edu.pk');
    await tester.enterText(find.byKey(const Key('passwordField')), 'ChangeMe123!');
    await tester.tap(find.byKey(const Key('submitButton')));
    await tester.pumpAndSettle();
  }

  MockClient makeHomeIntegrationClient() {
    return MockClient((request) async {
      if (request.url.path == '/api/v1/auth/login') {
        return http.Response(
          jsonEncode({'accessToken': 'a1', 'refreshToken': 'r1', 'role': 'PARENT'}),
          200,
        );
      }
      if (request.url.path == '/api/v1/me/children') {
        return http.Response(
          jsonEncode([
            {
              'id': 's1',
              'name': 'Eshaal',
              'grNumber': 'GR-1001',
              'campus': 'Gulistan-e-Jauhar',
              'class': 'Grade 3',
              'section': '3A',
            },
          ]),
          200,
        );
      }
      if (request.url.path == '/api/v1/students/s1/attendance') {
        return http.Response(
          jsonEncode({
            'days': [],
            'summary': {
              'present': 18,
              'absent': 1,
              'late': 0,
              'holiday': 0,
              'leave': 0,
              'attendancePercentage': 93,
            },
          }),
          200,
        );
      }
      if (request.url.path == '/api/v1/students/s1/timetable') {
        return http.Response(jsonEncode([]), 200);
      }
      if (request.url.path == '/api/v1/circulars') {
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
              'readAt': null,
            },
          ]),
          200,
        );
      }
      return http.Response('not found', 404);
    });
  }

  testWidgets('Home tab "Timetable" quick-link switches to the Calendar tab', (tester) async {
    await loginSingleChild(tester, makeHomeIntegrationClient());

    await tester.tap(find.byKey(const Key('homeTimetableCard')));
    await tester.pumpAndSettle();

    // CalendarTab's own sub-tab bar has a "Timetable" label — confirms _tabIndex switched to 1
    // and CalendarTab actually rendered (Home's own "Timetable" stat card is gone by now, since
    // the whole body switched away from HomeTab).
    expect(find.text('Timetable'), findsWidgets);
  });

  testWidgets('Home tab "See All" switches to the Notifications tab', (tester) async {
    await loginSingleChild(tester, makeHomeIntegrationClient());

    await tester.ensureVisible(find.byKey(const Key('homeSeeAllAnnouncements')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('homeSeeAllAnnouncements')));
    await tester.pumpAndSettle();

    expect(find.text('PTM'), findsOneWidget);
  });

  testWidgets('tapping a diary notification lands on the Calendar tab\'s Diary sub-tab', (
    tester,
  ) async {
    final client = MockClient((request) async {
      if (request.url.path == '/api/v1/auth/login') {
        return http.Response(
          jsonEncode({'accessToken': 'a1', 'refreshToken': 'r1', 'role': 'PARENT'}),
          200,
        );
      }
      if (request.url.path == '/api/v1/me/children') {
        return http.Response(
          jsonEncode([
            {
              'id': 's1',
              'name': 'Eshaal',
              'grNumber': 'GR-1001',
              'campus': 'Gulistan-e-Jauhar',
              'class': 'Grade 3',
              'section': '3A',
            },
          ]),
          200,
        );
      }
      if (request.url.path == '/api/v1/circulars') {
        return http.Response(jsonEncode([]), 200);
      }
      if (request.url.path == '/api/v1/notifications' && request.method == 'GET') {
        return http.Response(
          jsonEncode([
            {
              'id': 'n1',
              'type': 'diary',
              'title': 'New diary entry',
              'body': 'Homework assigned for Math.',
              'entityRef': 'd1',
              'readAt': null,
              'createdAt': '2026-08-29T00:00:00.000Z',
            },
          ]),
          200,
        );
      }
      if (request.url.path == '/api/v1/notifications/n1/read') {
        return http.Response('', 204);
      }
      if (request.url.path == '/api/v1/students/s1/timetable') {
        return http.Response(jsonEncode([]), 200);
      }
      if (request.url.path == '/api/v1/students/s1/attendance') {
        return http.Response(
          jsonEncode({
            'days': [],
            'summary': {
              'present': 0,
              'absent': 0,
              'late': 0,
              'holiday': 0,
              'leave': 0,
              'attendancePercentage': 0,
            },
          }),
          200,
        );
      }
      if (request.url.path == '/api/v1/students/s1/diary') {
        return http.Response(
          jsonEncode([
            {
              'id': 'd1',
              'date': '2026-08-29',
              'dueDate': null,
              'subject': 'Math',
              'text': 'Complete exercise 4.',
              'attachments': [],
            },
          ]),
          200,
        );
      }
      return http.Response('not found', 404);
    });

    await loginSingleChild(tester, client);

    // First visit Calendar manually via the bottom nav, so its CalendarTab element already
    // exists in the tree (opened on Timetable) BEFORE the notification tap below. This is what
    // actually exercises the fix's `key` change: DefaultTabController caches its controller
    // state per-element, so if the CalendarTab element created here were reused rather than
    // recreated, the notification tap's new initialIndex would be silently ignored and this test
    // would still see Timetable.
    await tester.tap(find.text('Calendar'));
    await tester.pumpAndSettle();
    expect(find.text('No timetable published yet.'), findsOneWidget);

    await tester.tap(find.byKey(const Key('notificationsButton')));
    await tester.pumpAndSettle();

    expect(find.text('New diary entry'), findsOneWidget);

    await tester.tap(find.byKey(const Key('notification-n1')));
    await tester.pumpAndSettle();

    // The bell mapped `type: 'diary'` to the Calendar tab, opened on its Diary sub-tab (not
    // Timetable) — the actual content the notification was about.
    expect(find.text('Complete exercise 4.'), findsOneWidget);
    expect(find.text('No timetable published yet.'), findsNothing);
  });

  testWidgets('tapping a message notification opens that conversation directly, not just the Messages list', (
    tester,
  ) async {
    final client = MockClient((request) async {
      if (request.url.path == '/api/v1/auth/login') {
        return http.Response(
          jsonEncode({'accessToken': 'a1', 'refreshToken': 'r1', 'role': 'PARENT'}),
          200,
        );
      }
      if (request.url.path == '/api/v1/me/children') {
        return http.Response(
          jsonEncode([
            {
              'id': 's1',
              'name': 'Eshaal',
              'grNumber': 'GR-1001',
              'campus': 'Gulistan-e-Jauhar',
              'class': 'Grade 3',
              'section': '3A',
            },
          ]),
          200,
        );
      }
      if (request.url.path == '/api/v1/circulars') {
        return http.Response(jsonEncode([]), 200);
      }
      if (request.url.path == '/api/v1/notifications' && request.method == 'GET') {
        return http.Response(
          jsonEncode([
            {
              'id': 'n1',
              'type': 'message',
              'title': 'New message',
              'body': 'Sure, will send some.',
              'entityRef': 'conv-1',
              'readAt': null,
              'createdAt': '2026-08-29T00:00:00.000Z',
            },
          ]),
          200,
        );
      }
      if (request.url.path == '/api/v1/notifications/n1/read') {
        return http.Response('', 204);
      }
      if (request.url.path == '/api/v1/conversations' && request.method == 'GET') {
        return http.Response(
          jsonEncode([
            {
              'id': 'conv-1',
              'recipientType': 'CLASS_TEACHER',
              'studentId': 's1',
              'otherPartyName': 'Ms. Sample Teacher',
              'lastMessageAt': '2026-08-29T00:00:00.000Z',
              'unread': true,
            },
          ]),
          200,
        );
      }
      if (request.url.path == '/api/v1/conversations/conv-1' && request.method == 'GET') {
        return http.Response(
          jsonEncode({
            'id': 'conv-1',
            'recipientType': 'CLASS_TEACHER',
            'studentId': 's1',
            'messages': [
              {
                'id': 'm1',
                'senderId': 'teacher-1',
                'senderName': 'Ms. Sample Teacher',
                'body': 'Sure, will send some.',
                'createdAt': '2026-08-29T00:00:00.000Z',
              },
            ],
          }),
          200,
        );
      }
      if (request.url.path == '/api/v1/conversations/conv-1/read') {
        return http.Response('', 201);
      }
      return http.Response('not found', 404);
    });

    await loginSingleChild(tester, client);

    await tester.tap(find.byKey(const Key('notificationsButton')));
    await tester.pumpAndSettle();

    expect(find.text('New message'), findsOneWidget);

    await tester.tap(find.byKey(const Key('notification-n1')));
    await tester.pumpAndSettle();

    // Lands directly in the thread (the message body is visible), not on the conversation list.
    expect(find.text('Sure, will send some.'), findsOneWidget);
    expect(find.byKey(const Key('newConversation')), findsNothing);
  });
}
