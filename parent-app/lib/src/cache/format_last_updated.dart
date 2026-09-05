const _months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/// Renders the "Last updated: …" timestamp shown when a FEAT-014 screen falls back
/// to cached data — deliberately absolute (not relative/"2m ago") so it stays honest
/// however long the app sits in the background.
String formatLastUpdated(DateTime dt) {
  final hh = dt.hour.toString().padLeft(2, '0');
  final mm = dt.minute.toString().padLeft(2, '0');
  return '${_months[dt.month - 1]} ${dt.day}, $hh:$mm';
}
