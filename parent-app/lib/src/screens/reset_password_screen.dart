import 'package:flutter/material.dart';
import '../api/api_client.dart';

/// Reachable by pasting the emailed reset token (the parent app has no in-app browser step for
/// "click the emailed link" the way a web client does). A future Android deep link into this
/// screen — reusing Sprint F's push-notification-tap URI scheme — is a documented follow-up, not
/// implemented this sprint; pasting the token is the functional path shipped now.
class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key, required this.api, this.initialToken});

  final ApiClient api;
  final String? initialToken;

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  late final _tokenController = TextEditingController(text: widget.initialToken ?? '');
  final _passwordController = TextEditingController();
  bool _isSubmitting = false;
  bool _done = false;
  String? _errorMessage;

  @override
  void dispose() {
    _tokenController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _onSubmit() async {
    if (_tokenController.text.trim().isEmpty || _passwordController.text.length < 8) return;
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });
    try {
      await widget.api.resetPassword(_tokenController.text.trim(), _passwordController.text);
      if (mounted) setState(() => _done = true);
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reset password')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 380),
            child: _done
                ? const Text(
                    key: Key('resetPasswordMessage'),
                    'Your password has been reset. Please log in again.',
                  )
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TextField(
                        key: const Key('resetTokenField'),
                        controller: _tokenController,
                        decoration: const InputDecoration(labelText: 'Reset code'),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        key: const Key('newPasswordField'),
                        controller: _passwordController,
                        decoration: const InputDecoration(labelText: 'New password'),
                        obscureText: true,
                      ),
                      if (_errorMessage != null) ...[
                        const SizedBox(height: 12),
                        Text(
                          _errorMessage!,
                          style: TextStyle(color: Theme.of(context).colorScheme.error),
                        ),
                      ],
                      const SizedBox(height: 20),
                      ElevatedButton(
                        key: const Key('resetSubmitButton'),
                        onPressed: _isSubmitting ? null : _onSubmit,
                        child: Text(_isSubmitting ? 'Resetting…' : 'Reset password'),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}
