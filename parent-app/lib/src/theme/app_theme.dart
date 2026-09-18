import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Same tokens as the staff console (design-system/schoolos-staff-console/MASTER.md) — one brand
/// across both clients, adapted to Material for a mobile surface.
class AppColors {
  static const primary = Color(0xFF0F172A);
  static const accent = Color(0xFF0369A1);
  static const background = Color(0xFFF8FAFC);
  static const surface = Color(0xFFFFFFFF);
  static const text = Color(0xFF1E293B);
  static const muted = Color(0xFF64748B);
  static const border = Color(0xFFE2E8F0);
  static const destructive = Color(0xFFDC2626);
  static const present = Color(0xFF15803D);
  static const lateStatus = Color(0xFFB45309);
}

ThemeData buildAppTheme() {
  final colorScheme = ColorScheme.fromSeed(
    seedColor: AppColors.accent,
    primary: AppColors.accent,
    surface: AppColors.surface,
    error: AppColors.destructive,
    brightness: Brightness.light,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: AppColors.background,
    textTheme: GoogleFonts.plusJakartaSansTextTheme(),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.surface,
      foregroundColor: AppColors.primary,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: AppColors.border),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.accent,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: AppColors.surface,
      indicatorColor: AppColors.accent.withValues(alpha: 0.12),
    ),
  );
}

/// Same tokens as the staff console's `:root[data-theme='dark']` block
/// (staff-console/src/assets/base.css) — exact hex parity, not a re-derived palette.
class AppColorsDark {
  static const primary = Color(0xFFF1F5F9);
  static const accent = Color(0xFF4FC0F0);
  static const background = Color(0xFF0B1220);
  static const surface = Color(0xFF111A2C);
  static const text = Color(0xFFDCE4EE);
  static const muted = Color(0xFF8C9AB3);
  static const border = Color(0xFF233150);
  static const destructive = Color(0xFFF87171);
  static const present = Color(0xFF4ADE80);
  static const lateStatus = Color(0xFFFBBF24);
}

ThemeData buildDarkAppTheme() {
  final colorScheme = ColorScheme.fromSeed(
    seedColor: AppColorsDark.accent,
    primary: AppColorsDark.accent,
    surface: AppColorsDark.surface,
    error: AppColorsDark.destructive,
    brightness: Brightness.dark,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: AppColorsDark.background,
    textTheme: GoogleFonts.plusJakartaSansTextTheme(
      ThemeData(brightness: Brightness.dark).textTheme,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColorsDark.surface,
      foregroundColor: AppColorsDark.primary,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColorsDark.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: AppColorsDark.border),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColorsDark.accent,
        foregroundColor: AppColorsDark.background,
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: AppColorsDark.surface,
      indicatorColor: AppColorsDark.accent.withValues(alpha: 0.12),
    ),
  );
}