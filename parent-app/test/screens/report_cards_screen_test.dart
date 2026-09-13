// parent-app/test/screens/report_cards_screen_test.dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/api/models.dart';
import 'package:parent_app/src/screens/report_cards_screen.dart';

const _child = ChildSummary(
  id: 'child-1',
  name: 'Eshaal Sample',
  grNumber: 'GR-1001',
  campus: 'Gulistan-e-Jauhar',
  schoolClass: 'Grade 3',
  section: '3A',
);

const _secondChild = ChildSummary(
  id: 'child-2',
  name: 'Ahmed Sample',
  grNumber: 'GR-2002',
  campus: 'Gulshan-e-Iqbal',
  schoolClass: 'Grade 6',
  section: '6B',
);

void main() {
  testWidgets('shows a loading state, then a student\'s report cards', (tester) async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'GET' && request.url.path == '/api/v1/report-cards') {
          expect(request.url.queryParameters['studentId'], 'child-1');
          return http.Response(
            jsonEncode([
              {
                'id': 'rc1',
                'studentId': 'child-1',
                'academicSessionId': 'sess-1',
                'fileId': 'f1',
                'createdAt': '2026-06-01T00:00:00.000Z',
              },
            ]),
            200,
          );
        }
        return http.Response('not found', 404);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: ReportCardsScreen(accessToken: 'tok', api: api, children: const [_child]),
      ),
    );

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    await tester.pumpAndSettle();

    expect(find.textContaining('Report card — 2026-06-01'), findsOneWidget);
    expect(find.byIcon(Icons.download_outlined), findsOneWidget);
  });

  testWidgets('shows an empty state when there are no report cards', (tester) async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async => http.Response(jsonEncode(<dynamic>[]), 200)),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: ReportCardsScreen(accessToken: 'tok', api: api, children: const [_child]),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('No report cards uploaded yet.'), findsOneWidget);
  });

  testWidgets('defaults to the actively-selected child and reloads on switch', (tester) async {
    String? requestedStudentId;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.url.path == '/api/v1/report-cards') {
          requestedStudentId = request.url.queryParameters['studentId'];
        }
        return http.Response(jsonEncode(<dynamic>[]), 200);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: ReportCardsScreen(
          accessToken: 'tok',
          api: api,
          children: const [_child, _secondChild],
          initialChildId: 'child-2',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(requestedStudentId, 'child-2');

    await tester.tap(find.byKey(const Key('reportCardsChildDropdown')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Eshaal Sample').last);
    await tester.pumpAndSettle();

    expect(requestedStudentId, 'child-1');
  });

  testWidgets('shows a structured grade card when the gradebook has data for this child', (tester) async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.url.path == '/api/v1/report-cards') return http.Response(jsonEncode(<dynamic>[]), 200);
        if (request.url.path.contains('/grades')) {
          return http.Response(
            jsonEncode([
              {
                'subjectId': 'sub-1',
                'subjectName': 'Math',
                'categories': [
                  {'name': 'Quizzes', 'weightPercent': 30, 'obtainedPercent': 90},
                ],
                'finalPercent': 27,
              },
            ]),
            200,
          );
        }
        return http.Response('not found', 404);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(home: ReportCardsScreen(accessToken: 'tok', api: api, children: const [_child])),
    );
    await tester.pumpAndSettle();

    expect(find.text('Math'), findsOneWidget);
    expect(find.textContaining('27%'), findsOneWidget);
  });
}