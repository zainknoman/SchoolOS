import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import 'stub_checkout_screen.dart';
import '../widgets/open_download.dart';

class VoucherDetailScreen extends StatefulWidget {
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
  State<VoucherDetailScreen> createState() => _VoucherDetailScreenState();
}

class _VoucherDetailScreenState extends State<VoucherDetailScreen> {
  // BL-08 (RD-14): online payment is offered only when the deployment enabled a gateway; the pilot
  // runs with every gateway off, so the voucher is paid at the school office.
  List<String>? _methods;

  FeeVoucherSummary get voucher => widget.voucher;
  String get accessToken => widget.accessToken;
  ApiClient get api => widget.api;

  @override
  void initState() {
    super.initState();
    _loadMethods();
  }

  Future<void> _loadMethods() async {
    try {
      final methods = await api.paymentMethods(accessToken);
      if (mounted) setState(() => _methods = methods);
    } on ApiException catch (_) {
      if (mounted) setState(() => _methods = const []);
    }
  }

  Future<void> _payNow(BuildContext context) async {
    final initiation = await api.payVoucher(accessToken, voucher.id, _methods!.first);
    if (!context.mounted) return;

    final redirectUri = Uri.parse(initiation.redirectUrl);

    if (redirectUri.path == '/pay/stub-checkout') {
      final reference = redirectUri.queryParameters['ref']!;
      final paid = await Navigator.of(context).push<bool>(
        MaterialPageRoute(
          builder: (_) => StubCheckoutScreen(
            paymentId: initiation.paymentId,
            reference: reference,
            amountDue: voucher.amountDue,
            accessToken: accessToken,
            api: api,
          ),
        ),
      );
      if (paid == true && context.mounted) Navigator.of(context).pop();
      return;
    }

    // Real-gateway path: not reachable in this environment (no real merchant account is
    // configured, so the factory always falls back to the stub above) — kept so the seam exists
    // once real credentials do, matching this codebase's StorageAdapter/PushAdapter precedent of
    // building the swap point before the real backing exists.
    await launchUrl(Uri.parse(initiation.redirectUrl), mode: LaunchMode.externalApplication);
    if (!context.mounted) return;
    final payment = await api.getPayment(accessToken, initiation.paymentId);
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Payment status: ${payment.status}')));
      if (payment.status == 'completed') Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Voucher — ${voucher.title}')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final item in voucher.items)
            ListTile(
              title: Text(item.label),
              subtitle: item.reason == null ? null : Text(item.reason!),
              trailing: Text('PKR ${(item.amount / 100).toStringAsFixed(2)}'),
            ),
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
            onPressed: () => openDownload(context, api.voucherPdfUrl(voucher.id, accessToken)),
            child: const Text('Download PDF'),
          ),
          const SizedBox(height: 8),
          if (voucher.amountDue > 0 && (_methods?.isNotEmpty ?? false))
            ElevatedButton(
              key: const Key('payNowButton'),
              onPressed: () => _payNow(context),
              child: const Text('Pay Now'),
            )
          else if (voucher.amountDue > 0 && _methods != null)
            const Padding(
              key: Key('payAtOffice'),
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text('Please pay this voucher at the school office.'),
            ),
        ],
      ),
    );
  }
}
