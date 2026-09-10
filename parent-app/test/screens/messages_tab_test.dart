import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/api/models.dart';
import 'package:parent_app/src/screens/messages_tab.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  const children = [
    ChildSummary(
      id: 's1',
      name: 'Eshaal',
      grNumber: 'GR-1001',
      campus: 'Gulistan-e-Jauhar',
      schoolClass: 'Grade 3',
      section: '3A',
    ),
    ChildSummary(
      id: 's2',
      name: 'Ahmed',
      grNumber: 'GR-2002',
      campus: 'Gulshan-e-Iqbal',
      schoolClass: 'Grade 6',
      section: '6B',
    ),
  ];

  testWidgets('lists conversations, opens a thread, and starts a new one', (tester) async {
    var conversationStarted = false;
    var replySent = false;
    String? startedForStudentId;

    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'GET' && request.url.path == '/api/v1/conversations') {
          return http.Response(
            jsonEncode(
              conversationStarted
                  ? [
                      {
                        'id': 'conv-1',
                        'recipientType': 'CLASS_TEACHER',
                        'studentId': 's1',
                        'otherPartyName': 'Ms. Sample Teacher',
                        'lastMessageAt': '2026-08-29T00:00:00.000Z',
                        'unread': false,
                      },
                    ]
                  : [],
            ),
            200,
          );
        }
        if (request.method == 'POST' && request.url.path == '/api/v1/conversations') {
          conversationStarted = true;
          startedForStudentId = (jsonDecode(request.body) as Map<String, dynamic>)['studentId'] as String?;
          return http.Response(jsonEncode({'id': 'conv-1'}), 201);
        }
        if (request.method == 'GET' && request.url.path == '/api/v1/conversations/conv-1') {
          return http.Response(
            jsonEncode({
              'id': 'conv-1',
              'recipientType': 'CLASS_TEACHER',
              'studentId': 's1',
              'messages': [
                {
                  'id': 'm1',
                  'senderId': 'parent-1',
                  'senderName': 'Parent A',
                  'body': 'Can Eshaal get extra homework?',
                  'createdAt': '2026-08-29T00:00:00.000Z',
                },
                if (replySent)
                  {
                    'id': 'm2',
                    'senderId': 'teacher-1',
                    'senderName': 'Ms. Sample Teacher',
                    'body': 'Sure thing.',
                    'createdAt': '2026-08-29T01:00:00.000Z',
                  },
              ],
            }),
            200,
          );
        }
        if (request.method == 'POST' && request.url.path == '/api/v1/conversations/conv-1/read') {
          return http.Response('', 201);
        }
        if (request.method == 'POST' &&
            request.url.path == '/api/v1/conversations/conv-1/messages') {
          replySent = true;
          return http.Response('', 201);
        }
        return http.Response('not found', 404);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MessagesTab(accessToken: 'tok', api: api, children: children, activeChildId: 's1'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('No messages yet.'), findsOneWidget);

    await tester.tap(find.byKey(const Key('newConversation')));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('bodyField')), 'Can Eshaal get extra homework?');
    await tester.tap(find.byKey(const Key('sendButton')));
    await tester.pumpAndSettle();

    expect(startedForStudentId, 's1');
    expect(find.text('Ms. Sample Teacher'), findsOneWidget);

    await tester.tap(find.text('Ms. Sample Teacher'));
    await tester.pumpAndSettle();

    expect(find.text('Can Eshaal get extra homework?'), findsOneWidget);
    // Sender name shown above the message body — 'Ms. Sample Teacher' also appears in the
    // conversation list above, so only assert the sender-only 'Parent A' label here.
    expect(find.text('Parent A'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('replyField')), 'Any update?');
    await tester.tap(find.byKey(const Key('sendReplyButton')));
    await tester.pumpAndSettle();

    expect(find.text('Sure thing.'), findsOneWidget);
  });

  testWidgets('initialConversationId opens straight to that thread, skipping the list', (
    tester,
  ) async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'GET' && request.url.path == '/api/v1/conversations') {
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
        if (request.method == 'GET' && request.url.path == '/api/v1/conversations/conv-1') {
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
                  'body': 'Reminder: bring your workbook tomorrow.',
                  'createdAt': '2026-08-29T00:00:00.000Z',
                },
              ],
            }),
            200,
          );
        }
        if (request.method == 'POST' && request.url.path == '/api/v1/conversations/conv-1/read') {
          return http.Response('', 201);
        }
        return http.Response('not found', 404);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MessagesTab(
            accessToken: 'tok',
            api: api,
            children: children,
            activeChildId: 's1',
            initialConversationId: 'conv-1',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Lands directly on the thread — the conversation list ("No messages yet." / the FAB) never
    // shows.
    expect(find.text('Reminder: bring your workbook tomorrow.'), findsOneWidget);
    expect(find.byKey(const Key('newConversation')), findsNothing);
  });

  testWidgets('compose defaults the child picker to the actively-selected child, not children.first', (
    tester,
  ) async {
    String? startedForStudentId;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'GET' && request.url.path == '/api/v1/conversations') {
          return http.Response(jsonEncode(<dynamic>[]), 200);
        }
        if (request.method == 'POST' && request.url.path == '/api/v1/conversations') {
          startedForStudentId = (jsonDecode(request.body) as Map<String, dynamic>)['studentId'] as String?;
          return http.Response(jsonEncode({'id': 'conv-1'}), 201);
        }
        return http.Response('not found', 404);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          // Ahmed (s2) is the active child — the second entry in `children`, not the first.
          body: MessagesTab(accessToken: 'tok', api: api, children: children, activeChildId: 's2'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('newConversation')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('bodyField')), 'About Ahmed');
    await tester.tap(find.byKey(const Key('sendButton')));
    await tester.pumpAndSettle();

    expect(startedForStudentId, 's2');
  });

    testWidgets(
    'falls back to cached conversations with a Last updated timestamp when the live fetch fails',
    (tester) async {
      final cachedAt = DateTime.now().subtract(const Duration(hours: 1));
      SharedPreferences.setMockInitialValues({
        'cache:conversations': jsonEncode({
          'fetchedAt': cachedAt.toIso8601String(),
          'data': [
            {
              'id': 'conv-1',
              'recipientType': 'CLASS_TEACHER',
              'studentId': 's1',
              'otherPartyName': 'Cached Teacher',
              'lastMessageAt': '2026-08-29T00:00:00.000Z',
              'unread': false,
            },
          ],
        }),
      });
      final api = ApiClient(
        baseUrl: 'http://test',
        client: MockClient((request) async => http.Response('server down', 500)),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MessagesTab(accessToken: 'tok', api: api, children: children, activeChildId: 's1'),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Cached Teacher'), findsOneWidget);
      expect(find.textContaining('Last updated'), findsOneWidget);
    },
  );
}