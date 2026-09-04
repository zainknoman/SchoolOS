import 'package:flutter/material.dart';
import '../api/api_client.dart';

/// Stands in for JazzCash/EasyPaisa's hosted checkout page — no real merchant account exists yet
/// (see StubPaymentGatewayAdapter on the backend). "Complete Payment" here plays the role of the
/// gateway's redirect-back/webhook: it drives POST /fee-vouchers/:id/pay then
/// POST /fee-payments/:id/confirm, exactly as a real gateway integration would from this screen.
class StubCheckoutScreen extends StatefulWidget {
  const StubCheckoutScreen({
    super.key,
    required this.voucherId,
    required this.amountDue,
    required this.accessToken,
    required this.api,
  });

  final String voucherId;
  final int amountDue;
  final String accessToken;
  final ApiClient api;

  @override
  State<StubCheckoutScreen> createState() => _StubCheckoutScreenState();
}

class _StubCheckoutScreenState extends State<StubCheckoutScreen> {
  bool _isProcessing = false;
  String? _error;
  bool _isComplete = false;

  Future<void> _completePayment() async {
    setState(() {
      _isProcessing = true;
      _error = null;
    });
    try {
      final initiation = await widget.api.payVoucher(widget.accessToken, widget.voucherId);
      await widget.api.confirmPayment(widget.accessToken, initiation.paymentId);
      if (mounted) setState(() => _isComplete = true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('Amount to pay: PKR ${(widget.amountDue / 100).toStringAsFixed(2)}'),
            const SizedBox(height: 24),
            if (_isComplete) ...[
              const Icon(Icons.check_circle, color: Colors.green, size: 48),
              const SizedBox(height: 12),
              const Text('Payment completed.'),
              const SizedBox(height: 12),
              ElevatedButton(
                key: const Key('checkoutDoneButton'),
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('Done'),
              ),
            ] else ...[
              if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
              ElevatedButton(
                key: const Key('completePaymentButton'),
                onPressed: _isProcessing ? null : _completePayment,
                child: Text(_isProcessing ? 'Processing…' : 'Complete Payment'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
