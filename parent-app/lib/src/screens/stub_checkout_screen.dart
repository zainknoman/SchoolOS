import 'package:flutter/material.dart';
import '../api/api_client.dart';

/// Stands in for JazzCash/EasyPaisa's hosted checkout page — no real merchant account exists yet
/// (see StubPaymentGatewayAdapter/PaymentsWebhookController on the backend). "Complete Payment"
/// plays the role of the gateway itself: it calls the backend's stub webhook route (the same
/// signature-checked path a real gateway would hit), then polls the payment to reflect whatever
/// status the webhook actually set — this screen never assumes success.
class StubCheckoutScreen extends StatefulWidget {
  const StubCheckoutScreen({
    super.key,
    required this.paymentId,
    required this.reference,
    required this.amountDue,
    required this.accessToken,
    required this.api,
  });

  final String paymentId;
  final String reference;
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
      await widget.api.completeStubPayment(widget.reference);
      final payment = await widget.api.getPayment(widget.accessToken, widget.paymentId);
      if (mounted) {
        setState(() {
          _isComplete = payment.status == 'completed';
          if (!_isComplete) _error = 'Payment did not complete (status: ${payment.status}).';
        });
      }
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
