import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/api/models.dart';
import 'package:parent_app/src/screens/home_tab.dart';

void main() {
  ApiClient makeClient() {
    return ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
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
        if (request.url.path == '/api/v1/students/s1/fees') {
          return http.Response(
            jsonEncode([
              {
                'id': 'v1',
                'studentId': 's1',
                'month': '2026-09',
                'dueDate': '2026-09-10',
                'items': [
                  {'label': 'Tuition Fee', 'amount': 500000},
                ],
                'totalAmount': 500000,
                'amountPaid': 0,
                'amountDue': 500000,
                'status': 'unpaid',
              },
              {
                'id': 'v2',
                'studentId': 's1',
                'month': '2026-08',
                'dueDate': '2026-08-10',
                'items': [
                  {'label': 'Tuition Fee', 'amount': 500000},
                ],
                'totalAmount': 500000,
                'amountPaid': 500000,
                'amountDue': 0,
                'status': 'paid',
              },
            ]),
            200,
          );
        }
        return http.Response('not found', 404);
      }),
    );
  }

  final sampleCirculars = [
    const CircularSummary(
      id: 'c1',
      title: 'Independence Day Holiday',
      description: 'School will remain closed on 14-Aug-2026.',
      scope: 'school',
      priority: 'normal',
      publishedAt: '2026-08-25T00:00:00.000Z',
      expiresAt: null,
      attachments: [],
      readAt: null,
    ),
    const CircularSummary(
      id: 'c2',
      title: 'Older notice',
      description: 'An older announcement.',
      scope: 'school',
      priority: 'normal',
      publishedAt: '2026-08-01T00:00:00.000Z',
      expiresAt: null,
      attachments: [],
      readAt: null,
    ),
  ];

  testWidgets('shows the greeting, child card, attendance stat, and recent announcements', (
    tester,
  ) async {
    var timetableOpened = false;
    var seeAllTapped = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: HomeTab(
            studentId: 's1',
            childName: 'Zara Ahmed',
            childClass: 'Class 8A',
            accessToken: 'tok',
            api: makeClient(),
            circulars: sampleCirculars,
            onOpenTimetable: () => timetableOpened = true,
            onSeeAllAnnouncements: () => seeAllTapped = true,
            onOpenFees: () {},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Assalam-o-Alaikum'), findsOneWidget);
    expect(find.text('Zara Ahmed'), findsOneWidget);
    expect(find.text('Class 8A'), findsOneWidget);
    expect(find.text('93%'), findsOneWidget);
    expect(find.text('Independence Day Holiday'), findsOneWidget);
    expect(find.text('Older notice'), findsOneWidget);

    await tester.tap(find.byKey(const Key('homeTimetableCard')));
    expect(timetableOpened, isTrue);

    await tester.tap(find.byKey(const Key('homeSeeAllAnnouncements')));
    expect(seeAllTapped, isTrue);
  });

  testWidgets(
    'shows the real outstanding balance on the Fees card and a grayed-out Results placeholder',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: HomeTab(
              studentId: 's1',
              childName: 'Zara Ahmed',
              childClass: 'Class 8A',
              accessToken: 'tok',
              api: makeClient(),
              circulars: sampleCirculars,
              onOpenTimetable: () {},
              onSeeAllAnnouncements: () {},
              onOpenFees: () {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Only v1's 500000-paisa amountDue is outstanding (v2 is fully paid): PKR 5000.
      expect(find.text('PKR 5000'), findsOneWidget);
      expect(find.text('Coming soon'), findsOneWidget);
      expect(find.text('—'), findsNothing);
      expect(find.text('View latest results'), findsNothing);

      final opacity = tester.widget<Opacity>(
        find.descendant(of: find.byKey(const Key('homeResultsCard')), matching: find.byType(Opacity)),
      );
      expect(opacity.opacity, lessThan(1.0));
    },
  );

  testWidgets('shows a dash on the Fees card when the fees fetch fails, without blocking the rest', (
    tester,
  ) async {
    final failingClient = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async => http.Response('nope', 404)),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: HomeTab(
            studentId: 's1',
            childName: 'Zara Ahmed',
            childClass: 'Class 8A',
            accessToken: 'tok',
            api: failingClient,
            circulars: sampleCirculars,
            onOpenTimetable: () {},
            onSeeAllAnnouncements: () {},
            onOpenFees: () {},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // The rest of the screen still renders — greeting, child card, and announcements — even
    // though both the attendance and fees fetches failed; only their own stat cards are affected.
    expect(find.text('Assalam-o-Alaikum'), findsOneWidget);
    expect(find.text('Zara Ahmed'), findsOneWidget);
    expect(find.text('Independence Day Holiday'), findsOneWidget);
    // Both the attendance and fees fetches fail under this mock, so both stat cards show it.
    expect(find.text('Unavailable'), findsNWidgets(2));
    expect(find.text('—'), findsNWidgets(2));
  });

  testWidgets('the stat grid does not overflow on a phone-sized viewport', (tester) async {
    final originalSize = tester.view.physicalSize;
    final originalDpr = tester.view.devicePixelRatio;
    tester.view.physicalSize = const Size(1080, 1920);
    tester.view.devicePixelRatio = 3;
    addTearDown(() {
      tester.view.physicalSize = originalSize;
      tester.view.devicePixelRatio = originalDpr;
    });

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: HomeTab(
            studentId: 's1',
            childName: 'Zara Ahmed',
            childClass: 'Class 8A',
            accessToken: 'tok',
            api: makeClient(),
            circulars: sampleCirculars,
            onOpenTimetable: () {},
            onSeeAllAnnouncements: () {},
            onOpenFees: () {},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
  });
}