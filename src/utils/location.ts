export const UZBEKISTAN_REGIONS = [
  'Toshkent shahri',
  'Toshkent viloyati',
  'Andijon viloyati',
  'Buxoro viloyati',
  "Farg'ona viloyati",
  'Jizzax viloyati',
  'Xorazm viloyati',
  'Namangan viloyati',
  'Navoiy viloyati',
  'Qashqadaryo viloyati',
  "Qoraqalpog'iston Respublikasi",
  'Samarqand viloyati',
  'Sirdaryo viloyati',
  'Surxondaryo viloyati',
] as const;

export function formatAddress(region?: string, district?: string, landmark?: string): string {
  const parts = [region?.trim(), district?.trim(), landmark?.trim()].filter(Boolean);
  return parts.join(', ');
}

export function parseLegacyAddress(address?: string): {
  region: string;
  district: string;
  landmark: string;
} {
  if (!address) return { region: '', district: '', landmark: '' };

  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);

  if (parts.length === 0) {
    return { region: '', district: '', landmark: '' };
  }
  if (parts.length === 1) {
    return { region: parts[0], district: '', landmark: '' };
  }
  if (parts.length === 2) {
    return { region: parts[0], district: parts[1], landmark: '' };
  }

  // 3 or more parts
  return {
    region: parts[0],
    district: parts[1],
    landmark: parts.slice(2).join(', '),
  };
}
