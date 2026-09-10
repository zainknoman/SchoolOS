import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';

void main() {
  test('payVoucher sends the chosen method in the request body', () async {
    Map<String, dynamic>? sentBody;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        sentBody = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response(jsonEncode({'redirectUrl': '/pay/stub-checkout?ref=x', 'paymentId': 'p1'}), 201);
      }),
    );

    await api.payVoucher('tok', 'v1', 'jazzcash');

    expect(sentBody, {'method': 'jazzcash'});
  });

  test('completeStubPayment posts the reference with the dev stub signature header', () async {
    String? sentSignature;
    Map<String, dynamic>? sentBody;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        sentSignature = request.headers['x-stub-signature'];
        sentBody = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response(jsonEncode({'received': true}), 200);
      }),
    );

    await api.completeStubPayment('stub_abc');

    expect(sentSignature, stubWebhookSecret);
    expect(sentBody, {'reference': 'stub_abc', 'status': 'completed'});
  });

  test('getPayment returns the payment summary', () async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
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
      }),
    );

    final payment = await api.getPayment('tok', 'p1');

    expect(payment.status, 'completed');
  });
}
