// parent-app/test/screens/complaints_screen_test.dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/api/models.dart';
import 'package:parent_app/src/screens/complaints_screen.dart';

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
  testWidgets('shows a loading state, then a student\'s complaints', (tester) async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'GET' && request.url.path == '/api/v1/complaints') {
          expect(request.url.queryParameters['studentId'], 'child-1');
          return http.Response(
            jsonEncode([
              {
                'id': 'cm1',
                'studentId': 'child-1',
                'subject': 'Late pickup',
                'description': 'Repeated late pickup',
                'status': 'open',
                'createdAt': '2026-09-01T00:00:00.000Z',
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
        home: ComplaintsScreen(accessToken: 'tok', api: api, children: const [_child]),
      ),
    );

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    await tester.pumpAndSettle();

    expect(find.text('Late pickup'), findsOneWidget);
    expect(find.text('Repeated late pickup'), findsOneWidget);
    expect(find.text('open'), findsOneWidget);
  });

  testWidgets('shows an empty state when there are no complaints', (tester) async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async => http.Response(jsonEncode(<dynamic>[]), 200)),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: ComplaintsScreen(accessToken: 'tok', api: api, children: const [_child]),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('No complaints on record.'), findsOneWidget);
  });

  testWidgets('defaults to the actively-selected child and reloads on switch', (tester) async {
    String? requestedStudentId;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        requestedStudentId = request.url.queryParameters['studentId'];
        return http.Response(jsonEncode(<dynamic>[]), 200);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: ComplaintsScreen(
          accessToken: 'tok',
          api: api,
          children: const [_child, _secondChild],
          initialChildId: 'child-2',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(requestedStudentId, 'child-2');

    await tester.tap(find.byKey(const Key('complaintsChildDropdown')));
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining('Eshaal Sample').last);
    await tester.pumpAndSettle();

    expect(requestedStudentId, 'child-1');
  });
}