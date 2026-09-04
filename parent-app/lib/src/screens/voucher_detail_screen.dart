import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import 'stub_checkout_screen.dart';

class VoucherDetailScreen extends StatelessWidget {
  const VoucherDetailScreen({
    super.key,
    required this.voucher,
    required this.accessToken,
    required this.api,
  });

  final FeeVoucherSummary voucher;
  final String accessToken;
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Voucher — ${voucher.month}')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final item in voucher.items)
            ListTile(title: Text(item.label), trailing: Text('PKR ${(item.amount / 100).toStringAsFixed(2)}')),
          const Divider(),
          ListTile(
            title: const Text('Total due', style: TextStyle(fontWeight: FontWeight.bold)),
            trailing: Text(
              'PKR ${(voucher.amountDue / 100).toStringAsFixed(2)}',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(height: 16),
          OutlinedButton(
            key: const Key('downloadVoucherPdf'),
            onPressed: () =>
                launchUrl(api.voucherPdfUrl(voucher.id, accessToken), mode: LaunchMode.externalApplication),
            child: const Text('Download PDF'),
          ),
          const SizedBox(height: 8),
          if (voucher.amountDue > 0)
            ElevatedButton(
              key: const Key('payNowButton'),
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => StubCheckoutScreen(
                    voucherId: voucher.id,
                    amountDue: voucher.amountDue,
                    accessToken: accessToken,
                    api: api,
                  ),
                ),
              ),
              child: const Text('Pay Now'),
            ),
        ],
      ),
    );
  }
}
