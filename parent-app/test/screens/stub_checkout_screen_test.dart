import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/screens/stub_checkout_screen.dart';

void main() {
  testWidgets('completes a payment by driving the stub webhook then polling payment status', (tester) async {
    var webhookCalled = false;
    var polled = false;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'POST' && request.url.path == '/api/v1/payments/webhook/stub') {
          webhookCalled = true;
          return http.Response(jsonEncode({'received': true}), 200);
        }
        if (request.method == 'GET' && request.url.path == '/api/v1/fee-payments/p1') {
          polled = true;
          return http.Response(
            jsonEncode({
              'id': 'p1',
              'amount': 500000,
              'method': 'jazzcash',
              'status': 'completed',
              'voucherIds': ['v1'],
              'receiptId': 'r1',
            }),
            200,
          );
        }
        return http.Response('not found', 404);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: StubCheckoutScreen(
          paymentId: 'p1',
          reference: 'stub_x',
          amountDue: 500000,
          accessToken: 'tok',
          api: api,
        ),
      ),
    );

    await tester.tap(find.byKey(const Key('completePaymentButton')));
    await tester.pumpAndSettle();

    expect(webhookCalled, true);
    expect(polled, true);
    expect(find.text('Payment completed.'), findsOneWidget);
  });

  testWidgets('shows an error if the payment does not end up completed', (tester) async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.url.path == '/api/v1/payments/webhook/stub') {
          return http.Response(jsonEncode({'received': true}), 200);
        }
        return http.Response(
          jsonEncode({
            'id': 'p1',
            'amount': 500000,
            'method': 'jazzcash',
            'status': 'failed',
            'voucherIds': ['v1'],
            'receiptId': null,
          }),
          200,
        );
      }),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: StubCheckoutScreen(
          paymentId: 'p1',
          reference: 'stub_x',
          amountDue: 500000,
          accessToken: 'tok',
          api: api,
        ),
      ),
    );

    await tester.tap(find.byKey(const Key('completePaymentButton')));
    await tester.pumpAndSettle();

    expect(find.textContaining('did not complete'), findsOneWidget);
  });
}
