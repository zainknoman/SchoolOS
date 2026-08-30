import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/models.dart';

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

  @override
  Widget build(BuildContext context) {
    if (_error != null) return Center(child: Text(_error!));
    final notifications = _notifications;
    if (notifications == null) return const Center(child: CircularProgressIndicator());
    if (notifications.isEmpty) return const Center(child: Text('No notifications yet.'));

    return Column(
      children: [
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            key: const Key('markAllRead'),
            onPressed: _onMarkAllRead,
            child: const Text('Mark all read'),
          ),
        ),
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: notifications.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (context, i) {
              final n = notifications[i];
              final isUnread = n.readAt == null;
              return ListTile(
                key: Key('notification-${n.id}'),
                onTap: () => _onTap(n),
                leading: Icon(isUnread ? Icons.circle : Icons.circle_outlined, size: 12),
                title: Text(
                  n.title,
                  style: TextStyle(fontWeight: isUnread ? FontWeight.bold : FontWeight.normal),
                ),
                subtitle: Text(n.body),
              );
            },
          ),
        ),
      ],
    );
  }
}
