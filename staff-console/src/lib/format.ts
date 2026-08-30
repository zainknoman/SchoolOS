export function formatPkrShort(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}K`;
  return `${amount}`;
}

export function formatPkrFull(amount: number): string {
  return new Intl.NumberFormat('en-US').format(amount);
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

const ROLE_INITIALS: Record<string, string> = {
  TEACHER: 'TR',
  SCHOOL_ADMIN: 'SA',
  ACCOUNTS: 'AC',
  SUPER_ADMIN: 'SU',
};

export function roleInitials(role: string | null): string {
  if (!role) return '?';
  return ROLE_INITIALS[role] ?? '?';
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}
