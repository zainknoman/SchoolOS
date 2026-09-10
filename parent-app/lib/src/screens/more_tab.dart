import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../theme/theme_controller.dart';
import 'leave_screen.dart';

/// "More" bottom-nav tab (index 5) — a menu of screens that don't warrant their own tab, plus
/// account-wide settings (currently just appearance). Later additions (profile, …) are out of
/// scope here.
class MoreTab extends StatelessWidget {
  const MoreTab({
    super.key,
    required this.accessToken,
    required this.api,
    required this.children,
    this.activeChildId,
  });

  final String accessToken;
  final ApiClient api;
  final List<ChildSummary> children;

  /// The child currently selected in HomeShell's top switcher — threaded into LeaveScreen so its
  /// form defaults to the child the parent is actually looking at, not always the first one.
  final String? activeChildId;

  @override
  Widget build(BuildContext context) {
    final themeMode = context.watch<ThemeController>().mode;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: ListTile(
            key: const Key('moreLeaveApplications'),
            leading: const Icon(Icons.event_busy_outlined),
            title: const Text('Leave Applications'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => LeaveScreen(
                  accessToken: accessToken,
                  api: api,
                  children: children,
                  initialChildId: activeChildId,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: ListTile(
            leading: const Icon(Icons.dark_mode_outlined),
            title: const Text('Appearance'),
            trailing: DropdownButton<ThemeMode>(
              key: const Key('themeModeDropdown'),
              value: themeMode,
              items: const [
                DropdownMenuItem(value: ThemeMode.system, child: Text('System')),
                DropdownMenuItem(value: ThemeMode.light, child: Text('Light')),
                DropdownMenuItem(value: ThemeMode.dark, child: Text('Dark')),
              ],
              onChanged: (mode) {
                if (mode != null) context.read<ThemeController>().setMode(mode);
              },
            ),
          ),
        ),
      ],
    );
  }
}