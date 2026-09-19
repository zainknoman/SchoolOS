import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/api/models.dart';
import 'package:parent_app/src/screens/student_info_screen.dart';

const _child = ChildSummary(
  id: 'child-1',
  name: 'Eshaal Sample',
  grNumber: 'GR-1',
  campus: 'Main',
  schoolClass: 'Grade 3',
  section: '3A',
);

Map<String, dynamic> _detailJson({String? mobile}) => {
  'id': 'child-1',
  'name': 'Eshaal Sample',
  'grNumber': 'GR-1',
  'gender': 'FEMALE',
  'dateOfBirth': '2015-04-02',
  'admissionDate': null,
  'status': 'ACTIVE',
  'campus': 'Main',
  'class': 'Grade 3',
  'section': '3A',
  'rollNumber': '4',
  'studentMobile': mobile,
  'studentEmail': null,
  'currentAddress': null,
  'medical': {'bloodGroup': null, 'allergies': null, 'medicalConditions': null, 'medicationNotes': null},
  'emergencyContacts': [],
  'guardians': [
    {'name': 'Sana Sample', 'relationship': 'mother', 'phone': '0300'},
  ],
};

void main() {
  testWidgets('shows the read-only record and lets the parent edit contact details', (tester) async {
    Map<String, dynamic>? patchedBody;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'PATCH' && request.url.path == '/api/v1/me/children/child-1') {
          patchedBody = jsonDecode(request.body) as Map<String, dynamic>;
          return http.Response(jsonEncode(_detailJson(mobile: '0311-1234567')), 200);
        }
        if (request.url.path == '/api/v1/me/children/child-1') {
          return http.Response(jsonEncode(_detailJson()), 200);
        }
        return http.Response('not found', 404);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: StudentInfoScreen(accessToken: 'tok', api: api, children: const [_child]),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Eshaal Sample'), findsOneWidget);
    expect(find.text('2015-04-02'), findsOneWidget);
    expect(find.text('Sana Sample'), findsOneWidget);
    expect(find.byKey(const Key('studentMobileField')), findsNothing);

    await tester.tap(find.byKey(const Key('studentInfoEdit')));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.byKey(const Key('studentMobileField')), 200, scrollable: find.byType(Scrollable).first);
    await tester.enterText(find.byKey(const Key('studentMobileField')), '0311-1234567');
    await tester.scrollUntilVisible(find.byKey(const Key('studentInfoSave')), 300, scrollable: find.byType(Scrollable).first);
    await tester.tap(find.byKey(const Key('studentInfoSave')));
    await tester.pumpAndSettle();

    expect(patchedBody!['studentMobile'], '0311-1234567');
    // Identity / school-record fields are never part of the parent's payload.
    expect(patchedBody!.containsKey('name'), isFalse);
    expect(patchedBody!.containsKey('dateOfBirth'), isFalse);
    expect(find.byKey(const Key('studentMobileField')), findsNothing);
    expect(find.text('0311-1234567'), findsOneWidget);
  });
}
