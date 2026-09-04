import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/api/models.dart';
import 'package:parent_app/src/screens/leave_screen.dart';

const _child = ChildSummary(
  id: 'child-1',
  name: 'Eshaal Sample',
  grNumber: 'GR-1001',
  campus: 'Gulistan-e-Jauhar',
  schoolClass: 'Grade 3',
  section: '3A',
);

void main() {
  testWidgets('submits a leave request and shows it in the past-requests list', (tester) async {
    var submitted = false;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'GET' && request.url.path == '/api/v1/students/child-1/leave-requests') {
          return http.Response(
            jsonEncode(
              submitted
                  ? [
                      {
                        'id': 'lr-1',
                        'studentId': 'child-1',
                        'startDate': '2026-09-05',
                        'endDate': '2026-09-06',
                        'reason': 'Family trip',
                        'status': 'pending',
                      },
                    ]
                  : [],
            ),
            200,
          );
        }
        if (request.method == 'POST' && request.url.path == '/api/v1/leave-requests') {
          submitted = true;
          return http.Response('', 201);
        }
        return http.Response('not found', 404);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: LeaveScreen(accessToken: 'tok', api: api, children: const [_child]),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('No leave requests yet.'), findsOneWidget);

    await tester.tap(find.byKey(const Key('leaveStartDateButton')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('leaveEndDateButton')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('leaveReasonField')), 'Family trip');
    await tester.tap(find.byKey(const Key('leaveSubmitButton')));
    await tester.pumpAndSettle();

    expect(find.text('Leave request submitted.'), findsOneWidget);
    expect(find.text('Family trip'), findsWidgets);
  });
}
