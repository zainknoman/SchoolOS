import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/screens/complaint_detail_screen.dart';
import 'package:parent_app/src/screens/complaint_form_screen.dart';

Map<String, dynamic> _complaint({String status = 'open', String? resolution, List<Map<String, dynamic>>? responses}) => {
  'id': 'cm1',
  'studentId': 'child-1',
  'category': 'TRANSPORT',
  'subject': 'Van late',
  'description': 'Late every day',
  'status': status,
  'resolution': resolution,
  'raisedByMe': true,
  'responses': responses ?? [],
  'attachments': [
    {'id': 'a1', 'fileId': 'f1', 'originalName': 'photo.jpg', 'createdAt': '2026-09-01T00:00:00.000Z'},
  ],
  'createdAt': '2026-09-01T00:00:00.000Z',
  'updatedAt': '2026-09-01T00:00:00.000Z',
};

void main() {
  testWidgets('BL-30: a parent sends a complaint with a category and an attached file', (tester) async {
    Map<String, dynamic>? sent;
    var uploaded = false;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'POST' && request.url.path == '/api/v1/complaints') {
          sent = jsonDecode(request.body) as Map<String, dynamic>;
          return http.Response(jsonEncode(_complaint()), 201);
        }
        if (request.method == 'POST' && request.url.path == '/api/v1/complaints/cm1/attachments') {
          uploaded = request.headers['content-type']!.startsWith('multipart/form-data');
          return http.Response(jsonEncode(_complaint()), 201);
        }
        return http.Response('not found', 404);
      }),
    );
    bool? popped;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () async {
              popped = await Navigator.of(context).push<bool>(
                MaterialPageRoute(
                  builder: (_) => ComplaintFormScreen(
                    accessToken: 'tok',
                    api: api,
                    studentId: 'child-1',
                    pickAttachment: () async => const PickedAttachment(name: 'photo.jpg', bytes: [1, 2, 3]),
                  ),
                ),
              );
            },
            child: const Text('open'),
          ),
        ),
      ),
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    // Title and description are required.
    await tester.tap(find.byKey(const Key('complaintSend')));
    await tester.pumpAndSettle();
    expect(find.textContaining('title and a description'), findsOneWidget);

    await tester.tap(find.byKey(const Key('complaintCategory')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Transport').last);
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('complaintSubject')), 'Van late');
    await tester.enterText(find.byKey(const Key('complaintDescription')), 'Late every day');
    await tester.tap(find.byKey(const Key('complaintAttach')));
    await tester.pumpAndSettle();
    expect(find.text('photo.jpg'), findsOneWidget);
    await tester.ensureVisible(find.byKey(const Key('complaintSend')));
    await tester.tap(find.byKey(const Key('complaintSend')));
    await tester.pumpAndSettle();

    expect(sent, {'studentId': 'child-1', 'category': 'TRANSPORT', 'subject': 'Van late', 'description': 'Late every day'});
    expect(uploaded, isTrue);
    expect(popped, isTrue);
  });

  testWidgets('BL-30: the detail shows the school\'s replies and outcome, and takes a comment', (tester) async {
    String? comment;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'GET' && request.url.path == '/api/v1/complaints/cm1') {
          return http.Response(
            jsonEncode(
              _complaint(
                status: 'resolved',
                resolution: 'New driver from Monday.',
                responses: [
                  {'id': 'n1', 'body': 'We spoke to the contractor.', 'fromSchool': true, 'createdAt': '2026-09-02T00:00:00.000Z'},
                ],
              ),
            ),
            200,
          );
        }
        if (request.method == 'POST' && request.url.path == '/api/v1/complaints/cm1/notes') {
          comment = (jsonDecode(request.body) as Map<String, dynamic>)['body'] as String;
          return http.Response(jsonEncode(_complaint(status: 'resolved', resolution: 'New driver from Monday.')), 201);
        }
        return http.Response('not found', 404);
      }),
    );
    await tester.pumpWidget(
      MaterialApp(home: ComplaintDetailScreen(accessToken: 'tok', api: api, complaintId: 'cm1')),
    );
    await tester.pumpAndSettle();

    expect(find.text('resolved'), findsOneWidget);
    expect(find.byKey(const Key('complaintResolution')), findsOneWidget);
    expect(find.text('We spoke to the contractor.'), findsOneWidget);
    expect(find.text('photo.jpg'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('complaintComment')), 'Thank you');
    await tester.ensureVisible(find.byKey(const Key('complaintCommentSend')));
    await tester.tap(find.byKey(const Key('complaintCommentSend')));
    await tester.pumpAndSettle();
    expect(comment, 'Thank you');
  });
}
