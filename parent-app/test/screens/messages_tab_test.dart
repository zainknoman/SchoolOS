import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/api/models.dart';
import 'package:parent_app/src/screens/messages_tab.dart';

void main() {
  const children = [
    ChildSummary(
      id: 's1',
      name: 'Eshaal',
      grNumber: 'GR-1001',
      campus: 'Gulistan-e-Jauhar',
      schoolClass: 'Grade 3',
      section: '3A',
    ),
  ];

  testWidgets('lists conversations, opens a thread, and starts a new one', (tester) async {
    var conversationStarted = false;
    var replySent = false;

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
                  'body': 'Can Eshaal get extra homework?',
                  'createdAt': '2026-08-29T00:00:00.000Z',
                },
                if (replySent)
                  {
                    'id': 'm2',
                    'senderId': 'teacher-1',
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
          body: MessagesTab(accessToken: 'tok', api: api, children: children),
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

    expect(find.text('Ms. Sample Teacher'), findsOneWidget);

    await tester.tap(find.text('Ms. Sample Teacher'));
    await tester.pumpAndSettle();

    expect(find.text('Can Eshaal get extra homework?'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('replyField')), 'Any update?');
    await tester.tap(find.byKey(const Key('sendReplyButton')));
    await tester.pumpAndSettle();

    expect(find.text('Sure thing.'), findsOneWidget);
  });
}
