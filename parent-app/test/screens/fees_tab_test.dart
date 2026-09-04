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

  testWidgets(
    'completing a payment from the voucher detail screen returns all the way to FeesTab with '
    'refreshed data, not a stale voucher detail screen',
    (tester) async {
      var feesCallCount = 0;

      final api = ApiClient(
        baseUrl: 'http://test',
        client: MockClient((request) async {
          if (request.method == 'GET' && request.url.path == '/api/v1/students/child-1/fees') {
            feesCallCount++;
            // First load (pre-payment): v1 is unpaid with 500000 due. After the payment flow
            // completes and FeesTab reloads, the same voucher now comes back fully paid — proving
            // the screen the user lands on reflects fresh data, not what was shown pre-payment.
            final isPaid = feesCallCount > 1;
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
                  'amountPaid': isPaid ? 500000 : 0,
                  'amountDue': isPaid ? 0 : 500000,
                  'status': isPaid ? 'paid' : 'unpaid',
                },
              ]),
              200,
            );
          }
          if (request.method == 'GET' &&
              request.url.path == '/api/v1/students/child-1/fees/payments') {
            return http.Response(jsonEncode(<dynamic>[]), 200);
          }
          if (request.method == 'POST' && request.url.path == '/api/v1/fee-vouchers/v1/pay') {
            return http.Response(
              jsonEncode({'redirectUrl': '/pay/stub-checkout?ref=x', 'paymentId': 'p1'}),
              201,
            );
          }
          if (request.method == 'POST' &&
              request.url.path == '/api/v1/fee-payments/p1/confirm') {
            return http.Response(
              jsonEncode({
                'id': 'p1',
                'amount': 500000,
                'method': 'jazzcash',
                'status': 'completed',
                'voucherIds': ['v1'],
                'receiptId': 'r1',
              }),
              201,
            );
          }
          return http.Response('not found', 404);
        }),
      );

      await tester.pumpWidget(
        MaterialApp(home: FeesTab(studentId: 'child-1', accessToken: 'tok', api: api)),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('voucher_v1')));
      await tester.pumpAndSettle();
      expect(find.text('Voucher — 2026-09'), findsOneWidget);

      await tester.tap(find.byKey(const Key('payNowButton')));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('completePaymentButton')));
      await tester.pumpAndSettle();
      expect(find.text('Payment completed.'), findsOneWidget);

      await tester.tap(find.byKey(const Key('checkoutDoneButton')));
      await tester.pumpAndSettle();

      // Landed back on FeesTab (not lingering on the stale voucher detail screen), and the
      // voucher list reflects the fresh, post-payment fetch.
      expect(find.text('Voucher — 2026-09'), findsNothing);
      expect(find.text('paid'), findsOneWidget);
      expect(find.text('unpaid'), findsNothing);
    },
  );
}
