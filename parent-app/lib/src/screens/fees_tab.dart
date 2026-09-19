import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../cache/cached_load.dart';
import '../cache/data_cache.dart';
import '../cache/last_updated_banner.dart';
import '../theme/tones.dart';
import '../widgets/parent_ui.dart';
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

    final tones = Tones.of(context);
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
      children: [
        LastUpdatedBanner(lastUpdated: _lastUpdated!, stale: _stale),
        const SizedBox(height: 14),
        const SectionLabel('Fee Vouchers'),
        if (vouchers.isEmpty)
          Padding(
            padding: const EdgeInsets.only(left: 2),
            child: Text('No fee vouchers yet.', style: TextStyle(color: tones.muted)),
          )
        else
          GroupedCard(
            children: [
              for (final v in vouchers)
                GroupedRow(
                  key: Key('voucher_${v.id}'),
                  onTap: () => _openVoucher(v),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(v.month, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                            Text('Due ${v.dueDate}', style: TextStyle(fontSize: 12, color: tones.muted)),
                          ],
                        ),
                      ),
                      StatusPill(label: v.status, color: StatusPill.colorFor(context, v.status)),
                    ],
                  ),
                ),
            ],
          ),
        const SizedBox(height: 18),
        const SectionLabel('Payment History'),
        if (_payments == null)
          const Center(child: CircularProgressIndicator())
        else if (_payments!.isEmpty)
          Padding(
            padding: const EdgeInsets.only(left: 2),
            child: Text('No payments yet.', style: TextStyle(color: tones.muted)),
          )
        else
          GroupedCard(
            children: [
              for (final p in _payments!)
                GroupedRow(
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'PKR ${(p.amount / 100).toStringAsFixed(2)}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 13.5,
                                fontFamily: 'monospace',
                              ),
                            ),
                            Text(p.status, style: TextStyle(fontSize: 12, color: tones.muted)),
                          ],
                        ),
                      ),
                      if (p.receiptId != null)
                        IconButton(
                          visualDensity: VisualDensity.compact,
                          icon: Icon(Icons.receipt_long_outlined, size: 18, color: tones.muted),
                          tooltip: 'Download receipt',
                          onPressed: () => launchUrl(
                            widget.api.receiptPdfUrl(p.id, widget.accessToken),
                            mode: LaunchMode.externalApplication,
                          ),
                        ),
                    ],
                  ),
                ),
            ],
          ),
      ],
    );
  }
}
