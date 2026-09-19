import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../theme/tones.dart';
import '../widgets/parent_ui.dart';

/// Cross-cutting activity feed (diary/circular/message alerts), opened from HomeShell's AppBar
/// bell. Distinct from the Circulars tab, which stays the authoritative unread-tracking place for
/// circulars specifically — this sheet is an additive summary across all three event types.
class NotificationsSheet extends StatefulWidget {
  const NotificationsSheet({
    super.key,
    required this.accessToken,
    required this.api,
    required this.onOpenType,
  });

  final String accessToken;
  final ApiClient api;

  /// Called with the tapped notification's type and its entityRef (the diary entry / circular /
  /// conversation id it was about), so the caller can deep-link to that specific item, not just
  /// the containing screen.
  final void Function(String type, String? entityRef) onOpenType;

  @override
  State<NotificationsSheet> createState() => _NotificationsSheetState();
}

class _NotificationsSheetState extends State<NotificationsSheet> {
  List<NotificationSummary>? _notifications;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final notifications = await widget.api.notifications(widget.accessToken);
      if (mounted) setState(() => _notifications = notifications);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _onTap(NotificationSummary n) async {
    if (n.readAt == null) {
      try {
        await widget.api.markNotificationRead(widget.accessToken, n.id);
      } on ApiException catch (_) {
        // Marking read is best-effort — don't block navigating to the relevant screen on it.
      }
    }
    widget.onOpenType(n.type, n.entityRef);
  }

  Future<void> _onMarkAllRead() async {
    await widget.api.markAllNotificationsRead(widget.accessToken);
    await _load();
  }

  /// "2h" / "3d" style age, as in the mockup's right-hand timestamp.
  String _age(String iso) {
    final diff = DateTime.now().difference(DateTime.parse(iso));
    if (diff.inMinutes < 1) return 'now';
    if (diff.inHours < 1) return '${diff.inMinutes}m';
    if (diff.inDays < 1) return '${diff.inHours}h';
    return '${diff.inDays}d';
  }

  @override
  Widget build(BuildContext context) {
    final tones = Tones.of(context);
    final accent = Theme.of(context).colorScheme.primary;

    Widget body() {
      if (_error != null) return Center(child: Text(_error!));
      final notifications = _notifications;
      if (notifications == null) return const Center(child: CircularProgressIndicator());
      if (notifications.isEmpty) return const Center(child: Text('No notifications yet.'));
      return ListView.separated(
        itemCount: notifications.length,
        separatorBuilder: (_, _) => Divider(height: 1, color: hairline(context).withValues(alpha: 0.6)),
        itemBuilder: (context, i) {
          final n = notifications[i];
          final isUnread = n.readAt == null;
          return InkWell(
            key: Key('notification-${n.id}'),
            onTap: () => _onTap(n),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 13),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(padding: const EdgeInsets.only(top: 5), child: UnreadDot(unread: isUnread)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          n.title,
                          style: TextStyle(fontSize: 13.5, fontWeight: isUnread ? FontWeight.w800 : FontWeight.w600),
                        ),
                        const SizedBox(height: 2),
                        Text(n.body, style: TextStyle(fontSize: 12, color: tones.muted)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _age(n.createdAt),
                    style: TextStyle(fontSize: 10.5, color: tones.muted, fontFamily: 'monospace'),
                  ),
                ],
              ),
            ),
          );
        },
      );
    }

    return Column(
      children: [
        const SizedBox(height: 10),
        Container(
          width: 36,
          height: 4,
          decoration: BoxDecoration(color: hairline(context), borderRadius: BorderRadius.circular(9999)),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 8, 6),
          child: Row(
            children: [
              const Expanded(
                child: Text('Notifications', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              ),
              TextButton(
                key: const Key('markAllRead'),
                onPressed: _onMarkAllRead,
                child: Text(
                  'Mark all read',
                  style: TextStyle(color: accent, fontWeight: FontWeight.w700, fontSize: 12.5),
                ),
              ),
            ],
          ),
        ),
        Expanded(child: body()),
      ],
    );
  }
}
