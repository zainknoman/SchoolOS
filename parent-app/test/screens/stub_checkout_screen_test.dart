import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/screens/stub_checkout_screen.dart';

void main() {
  testWidgets('completes a payment by driving pay then confirm', (tester) async {
    var paid = false;
    var confirmed = false;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'POST' && request.url.path == '/api/v1/fee-vouchers/v1/pay') {
          paid = true;
          return http.Response(
            jsonEncode({'redirectUrl': '/pay/stub-checkout?ref=x', 'paymentId': 'p1'}),
            201,
          );
        }
        if (request.method == 'POST' && request.url.path == '/api/v1/fee-payments/p1/confirm') {
          confirmed = true;
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
      MaterialApp(
        home: StubCheckoutScreen(voucherId: 'v1', amountDue: 500000, accessToken: 'tok', api: api),
      ),
    );

    await tester.tap(find.byKey(const Key('completePaymentButton')));
    await tester.pumpAndSettle();

    expect(paid, true);
    expect(confirmed, true);
    expect(find.text('Payment completed.'), findsOneWidget);
  });
}
