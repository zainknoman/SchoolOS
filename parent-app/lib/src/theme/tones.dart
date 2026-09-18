import 'package:flutter/material.dart';

import 'app_theme.dart';

/// Brightness-aware status colours for the pill/dot/tint language in the parent-app mockups. Tints
/// are the foreground colour at low alpha (rather than fixed light hexes) so the same pill reads
/// correctly on both the light and dark surfaces.
class Tones {
  const Tones._(this.present, this.late, this.absent, this.leave, this.holiday, this.muted);

  final Color present;
  final Color late;
  final Color absent;
  final Color leave;
  final Color holiday;
  final Color muted;

  static Tones of(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Tones._(
      dark ? AppColorsDark.present : AppColors.present,
      dark ? AppColorsDark.lateStatus : AppColors.lateStatus,
      dark ? AppColorsDark.destructive : AppColors.destructive,
      Theme.of(context).colorScheme.primary,
      dark ? AppColorsDark.muted : const Color(0xFF334155),
      dark ? AppColorsDark.muted : AppColors.muted,
    );
  }

  static Color tint(Color c) => c.withValues(alpha: 0.12);

  /// Maps an attendance status string ("PRESENT", "Absent", …) to its tone.
  Color forStatus(String status) {
    switch (status.toUpperCase()) {
      case 'PRESENT':
        return present;
      case 'ABSENT':
        return absent;
      case 'LATE':
        return late;
      case 'LEAVE':
        return leave;
      case 'HOLIDAY':
        return holiday;
      default:
        return muted;
    }
  }
}

/// A small rounded status pill (Present / Due 21 Sep / Test · 19 Sep …).
class TonePill extends StatelessWidget {
  const TonePill({super.key, required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: Tones.tint(color),
        borderRadius: BorderRadius.circular(9999),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color),
      ),
    );
  }
}
