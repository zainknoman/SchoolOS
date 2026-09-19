import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../theme/theme_controller.dart';
import '../theme/locale_controller.dart';
import '../theme/tones.dart';
import '../widgets/parent_ui.dart';
import 'leave_screen.dart';
import 'complaints_screen.dart';
import 'report_cards_screen.dart';
import 'student_info_screen.dart';
import '../../l10n/app_localizations.dart';

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

  Widget _menuRow(Key key, IconData icon, String title, Widget Function() screen) {
    return GroupedRow(
      key: key,
      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen())),
      child: Row(
        children: [
          IconBadge(icon),
          const SizedBox(width: 12),
          Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5))),
          Icon(Icons.chevron_right, size: 18, color: Tones.of(context).muted),
        ],
      ),
    );
  }

  Widget _settingRow(IconData icon, String title, Widget trailing) {
    return GroupedRow(
      child: Row(
        children: [
          IconBadge(icon, neutral: true),
          const SizedBox(width: 12),
          Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5))),
          trailing,
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final themeMode = context.watch<ThemeController>().mode;
    final locale = context.watch<LocaleController>().locale;
    final l10n = AppLocalizations.of(context)!;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
      children: [
        GroupedCard(
          children: [
            _menuRow(
              const Key('moreStudentInfo'),
              Icons.badge_outlined,
              'Student information',
              () => StudentInfoScreen(
                accessToken: widget.accessToken,
                api: widget.api,
                children: widget.children,
                initialChildId: widget.activeChildId,
              ),
            ),
            _menuRow(
              const Key('moreLeaveApplications'),
              Icons.event_busy_outlined,
              l10n.moreLeaveApplications,
              () => LeaveScreen(
                accessToken: widget.accessToken,
                api: widget.api,
                children: widget.children,
                initialChildId: widget.activeChildId,
              ),
            ),
            _menuRow(
              const Key('moreComplaints'),
              Icons.report_gmailerrorred_outlined,
              l10n.moreComplaints,
              () => ComplaintsScreen(
                accessToken: widget.accessToken,
                api: widget.api,
                children: widget.children,
                initialChildId: widget.activeChildId,
              ),
            ),
            _menuRow(
              const Key('moreReportCards'),
              Icons.description_outlined,
              l10n.moreReportCards,
              () => ReportCardsScreen(
                accessToken: widget.accessToken,
                api: widget.api,
                children: widget.children,
                initialChildId: widget.activeChildId,
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        GroupedCard(
          children: [
            _settingRow(
              Icons.dark_mode_outlined,
              l10n.moreAppearance,
              DropdownButton<ThemeMode>(
                key: const Key('themeModeDropdown'),
                value: themeMode,
                underline: const SizedBox.shrink(),
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
            _settingRow(
              Icons.language_outlined,
              l10n.moreLanguage,
              DropdownButton<String>(
                key: const Key('languageDropdown'),
                value: locale?.languageCode ?? 'system',
                underline: const SizedBox.shrink(),
                items: const [
                  DropdownMenuItem(value: 'system', child: Text('System')),
                  DropdownMenuItem(value: 'en', child: Text('English')),
                  DropdownMenuItem(value: 'ur', child: Text('اردو')),
                ],
                onChanged: (code) {
                  if (code == null) return;
                  context.read<LocaleController>().setLocale(code == 'system' ? null : Locale(code));
                },
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        GroupedCard(
          children: [
            _settingRow(
              Icons.notifications_outlined,
              l10n.moreNotificationChannel,
              DropdownButton<String>(
                key: const Key('notificationChannelDropdown'),
                value: _channel,
                underline: const SizedBox.shrink(),
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
              controlAffinity: ListTileControlAffinity.leading,
              title: const Text(
                'Bundle notifications into a digest',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              ),
              subtitle: Text(
                'Receive one combined message instead of separate ones for each update.',
                style: TextStyle(fontSize: 11.5, color: Tones.of(context).muted),
              ),
              value: _digestEnabled,
              onChanged: (value) {
                if (value != null) _updateDigestEnabled(value);
              },
            ),
          ],
        ),
      ],
    );
  }
}
