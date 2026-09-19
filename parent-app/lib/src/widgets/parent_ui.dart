import 'package:flutter/material.dart';

import '../api/models.dart';
import '../theme/app_theme.dart';
import '../theme/tones.dart';
import 'parent_header.dart';

/// Shared building blocks for the parent-app screens redesigned from the `sample4/flutter-app`
/// mockups: the tab header, pushed-screen app bar, grouped-row card, status pill, section label.

Color hairline(BuildContext context) =>
    Theme.of(context).brightness == Brightness.dark ? AppColorsDark.border : AppColors.border;

/// Header shared by the Circulars / Messages / Fees / More tabs: bold title, a "Child · class ▾"
/// subtitle that opens a child picker, the notification bell and a logout button.
class TabHeader extends StatelessWidget {
  const TabHeader({
    super.key,
    required this.title,
    required this.children,
    required this.activeChildId,
    required this.onSelectChild,
    required this.unreadNotifications,
    required this.onOpenNotifications,
    required this.onLogout,
  });

  final String title;
  final List<ChildSummary> children;
  final String? activeChildId;
  final ValueChanged<String> onSelectChild;
  final int unreadNotifications;
  final VoidCallback onOpenNotifications;
  final VoidCallback onLogout;

  ChildSummary? get _active {
    for (final c in children) {
      if (c.id == activeChildId) return c;
    }
    return null;
  }

  Future<void> _pick(BuildContext context) async {
    if (children.length < 2) return;
    final id = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final c in children)
              ListTile(
                key: Key('childOption-${c.id}'),
                leading: CircleAvatar(child: Text(initialsOf(c.name))),
                title: Text(c.name),
                subtitle: Text('${c.schoolClass} ${c.section}'),
                trailing: c.id == activeChildId ? const Icon(Icons.check) : null,
                onTap: () => Navigator.of(sheetContext).pop(c.id),
              ),
          ],
        ),
      ),
    );
    if (id != null) onSelectChild(id);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tones = Tones.of(context);
    final active = _active;
    final first = active?.name.trim().split(RegExp(r'\s+')).first;
    final subtitle = active == null ? null : '$first · ${active.schoolClass} ${active.section}';
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 4),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800, fontSize: 17)),
                if (subtitle != null)
                  InkWell(
                    key: const Key('childSwitcher'),
                    onTap: children.length > 1 ? () => _pick(context) : null,
                    child: Text(
                      children.length > 1 ? '$subtitle ▾' : subtitle,
                      style: theme.textTheme.bodySmall?.copyWith(color: tones.muted, fontSize: 11.5),
                    ),
                  ),
              ],
            ),
          ),
          NotificationBell(unreadCount: unreadNotifications, onPressed: onOpenNotifications),
          const SizedBox(width: 8),
          Tooltip(
            message: 'Log out',
            child: InkResponse(
              key: const Key('logoutButton'),
              onTap: onLogout,
              radius: 24,
              child: Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: theme.brightness == Brightness.dark ? AppColorsDark.border : const Color(0xFFF1F5F9),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.logout, size: 16, color: tones.muted),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// App bar for screens pushed from More/Fees: white surface, hairline bottom border, bold title.
PreferredSizeWidget pageAppBar(BuildContext context, String title) {
  final theme = Theme.of(context);
  return AppBar(
    title: Text(title, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800, fontSize: 16)),
    backgroundColor: theme.colorScheme.surface,
    surfaceTintColor: Colors.transparent,
    elevation: 0,
    scrolledUnderElevation: 0,
    shape: Border(bottom: BorderSide(color: hairline(context))),
  );
}

/// A card whose [children] are rows separated by hairline dividers (the mockups' `.card .row`).
class GroupedCard extends StatelessWidget {
  const GroupedCard({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final line = hairline(context).withValues(alpha: 0.6);
    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) Divider(height: 1, thickness: 1, color: line),
            children[i],
          ],
        ],
      ),
    );
  }
}

/// A single padded row for [GroupedCard]; tappable when [onTap] is set.
class GroupedRow extends StatelessWidget {
  const GroupedRow({
    super.key,
    required this.child,
    this.onTap,
  });

  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13), child: child),
    );
  }
}

class StatusPill extends StatelessWidget {
  const StatusPill({super.key, required this.label, required this.color});

  final String label;
  final Color color;

  /// Maps free-form backend statuses onto the pill palette (paid/approved/resolved → green,
  /// partial/open/pending → amber, overdue/rejected → red, in progress → accent, else neutral).
  static Color colorFor(BuildContext context, String status) {
    final tones = Tones.of(context);
    switch (status.toLowerCase().replaceAll('_', ' ')) {
      case 'paid':
      case 'approved':
      case 'resolved':
      case 'completed':
        return tones.present;
      case 'partial':
      case 'open':
      case 'pending':
        return tones.late;
      case 'overdue':
      case 'rejected':
      case 'failed':
        return tones.absent;
      case 'in progress':
        return tones.leave;
      default:
        return tones.holiday;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(color: Tones.tint(color), borderRadius: BorderRadius.circular(9999)),
      child: Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)),
    );
  }
}

class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 2, bottom: 8),
      child: Text(
        text.toUpperCase(),
        style: TextStyle(
          fontSize: 11.5,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
          color: Tones.of(context).muted,
        ),
      ),
    );
  }
}

/// Small uppercase field caption used above inputs (the mockups' `.field-label`).
class FieldLabel extends StatelessWidget {
  const FieldLabel(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        text.toUpperCase(),
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.3,
          color: Tones.of(context).muted,
        ),
      ),
    );
  }
}

/// Round initials avatar; [neutral] gives the grey variant used for non-primary rows.
class InitialsAvatar extends StatelessWidget {
  const InitialsAvatar(this.name, {super.key, this.neutral = false});

  final String name;
  final bool neutral;

  @override
  Widget build(BuildContext context) {
    final tones = Tones.of(context);
    final accent = Theme.of(context).colorScheme.primary;
    final color = neutral ? tones.holiday : accent;
    return Container(
      width: 38,
      height: 38,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: Tones.tint(color), shape: BoxShape.circle),
      child: Text(initialsOf(name), style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 13)),
    );
  }
}

/// Unread indicator: filled accent dot when unread, hollow ring when read.
class UnreadDot extends StatelessWidget {
  const UnreadDot({super.key, required this.unread});

  final bool unread;

  @override
  Widget build(BuildContext context) {
    final accent = Theme.of(context).colorScheme.primary;
    return Container(
      width: 8,
      height: 8,
      decoration: BoxDecoration(
        color: unread ? accent : Colors.transparent,
        shape: BoxShape.circle,
        border: unread ? null : Border.all(color: Tones.of(context).muted.withValues(alpha: 0.5), width: 1.5),
      ),
    );
  }
}

/// Rounded square icon chip used at the start of menu / grade rows.
class IconBadge extends StatelessWidget {
  const IconBadge(this.icon, {super.key, this.neutral = false});

  final IconData icon;
  final bool neutral;

  @override
  Widget build(BuildContext context) {
    final color = neutral ? Tones.of(context).holiday : Theme.of(context).colorScheme.primary;
    return Container(
      width: 34,
      height: 34,
      decoration: BoxDecoration(color: Tones.tint(color), borderRadius: BorderRadius.circular(9)),
      child: Icon(icon, size: 17, color: color),
    );
  }
}

/// Outlined 8px-radius input decoration matching the mockups' `.field-input`.
InputDecoration fieldDecoration({String? hint}) => InputDecoration(
  hintText: hint,
  isDense: true,
  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
);
