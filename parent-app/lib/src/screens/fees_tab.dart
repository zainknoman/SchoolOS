import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../cache/cached_load.dart';
import '../cache/data_cache.dart';
import '../cache/last_updated_banner.dart';
import 'voucher_detail_screen.dart';

/// Fees bottom-nav tab (index 4): outstanding vouchers (tap for the itemized breakdown, PDF, and
/// Pay Now) plus payment history with a receipt download for each completed payment. The voucher
/// list is cached per-student (the offline-critical content, same as CircularsTab's single list);
/// payment history is a secondary, live-only fetch that degrades to empty on failure rather than
/// blocking the voucher list from rendering.
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
  DateTime? _lastUpdated;
  bool _stale = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final cache = await DataCache.open();
    await loadWithCache<List<FeeVoucherSummary>>(
      cache: cache,
      cacheKey: 'cache:fees:${widget.studentId}',
      fetch: () => widget.api.studentFees(widget.accessToken, widget.studentId),
      toJson: (vouchers) => vouchers.map((v) => v.toJson()).toList(),
      fromJson: (json) => (json as List<dynamic>)
          .map((e) => FeeVoucherSummary.fromJson(e as Map<String, dynamic>))
          .toList(),
      onData: (data, lastUpdated, {required stale}) {
        if (mounted) {
          setState(() {
            _vouchers = data;
            _lastUpdated = lastUpdated;
            _stale = stale;
            _error = null;
          });
        }
      },
      onError: (message) {
        if (mounted) setState(() => _error = message);
      },
    );
    await _loadPayments();
  }

  Future<void> _loadPayments() async {
    try {
      final payments = await widget.api.studentFeePayments(widget.accessToken, widget.studentId);
      if (mounted) setState(() => _payments = payments);
    } on ApiException catch (_) {
      // Payment history is secondary — the voucher list above is the offline-critical content.
      // Degrade to empty (not left null) so this section stops showing a perpetual spinner.
      if (mounted) setState(() => _payments = []);
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
    if (vouchers == null) return const Center(child: CircularProgressIndicator());

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        LastUpdatedBanner(lastUpdated: _lastUpdated!, stale: _stale),
        const SizedBox(height: 12),
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
        if (_payments == null)
          const Center(child: CircularProgressIndicator())
        else if (_payments!.isEmpty)
          const Text('No payments yet.')
        else
          for (final p in _payments!)
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