import 'package:flutter/material.dart';

import '../api/models.dart';
import '../theme/tones.dart';

/// Round accent-tinted bell with an unread dot — the notifications entry point on the Home and
/// Calendar headers (which replace the shell's AppBar per the parent-app mockups).
class NotificationBell extends StatelessWidget {
  const NotificationBell({super.key, required this.unreadCount, required this.onPressed});

  final int unreadCount;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final accent = Theme.of(context).colorScheme.primary;
    return Tooltip(
      message: 'Notifications',
      child: InkResponse(
        key: const Key('notificationsButton'),
        onTap: onPressed,
        radius: 24,
        child: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(color: Tones.tint(accent), shape: BoxShape.circle),
          child: Stack(
            alignment: Alignment.center,
            children: [
              Icon(Icons.notifications_none, size: 18, color: accent),
              if (unreadCount > 0)
                Positioned(
                  top: 6,
                  right: 7,
                  child: Container(
                    key: const Key('notificationsUnreadDot'),
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: Tones.of(context).absent,
                      shape: BoxShape.circle,
                      border: Border.all(color: Theme.of(context).colorScheme.surface, width: 1.5),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

String initialsOf(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return '?';
  if (parts.length == 1) {
    return parts.first.substring(0, parts.first.length >= 2 ? 2 : 1).toUpperCase();
  }
  return (parts.first[0] + parts.last[0]).toUpperCase();
}

/// Horizontally-scrolling child-selector pills (replaces the AppBar dropdown on Home).
class ChildPills extends StatelessWidget {
  const ChildPills({
    super.key,
    required this.children,
    required this.activeChildId,
    required this.onSelect,
  });

  final List<ChildSummary> children;
  final String? activeChildId;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final accent = theme.colorScheme.primary;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final c in children)
            Padding(
              padding: const EdgeInsetsDirectional.only(end: 8),
              child: _pill(context, c, selected: c.id == activeChildId, accent: accent),
            ),
        ],
      ),
    );
  }

  Widget _pill(
    BuildContext context,
    ChildSummary c, {
    required bool selected,
    required Color accent,
  }) {
    final theme = Theme.of(context);
    final muted = Tones.of(context).muted;
    final firstName = c.name.trim().split(RegExp(r'\s+')).first;
    return InkWell(
      key: Key('childPill-${c.id}'),
      borderRadius: BorderRadius.circular(9999),
      onTap: () => onSelect(c.id),
      child: Container(
        padding: const EdgeInsetsDirectional.fromSTEB(7, 7, 14, 7),
        decoration: BoxDecoration(
          color: selected ? accent : theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(9999),
          border: selected ? null : Border.all(color: theme.colorScheme.outlineVariant),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 26,
              height: 26,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: selected ? Colors.white.withValues(alpha: 0.9) : Tones.tint(muted),
              ),
              child: Text(
                initialsOf(c.name),
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: selected ? accent : muted,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '$firstName · ${c.schoolClass} ${c.section}',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                color: selected ? Colors.white : theme.colorScheme.onSurface,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
