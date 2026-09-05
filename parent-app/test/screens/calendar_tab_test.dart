import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/screens/calendar_tab.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  ApiClient makeClient() {
    return ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.url.path == '/api/v1/students/s1/timetable') {
          return http.Response(
            jsonEncode([
              {
                'dayOfWeek': 1,
                'period': 1,
                'startTime': '08:00',
                'endTime': '08:40',
                'subject': 'English',
                'teacher': 'Ms. Sample',
                'room': '3A',
              },
              {
                'dayOfWeek': 1,
                'period': 2,
                'startTime': '08:40',
                'endTime': '09:20',
                'subject': 'Math',
                'teacher': null,
                'room': null,
              },
              // Period 3 is intentionally absent — the real gap between period 2's end
              // (09:20) and period 4's start (10:00) is what should produce a BREAK column,
              // not a missing period number by itself.
              {
                'dayOfWeek': 1,
                'period': 4,
                'startTime': '10:00',
                'endTime': '10:40',
                'subject': 'Science',
                'teacher': null,
                'room': null,
              },
            ]),
            200,
          );
        }
        if (request.url.path == '/api/v1/students/s1/attendance') {
          return http.Response(
            jsonEncode({
              'days': [
                {'date': '2026-08-27', 'status': 'PRESENT'},
              ],
              'summary': {
                'present': 18,
                'absent': 2,
                'late': 1,
                'holiday': 0,
                'leave': 0,
                'attendancePercentage': 86,
              },
            }),
            200,
          );
        }
        return http.Response('not found', 404);
      }),
    );
  }

  testWidgets(
    'Timetable tab renders a weekly grid: period columns, an auto-detected break column, '
    'and holiday rows for days with no periods',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(body: CalendarTab(studentId: 's1', accessToken: 'tok', api: makeClient())),
        ),
      );
      await tester.pumpAndSettle();

      // Column headers come from the actual period numbers present in the data (1, 2, 4 — no
      // period 3 exists), with a BREAK column auto-inserted wherever there's a >10-minute gap
      // between two consecutive periods' times (here: 09:20 end of P2 to 10:00 start of P4).
      expect(find.text('P1'), findsOneWidget);
      expect(find.text('P2'), findsOneWidget);
      expect(find.text('P4'), findsOneWidget);
      expect(find.text('P3'), findsNothing);
      expect(find.text('BREAK'), findsNWidgets(2)); // header + Monday's row

      // Header time ranges.
      expect(find.textContaining('08:00'), findsWidgets);
      expect(find.textContaining('09:20'), findsWidgets);

      // Monday's row has the right subjects under the right period columns.
      expect(find.text('English'), findsOneWidget);
      expect(find.text('Math'), findsOneWidget);
      expect(find.text('Science'), findsOneWidget);

      // Every other day of the week (6 of them) renders as a single merged HOLIDAY row,
      // not omitted and not shown as empty period cells.
      expect(find.text('HOLIDAY'), findsNWidgets(6));
    },
  );

  testWidgets('Attendance tab shows the percentage and today\'s status', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: CalendarTab(studentId: 's1', accessToken: 'tok', api: makeClient())),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Attendance'));
    await tester.pumpAndSettle();

    expect(find.textContaining('86%'), findsOneWidget);
    expect(find.textContaining('18'), findsWidgets);
    expect(find.byKey(const Key('attendanceDay2026-08-27')), findsOneWidget);
  });

  testWidgets('Diary tab shows the structured entry, direction-aware', (tester) async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
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
                'date': '2026-08-27',
                'dueDate': '2026-08-29',
                'subject': 'Urdu',
                'text': 'کتاب لائیں',
                'attachments': [],
              },
            ]),
            200,
            // http.Response defaults to latin1 for a body without an explicit content-type
            // (matching RFC 2616), which can't encode the Urdu text below — a real backend
            // always sends `application/json`, so the mock does too, to get the UTF-8 decoding
            // that implies.
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('not found', 404);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(home: Scaffold(body: CalendarTab(studentId: 's1', accessToken: 'tok', api: api))),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Diary'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Urdu'), findsOneWidget);
    expect(find.text('کتاب لائیں'), findsOneWidget);
    expect(find.byKey(const Key('diaryEntryd1')), findsOneWidget);
  });

  testWidgets(
    'Timetable tab falls back to cached data with a Last updated timestamp when the '
    'live fetch fails, instead of going blank',
    (tester) async {
      final cachedAt = DateTime.now().subtract(const Duration(hours: 2));
      SharedPreferences.setMockInitialValues({
        'cache:timetable:s1': jsonEncode({
          'fetchedAt': cachedAt.toIso8601String(),
          'data': [
            {
              'dayOfWeek': 1,
              'period': 1,
              'startTime': '08:00',
              'endTime': '08:40',
              'subject': 'Cached Subject',
              'teacher': null,
              'room': null,
            },
          ],
        }),
      });
      final api = ApiClient(
        baseUrl: 'http://test',
        client: MockClient((request) async => http.Response('server down', 500)),
      );

      await tester.pumpWidget(
        MaterialApp(home: Scaffold(body: CalendarTab(studentId: 's1', accessToken: 'tok', api: api))),
      );
      await tester.pumpAndSettle();

      expect(find.text('Cached Subject'), findsOneWidget);
      expect(find.textContaining('Last updated'), findsOneWidget);
    },
  );

  testWidgets(
    'Attendance tab falls back to cached data with a Last updated timestamp when the '
    'live fetch fails',
    (tester) async {
      final cachedAt = DateTime.now().subtract(const Duration(hours: 1));
      SharedPreferences.setMockInitialValues({
        'cache:attendance:s1:${DateTime.now().toIso8601String().substring(0, 7)}': jsonEncode({
          'fetchedAt': cachedAt.toIso8601String(),
          'data': {
            'days': [
              {'date': '2026-08-27', 'status': 'PRESENT'},
            ],
            'summary': {
              'present': 5,
              'absent': 0,
              'late': 0,
              'holiday': 0,
              'leave': 0,
              'attendancePercentage': 100,
            },
          },
        }),
      });
      final api = ApiClient(
        baseUrl: 'http://test',
        client: MockClient((request) async => http.Response('server down', 500)),
      );

      await tester.pumpWidget(
        MaterialApp(home: Scaffold(body: CalendarTab(studentId: 's1', accessToken: 'tok', api: api))),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Attendance'));
      await tester.pumpAndSettle();

      expect(find.textContaining('100%'), findsOneWidget);
      expect(find.textContaining('Last updated'), findsOneWidget);
    },
  );
}
