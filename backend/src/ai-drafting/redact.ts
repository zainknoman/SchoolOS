/**
 * BL-49: personal identifiers are removed before a drafting request leaves the server (and
 * before the prompt is stored). A drafting context needs none of them.
 */
const RULES: [RegExp, string][] = [
  // CNIC / B-Form: 12345-1234567-1 or 13 digits
  [/\b\d{5}-?\d{7}-?\d\b/g, '[CNIC]'],
  // e-mail addresses
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[EMAIL]'],
  // Pakistani mobile and international phone numbers
  [/(?:\+92[\s-]?|\b0)3\d{2}[\s-]?\d{7}\b/g, '[PHONE]'],
  [/\+\d[\d\s-]{8,}\d/g, '[PHONE]'],
];

export function redactPersonalData(text: string): {
  text: string;
  redactions: number;
} {
  let redactions = 0;
  let out = text;
  for (const [pattern, label] of RULES) {
    out = out.replace(pattern, () => {
      redactions++;
      return label;
    });
  }
  return { text: out, redactions };
}
