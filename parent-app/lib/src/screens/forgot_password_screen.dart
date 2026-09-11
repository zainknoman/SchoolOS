import 'package:flutter/material.dart';
import '../api/api_client.dart';
import 'reset_password_screen.dart';

/// Reachable from the login screen. Always shows the same generic message once submitted,
/// regardless of whether the identifier matched a real account — the backend response is
/// identical either way (user-enumeration defense), and this screen must not invent a way to
/// distinguish the two branches.
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _identifierController = TextEditingController();
  bool _isSubmitting = false;
  bool _submitted = false;

  @override
  void dispose() {
    _identifierController.dispose();
    super.dispose();
  }

  Future<void> _onSubmit() async {
    if (_identifierController.text.trim().isEmpty) return;
    setState(() => _isSubmitting = true);
    try {
      await widget.api.forgotPassword(_identifierController.text.trim());
    } catch (_) {
      // Ignored deliberately — the UI shows the same message on success or failure.
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _submitted = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Forgot password')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 380),
            child: _submitted
                ? Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        key: Key('forgotPasswordMessage'),
                        'If an account exists for that identifier, a password reset link has '
                        'been sent.',
                      ),
                      const SizedBox(height: 16),
                      OutlinedButton(
                        key: const Key('goToResetPasswordButton'),
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => ResetPasswordScreen(api: widget.api),
                          ),
                        ),
                        child: const Text('I have a reset code'),
                      ),
                    ],
                  )
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text('Enter your email or GR number and we\'ll send a reset link.'),
                      const SizedBox(height: 16),
                      TextField(
                        key: const Key('forgotIdentifierField'),
                        controller: _identifierController,
                        decoration: const InputDecoration(labelText: 'Email or GR number'),
                      ),
                      const SizedBox(height: 20),
                      ElevatedButton(
                        key: const Key('forgotSubmitButton'),
                        onPressed: _isSubmitting ? null : _onSubmit,
                        child: Text(_isSubmitting ? 'Sending…' : 'Send reset link'),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}
