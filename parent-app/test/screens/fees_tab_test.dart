import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/screens/fees_tab.dart';

void main() {
  testWidgets('lists vouchers with status and payment history with a receipt link', (tester) async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'GET' && request.url.path == '/api/v1/students/child-1/fees') {
          return http.Response(
            jsonEncode([
              {
                'id': 'v1',
                'studentId': 'child-1',
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
            ]),
            200,
          );
        }
        if (request.method == 'GET' && request.url.path == '/api/v1/students/child-1/fees/payments') {
          return http.Response(
            jsonEncode([
              {
                'id': 'p1',
                'amount': 500000,
                'method': 'jazzcash',
                'status': 'completed',
                'voucherIds': ['v0'],
                'receiptId': 'r1',
              },
            ]),
            200,
          );
        }
        return http.Response('not found', 404);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(home: FeesTab(studentId: 'child-1', accessToken: 'tok', api: api)),
    );
    await tester.pumpAndSettle();

    expect(find.text('2026-09'), findsOneWidget);
    expect(find.text('unpaid'), findsOneWidget);
    expect(find.text('completed'), findsOneWidget);
    expect(find.byIcon(Icons.receipt_long_outlined), findsOneWidget);
  });
}
