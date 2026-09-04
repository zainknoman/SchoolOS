import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import 'voucher_detail_screen.dart';

/// Fees bottom-nav tab (index 4): outstanding vouchers (tap for the itemized breakdown, PDF, and
/// Pay Now) plus payment history with a receipt download for each completed payment.
class FeesTab extends StatefulWidget {
  const FeesTab({super.key, required this.studentId, required this.accessToken, required this.api});

  final String studentId;
  final String accessToken;
  final ApiClient api;

  @override
  State<FeesTab> createState() => _FeesTabState();
}

class _FeesTabState extends State<FeesTab> {
  List<FeeVoucherSummary>? _vouchers;
  List<FeePaymentSummary>? _payments;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final vouchers = await widget.api.studentFees(widget.accessToken, widget.studentId);
      final payments = await widget.api.studentFeePayments(widget.accessToken, widget.studentId);
      if (mounted) {
        setState(() {
          _vouchers = vouchers;
          _payments = payments;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _openVoucher(FeeVoucherSummary voucher) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) =>
            VoucherDetailScreen(voucher: voucher, accessToken: widget.accessToken, api: widget.api),
      ),
    );
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) return Center(child: Text(_error!));
    final vouchers = _vouchers;
    final payments = _payments;
    if (vouchers == null || payments == null) return const Center(child: CircularProgressIndicator());

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Fee Vouchers', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        if (vouchers.isEmpty) const Text('No fee vouchers yet.'),
        for (final v in vouchers)
          Card(
            child: ListTile(
              key: Key('voucher_${v.id}'),
              title: Text(v.month),
              subtitle: Text('Due ${v.dueDate}'),
              trailing: Chip(label: Text(v.status)),
              onTap: () => _openVoucher(v),
            ),
          ),
        const SizedBox(height: 24),
        Text('Payment History', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        if (payments.isEmpty) const Text('No payments yet.'),
        for (final p in payments)
          Card(
            child: ListTile(
              title: Text('PKR ${(p.amount / 100).toStringAsFixed(2)}'),
              subtitle: Text(p.status),
              trailing: p.receiptId == null
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.receipt_long_outlined),
                      onPressed: () => launchUrl(
                        widget.api.receiptPdfUrl(p.id, widget.accessToken),
                        mode: LaunchMode.externalApplication,
                      ),
                    ),
            ),
          ),
      ],
    );
  }
}
