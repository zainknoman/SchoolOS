import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';

// BL-36 / KG-15: download URLs never carry the access token; they come from the backend's
// short-lived download-link endpoint, requested with the bearer header.
void main() {
  ApiClient clientRecording(List<http.Request> requests) => ApiClient(
    baseUrl: 'http://test',
    client: MockClient((request) async {
      requests.add(request);
      final path = (jsonDecode(request.body) as Map<String, dynamic>)['path'] as String;
      return http.Response(jsonEncode({'url': '$path?dl=link-token', 'expiresAt': 'x'}), 201);
    }),
  );

  test('each download URL is a minted link for its own path, with no access token in it', () async {
    final requests = <http.Request>[];
    final api = clientRecording(requests);

    final urls = [
      await api.fileDownloadUrl('f1', 'tok'),
      await api.voucherPdfUrl('v1', 'tok'),
      await api.receiptPdfUrl('p1', 'tok'),
      await api.reportCardPdfUrl('r1', 'tok'),
      await api.generatedReportCardPdfUrl('g1', 'tok'),
    ];

    expect(urls.map((u) => u.toString()), [
      'http://test/api/v1/files/f1?dl=link-token',
      'http://test/api/v1/fee-vouchers/v1/pdf?dl=link-token',
      'http://test/api/v1/fee-payments/p1/receipt.pdf?dl=link-token',
      'http://test/api/v1/report-cards/r1/pdf?dl=link-token',
      'http://test/api/v1/report-cards/generated/g1/pdf?dl=link-token',
    ]);
    for (final u in urls) {
      expect(u.toString(), isNot(contains('tok&')));
      expect(u.queryParameters.containsKey('access_token'), isFalse);
    }
    for (final r in requests) {
      expect(r.method, 'POST');
      expect(r.url.path, '/api/v1/auth/download-link');
      expect(r.headers['Authorization'], 'Bearer tok');
    }
  });

  test('a refused link surfaces as an ApiException', () async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((_) async => http.Response(jsonEncode({'message': 'Not a download path.'}), 400)),
    );

    await expectLater(
      api.fileDownloadUrl('f1', 'tok'),
      throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Not a download path.')),
    );
  });
}
