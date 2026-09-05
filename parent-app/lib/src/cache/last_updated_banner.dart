import 'package:flutter/material.dart';

import 'format_last_updated.dart';

/// The "Last updated: …" line every FEAT-014 screen shows above its content — plain
/// when the data is fresh, with an offline note appended when [stale] (the screen is
/// showing cached data because the live refresh hasn't completed or failed).
class LastUpdatedBanner extends StatelessWidget {
  const LastUpdatedBanner({
    super.key,
    required this.lastUpdated,
    required this.stale,
  });

  final DateTime lastUpdated;
  final bool stale;

  @override
  Widget build(BuildContext context) {
    final text = stale
        ? 'Last updated: ${formatLastUpdated(lastUpdated)} (offline — showing saved data)'
        : 'Last updated: ${formatLastUpdated(lastUpdated)}';
    return Text(
      text,
      style: Theme.of(context).textTheme.labelSmall
          ?.copyWith(color: Theme.of(context).colorScheme.outline),
    );
  }
}
