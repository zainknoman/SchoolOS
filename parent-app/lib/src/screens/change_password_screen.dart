import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_client.dart';
import '../auth/auth_state.dart';

/// Shown instead of the app while the account must set a new password — after an admin-assisted
/// reset (BL-64) the parent signs in with a one-time password and the API refuses everything else
/// until it is replaced (BL-21). The router leaves this screen by itself once AuthState clears
/// `mustChangePassword`.
class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _onSubmit() async {
    final current = _currentController.text;
    final next = _newController.text;
    String? problem;
    if (current.isEmpty) {
      problem = 'Enter the temporary password you were given.';
    } else if (next.length < 8) {
      problem = 'The new password must be at least 8 characters.';
    } else if (next != _confirmController.text) {
      problem = 'The new passwords do not match.';
    } else if (next == current) {
      problem = 'The new password must be different from the temporary one.';
    }
    if (problem != null) {
      setState(() => _errorMessage = problem);
      return;
    }
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });
    try {
      await context.read<AuthState>().changePassword(current, next);
    } on ApiException catch (e) {
      if (mounted) setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Set a new password'),
        automaticallyImplyLeading: false,
        actions: [
          TextButton(
            key: const Key('changePasswordSignOut'),
            onPressed: _isSubmitting ? null : () => context.read<AuthState>().logout(),
            child: const Text('Sign out'),
          ),
        ],
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 380),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Your school gave you a temporary password. Choose your own password to continue.',
                ),
                const SizedBox(height: 16),
                TextField(
                  key: const Key('currentPasswordField'),
                  controller: _currentController,
                  decoration: const InputDecoration(labelText: 'Temporary password'),
                  obscureText: true,
                ),
                const SizedBox(height: 12),
                TextField(
                  key: const Key('newPasswordField'),
                  controller: _newController,
                  decoration: const InputDecoration(labelText: 'New password (at least 8 characters)'),
                  obscureText: true,
                ),
                const SizedBox(height: 12),
                TextField(
                  key: const Key('confirmPasswordField'),
                  controller: _confirmController,
                  decoration: const InputDecoration(labelText: 'Confirm new password'),
                  obscureText: true,
                ),
                if (_errorMessage != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _errorMessage!,
                    key: const Key('changePasswordError'),
                    style: TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ],
                const SizedBox(height: 20),
                ElevatedButton(
                  key: const Key('changePasswordSubmit'),
                  onPressed: _isSubmitting ? null : _onSubmit,
                  child: Text(_isSubmitting ? 'Saving…' : 'Save new password'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
