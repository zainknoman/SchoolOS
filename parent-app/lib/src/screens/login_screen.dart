import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_client.dart';
import '../auth/auth_state.dart';
import 'forgot_password_screen.dart';
import '../../l10n/app_localizations.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  String? _errorMessage;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _onSubmit() async {
    setState(() {
      _errorMessage = null;
      _isSubmitting = true;
    });

    try {
      await context.read<AuthState>().login(_identifierController.text, _passwordController.text);
      // Navigation to /home happens via the router's redirect reacting to AuthState — no
      // explicit push here, matching go_router's declarative-redirect pattern.
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } catch (_) {
      setState(() => _errorMessage = 'Something went wrong. Please try again.');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 380),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  AppLocalizations.of(context)!.appTitle,
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  AppLocalizations.of(context)!.loginSubtitle,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 24),
                TextField(
                  key: const Key('identifierField'),
                  controller: _identifierController,
                  decoration: InputDecoration(labelText: AppLocalizations.of(context)!.loginIdentifier),
                  autofillHints: const [AutofillHints.username],
                ),
                const SizedBox(height: 12),
                TextField(
                  key: const Key('passwordField'),
                  controller: _passwordController,
                  decoration: InputDecoration(labelText: AppLocalizations.of(context)!.loginPassword),
                  obscureText: true,
                  autofillHints: const [AutofillHints.password],
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
                  key: const Key('submitButton'),
                  onPressed: _isSubmitting ? null : _onSubmit,
                  child: Text(
                    _isSubmitting
                        ? AppLocalizations.of(context)!.loginSubmitting
                        : AppLocalizations.of(context)!.loginSubmit,
                  ),
                ),
                const SizedBox(height: 12),
                TextButton(
                  key: const Key('forgotPasswordLink'),
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => ForgotPasswordScreen(api: context.read<ApiClient>()),
                    ),
                  ),
                  child: Text(AppLocalizations.of(context)!.loginForgotPassword),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
