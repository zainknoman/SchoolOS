import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../theme/theme_controller.dart';
import 'leave_screen.dart';

const _notificationChannels = ['PUSH', 'WHATSAPP', 'SMS'];

String _channelLabel(String channel) {
  switch (channel) {
    case 'WHATSAPP':
      return 'WhatsApp';
    case 'SMS':
      return 'SMS';
    case 'PUSH':
    default:
      return 'Push';
  }
}

/// "More" bottom-nav tab (index 5) — a menu of screens that don't warrant their own tab, plus
/// account-wide settings (currently Appearance and Notifications). Later additions (profile, …)
/// are out of scope here.
class MoreTab extends StatefulWidget {
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
  State<MoreTab> createState() => _MoreTabState();
}

class _MoreTabState extends State<MoreTab> {
  // No GET endpoint for current preferences exists yet — local state simply starts at the
  // backend's own defaults (Push, digest off) and PATCHes on change, same as the Appearance
  // dropdown's local-state pattern.
  String _channel = 'PUSH';
  bool _digestEnabled = false;

  Future<void> _updateChannel(String channel) async {
    setState(() => _channel = channel);
    await widget.api.updateNotificationPreferences(widget.accessToken, channel: channel);
  }

  Future<void> _updateDigestEnabled(bool digestEnabled) async {
    setState(() => _digestEnabled = digestEnabled);
    await widget.api.updateNotificationPreferences(
      widget.accessToken,
      digestEnabled: digestEnabled,
    );
  }

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
                  accessToken: widget.accessToken,
                  api: widget.api,
                  children: widget.children,
                  initialChildId: widget.activeChildId,
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
        const SizedBox(height: 12),
        Card(
          child: Column(
            children: [
              ListTile(
                leading: const Icon(Icons.notifications_outlined),
                title: const Text('Notification channel'),
                trailing: DropdownButton<String>(
                  key: const Key('notificationChannelDropdown'),
                  value: _channel,
                  items: _notificationChannels
                      .map((c) => DropdownMenuItem(value: c, child: Text(_channelLabel(c))))
                      .toList(),
                  onChanged: (channel) {
                    if (channel != null) _updateChannel(channel);
                  },
                ),
              ),
              CheckboxListTile(
                key: const Key('digestEnabledCheckbox'),
                title: const Text('Bundle notifications into a digest'),
                subtitle: const Text(
                  'Receive one combined message instead of separate ones for each update.',
                ),
                value: _digestEnabled,
                onChanged: (value) {
                  if (value != null) _updateDigestEnabled(value);
                },
              ),
            ],
          ),
        ),
      ],
    );
  }
}
