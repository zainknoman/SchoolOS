import 'package:flutter/material.dart';

/// Per-guardian brand accent (decision 11.7): blue for a father/guardian, magenta for a mother.
/// Driven by `StudentParent.relationship` on the active child (returned by /me/children), so the
/// accent follows the logged-in parent with no extra UI. Anything that isn't "mother" — including
/// "guardian" and any unrecognised value — keeps the standard blue.
enum GuardianAccent {
  blue,
  magenta;

  static GuardianAccent fromRelationship(String? relationship) =>
      relationship?.trim().toLowerCase() == 'mother' ? GuardianAccent.magenta : GuardianAccent.blue;

  Color get light =>
      this == GuardianAccent.magenta ? const Color(0xFFB0336B) : const Color(0xFF0369A1);

  /// Lighter variants for the dark theme, same contrast intent as AppColorsDark.accent.
  Color get dark =>
      this == GuardianAccent.magenta ? const Color(0xFFF08AB4) : const Color(0xFF4FC0F0);
}

class AccentController extends ChangeNotifier {
  GuardianAccent _accent = GuardianAccent.blue;

  GuardianAccent get accent => _accent;

  void setAccent(GuardianAccent accent) {
    if (accent == _accent) return;
    _accent = accent;
    notifyListeners();
  }

  void reset() => setAccent(GuardianAccent.blue);
}
