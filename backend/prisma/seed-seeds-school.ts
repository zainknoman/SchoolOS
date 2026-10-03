import 'dotenv/config';
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { OrgScopeService } from '../src/common/org-scope.service';
import type { StudentAccessService } from '../src/common/student-access.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { GradingScalesService } from '../src/gradebook/grading-scales.service';
import { GradesService } from '../src/gradebook/grades.service';
import { ResultPublicationsService } from '../src/gradebook/result-publications.service';
import { GeneratedReportCardsService } from '../src/report-cards/generated-report-cards.service';

/**
 * Demo seed: one fully set-up school, "The Seeds School" (code TSS), with a single student.
 *
 * Everything a school needs before admissions is here — campus, session and terms, classes and
 * sections, subjects, teachers and staff, a conflict-free timetable, gradebook categories and
 * assessments, syllabi, grading/fee/promotion/attendance policies, fee structures, holidays,
 * admissions and hiring pipelines — plus one student (Barzah Zain Noman, GR-02578, Class 3-C) with
 * her guardians, attendance, marks, vouchers, payments, diary, circulars, messages and a complaint.
 *
 * Re-runnable: every id is derived from a fixed key and every insert skips existing rows, so a second
 * run adds nothing. Dates that depend on "today" (attendance, marks, vouchers, report cards) only
 * grow. Random choices come from a seeded generator, so every run builds the same data.
 * `SEED_TODAY=YYYY-MM-DD` pretends a different date (testing). Development/test databases only.
 *
 * Run: `npm run prisma:seed:seeds-school` (needs DATABASE_URL, SEED_PASSWORD, NODE_ENV).
 */

if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
  throw new Error(
    `Refusing to run the demo seed with NODE_ENV=${process.env.NODE_ENV ?? '(unset)'}; it only runs in development/test.`,
  );
}
const PASSWORD: string = (() => {
  const value = process.env.SEED_PASSWORD;
  if (!value)
    throw new Error('SEED_PASSWORD is required when running the seed.');
  return value;
})();
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// --- Deterministic helpers ------------------------------------------------------------------------

/** A stable UUID for a key — the same key always gives the same id. */
function id(key: string): string {
  const h = createHash('sha1').update(`tss-seed:${key}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

type Rng = () => number;
/** mulberry32, seeded from a key, so each entity's random fields do not depend on insert order. */
function rngFor(key: string): Rng {
  let a = createHash('sha1').update(`tss-rng:${key}`).digest().readUInt32BE(0);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(r: Rng, list: readonly T[]): T =>
  list[Math.floor(r() * list.length)];
const int = (r: Rng, min: number, max: number) =>
  min + Math.floor(r() * (max - min + 1));
function shuffled<T>(r: Rng, list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const digits = (r: Rng, n: number) =>
  Array.from({ length: n }, () => int(r, 0, 9)).join('');

/** Dates are UTC midnight, as the API stores them. */
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, n: number) =>
  new Date(date.getTime() + n * 86_400_000);
const isWeekday = (date: Date) =>
  date.getUTCDay() >= 1 && date.getUTCDay() <= 5;
const at = (date: Date, hhmm: string) =>
  new Date(`${iso(date)}T${hhmm}:00.000Z`);
const MONTHS = [
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
const short = (date: Date) =>
  `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
const rupees = (pkr: number) => pkr * 100; // amounts are stored in paisa

const TODAY = process.env.SEED_TODAY
  ? d(process.env.SEED_TODAY)
  : d(iso(new Date()));

/** Karachi mobile number, 03XX-XXXXXXX. */
const mobile = (r: Rng) =>
  `03${pick(r, ['00', '01', '02', '03', '12', '13', '15', '21', '22', '23', '33', '34', '45'])}-${digits(r, 7)}`;
/** Fictional 13-digit CNIC/B-Form, XXXXX-XXXXXXX-X; the last digit is odd for males, even for females. */
function cnic(r: Rng, gender: 'MALE' | 'FEMALE'): string {
  const last =
    gender === 'MALE' ? pick(r, [1, 3, 5, 7, 9]) : pick(r, [2, 4, 6, 8]);
  return `${pick(r, ['42101', '42201', '42301', '42401', '42501'])}-${digits(r, 7)}-${last}`;
}

const AREAS = [
  'Gulistan-e-Jauhar Block 7',
  'Gulistan-e-Jauhar Block 13',
  'Gulistan-e-Jauhar Block 15',
  'Gulistan-e-Jauhar Block 18',
  'Gulshan-e-Iqbal Block 13-D',
  'Gulshan-e-Iqbal Block 10',
  'Abul Hassan Isphahani Road',
  'Safoora Goth',
  'Scheme 33',
  'Malir Cantt',
];
function address(key: string, area?: string) {
  const r = rngFor(`addr:${key}`);
  const place = area ?? pick(r, AREAS);
  return {
    id: id(`address:${key}`),
    line1: `${pick(r, ['House', 'Flat', 'House', 'Bungalow'])} ${pick(r, ['A', 'B', 'C', 'R', 'D'])}-${int(r, 1, 450)}, ${place}`,
    line2: pick(r, [
      'Near Rado Bakery',
      'Opposite Johar Chowrangi',
      'Near Continental Bakery',
      'Behind Kamran Chowrangi',
      'Near Darul Sehat Hospital',
      null,
    ]),
    area: place,
    city: 'Karachi',
    district: 'Karachi East',
    province: 'Sindh',
    postalCode: pick(r, ['75290', '75300', '75330', '74900']),
    country: 'Pakistan',
  };
}

const MALE_NAMES = [
  'Muhammad',
  'Ahmed',
  'Ali',
  'Hassan',
  'Hamza',
  'Bilal',
  'Usman',
  'Faisal',
  'Imran',
  'Kashif',
  'Saad',
  'Adeel',
  'Junaid',
  'Waqas',
  'Asad',
  'Fahad',
  'Danish',
  'Shahzaib',
  'Zeeshan',
  'Rizwan',
];
const FEMALE_NAMES = [
  'Ayesha',
  'Fatima',
  'Maryam',
  'Sana',
  'Hira',
  'Rabia',
  'Sadia',
  'Nida',
  'Amna',
  'Saima',
  'Farah',
  'Uzma',
  'Samina',
  'Bushra',
  'Mehwish',
  'Kiran',
  'Shazia',
  'Rubina',
  'Asma',
  'Nazia',
  'Tahira',
  'Erum',
  'Sumaira',
  'Lubna',
];
const SURNAMES = [
  'Siddiqui',
  'Qureshi',
  'Ansari',
  'Abbasi',
  'Memon',
  'Shaikh',
  'Baig',
  'Hashmi',
  'Rizvi',
  'Jafri',
  'Mirza',
  'Khan',
  'Malik',
  'Soomro',
  'Abro',
  'Bhatti',
  'Junejo',
  'Zaidi',
  'Farooqui',
  'Usmani',
  'Kazmi',
  'Naqvi',
  'Chandio',
  'Lakhani',
];

// --- Bulk insert ------------------------------------------------------------------------------------

type Delegate = {
  createMany(args: {
    data: unknown[];
    skipDuplicates?: boolean;
  }): Promise<{ count: number }>;
};
const counts = new Map<string, { inserted: number; total: number }>();

/** createMany in batches of 1,000, skipping rows already present (re-runs insert nothing). */
async function insert(
  model: string,
  rows: unknown[],
  client: unknown = prisma,
): Promise<void> {
  const delegate = (client as Record<string, Delegate>)[model];
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 1000) {
    const res = await delegate.createMany({
      data: rows.slice(i, i + 1000),
      skipDuplicates: true,
    });
    inserted += res.count;
  }
  const c = counts.get(model) ?? { inserted: 0, total: 0 };
  counts.set(model, {
    inserted: c.inserted + inserted,
    total: c.total + rows.length,
  });
}
const stage = (name: string) => console.log(`• ${name}`);

// --- School definition ---------------------------------------------------------------------------

const SCHOOL_CODE = 'TSS';
const DOMAIN = 'tss.schoolos.local';
const SESSION = {
  label: '2026-2027',
  start: d('2026-08-01'),
  end: d('2027-05-31'),
};
const TERMS = [
  {
    key: 't1',
    label: 'First Term',
    order: 1,
    start: d('2026-08-01'),
    end: d('2026-10-30'),
  },
  {
    key: 't2',
    label: 'Second Term',
    order: 2,
    start: d('2026-11-01'),
    end: d('2027-01-30'),
  },
  {
    key: 't3',
    label: 'Final Term',
    order: 3,
    start: d('2027-02-01'),
    end: d('2027-05-10'),
  },
];
const HOLIDAYS: [string, string, string][] = [
  ['Independence Day', '2026-08-14', '2026-08-14'],
  ['12 Rabi-ul-Awwal (Eid Milad-un-Nabi)', '2026-08-26', '2026-08-26'],
  ['Iqbal Day', '2026-11-09', '2026-11-09'],
  ['Winter Vacation and Quaid-e-Azam Day', '2026-12-21', '2026-12-31'],
  ['Kashmir Solidarity Day', '2027-02-05', '2027-02-05'],
  ['Eid-ul-Fitr', '2027-03-09', '2027-03-12'],
  ['Pakistan Day', '2027-03-23', '2027-03-23'],
  ['Labour Day', '2027-05-01', '2027-05-01'],
  ['Eid-ul-Adha', '2027-05-17', '2027-05-19'],
];

const S = {
  english: 'English',
  urdu: 'Urdu',
  maths: 'Maths',
  computer: 'Computer',
  science: 'Science',
  social: 'Social Studies',
  islamiat: 'Islamiat',
  sindhi: 'Sindhi',
  lab: 'Computer Lab',
  arts: 'Arts',
  nazra: 'Nazra',
  pt: 'Physical Training (P.T)',
  library: 'Library',
  gk: 'General Knowledge',
  rhymes: 'Rhymes & Activity',
} as const;
const ALL_SUBJECTS = Object.values(S);

/** Periods per week; each plan totals 40 (8 periods × 5 days). */
const PRIMARY_PLAN: Record<string, number> = {
  [S.english]: 5,
  [S.urdu]: 5,
  [S.maths]: 5,
  [S.computer]: 4,
  [S.science]: 4,
  [S.social]: 4,
  [S.islamiat]: 4,
  [S.sindhi]: 4,
  [S.lab]: 1,
  [S.arts]: 1,
  [S.nazra]: 1,
  [S.pt]: 1,
  [S.library]: 1,
};
const EARLY_PLAN: Record<string, number> = {
  [S.english]: 6,
  [S.urdu]: 6,
  [S.maths]: 6,
  [S.gk]: 5,
  [S.islamiat]: 4,
  [S.nazra]: 1,
  [S.arts]: 4,
  [S.rhymes]: 4,
  [S.pt]: 4,
};
/** Only daily subjects are examined (owner decision). */
const PRIMARY_EXAMINED = [
  S.english,
  S.urdu,
  S.maths,
  S.computer,
  S.science,
  S.social,
  S.islamiat,
  S.sindhi,
];
const EARLY_EXAMINED = [S.english, S.urdu, S.maths, S.gk, S.islamiat];

interface ClassDef {
  key: string;
  name: string;
  short: string;
  early: boolean;
  age: number;
  level: number;
}
const CLASSES: ClassDef[] = [
  {
    key: 'mont',
    name: 'Montessori',
    short: 'Mont',
    early: true,
    age: 3,
    level: 0,
  },
  { key: 'kg1', name: 'KG-1', short: 'KG1', early: true, age: 4, level: 1 },
  { key: 'kg2', name: 'KG-2', short: 'KG2', early: true, age: 5, level: 2 },
  ...Array.from({ length: 10 }, (_, i) => ({
    key: `c${i + 1}`,
    name: `Class ${i + 1}`,
    short: `${i + 1}`,
    early: false,
    age: 6 + i,
    level: i + 1,
  })),
];
const SECTION_LETTERS = ['A', 'B', 'C'];

const MON_THU = [
  ['08:00', '08:40'],
  ['08:40', '09:20'],
  ['09:20', '10:00'],
  ['10:00', '10:40'],
  ['11:00', '11:40'],
  ['11:40', '12:20'],
  ['12:20', '13:00'],
  ['13:00', '13:40'],
];
const FRIDAY = [
  ['08:00', '08:30'],
  ['08:30', '09:00'],
  ['09:00', '09:30'],
  ['09:30', '10:00'],
  ['10:25', '10:55'],
  ['10:55', '11:25'],
  ['11:25', '11:55'],
  ['11:55', '12:25'],
];
const MAX_LOAD = 30;

/** Teaching groups: subjects taught together and the sections they cover (1–2 subjects each). */
const TEACHING_GROUPS: {
  key: string;
  subjects: string[];
  early: boolean;
  qualification: string;
}[] = [
  {
    key: 'eng',
    subjects: [S.english],
    early: false,
    qualification: 'M.A. English Literature, B.Ed.',
  },
  {
    key: 'urd',
    subjects: [S.urdu],
    early: false,
    qualification: 'M.A. Urdu, B.Ed.',
  },
  {
    key: 'mat',
    subjects: [S.maths],
    early: false,
    qualification: 'M.Sc. Mathematics, B.Ed.',
  },
  {
    key: 'cmp',
    subjects: [S.computer, S.lab],
    early: false,
    qualification: 'BS Computer Science',
  },
  {
    key: 'sci',
    subjects: [S.science],
    early: false,
    qualification: 'M.Sc. Chemistry, B.Ed.',
  },
  {
    key: 'sst',
    subjects: [S.social],
    early: false,
    qualification: 'M.A. History, B.Ed.',
  },
  {
    key: 'isl',
    subjects: [S.islamiat, S.nazra],
    early: false,
    qualification: 'M.A. Islamic Studies, Shahadat-ul-Aalmiya',
  },
  {
    key: 'snd',
    subjects: [S.sindhi],
    early: false,
    qualification: 'M.A. Sindhi, B.Ed.',
  },
  {
    key: 'art',
    subjects: [S.arts],
    early: false,
    qualification: 'BFA, Indus Valley School of Art and Architecture',
  },
  {
    key: 'ptp',
    subjects: [S.pt],
    early: false,
    qualification: 'B.S. Physical Education',
  },
  {
    key: 'lib',
    subjects: [S.library],
    early: false,
    qualification: 'M.L.I.S. (Library and Information Science)',
  },
  {
    key: 'ey-eng',
    subjects: [S.english],
    early: true,
    qualification: 'B.A. English, Montessori Diploma',
  },
  {
    key: 'ey-urd',
    subjects: [S.urdu],
    early: true,
    qualification: 'B.A. Urdu, Early Childhood Education Certificate',
  },
  {
    key: 'ey-mat',
    subjects: [S.maths],
    early: true,
    qualification: 'B.Sc., Montessori Diploma',
  },
  {
    key: 'ey-gk',
    subjects: [S.gk, S.nazra],
    early: true,
    qualification: 'B.A., Diploma in Early Childhood Education',
  },
  {
    key: 'ey-isl',
    subjects: [S.islamiat],
    early: true,
    qualification: 'M.A. Islamic Studies',
  },
  {
    key: 'ey-art',
    subjects: [S.arts, S.rhymes],
    early: true,
    qualification: 'B.A. Fine Arts, Montessori Diploma',
  },
  {
    key: 'ey-pt',
    subjects: [S.pt],
    early: true,
    qualification: 'B.S. Physical Education',
  },
];

/** Unit titles per subject, easiest first; a class reads a window of them by its level. */
const TOPICS: Record<string, string[]> = {
  [S.english]: [
    'Phonics and sight words',
    'Nouns and pronouns',
    'Simple sentences',
    'Verbs and tenses',
    'Adjectives and adverbs',
    'Reading comprehension',
    'Paragraph writing',
    'Letter and application writing',
    'Prepositions and conjunctions',
    'Active and passive voice',
    'Direct and indirect speech',
    'Story writing',
    'Poetry appreciation',
    'Essay writing',
    'Precis and summary writing',
    'Literature: prose selections',
  ],
  [S.urdu]: [
    'Huroof-e-Tahajji',
    'Alfaaz aur jumlay',
    'Ism aur Fail',
    'Kahani parhna',
    'Mazmoon nigari',
    'Khat aur darkhwast',
    'Muhavray aur zarb-ul-amsal',
    'Nazm ki tashreeh',
    'Qawaid: Zamir aur Sift',
    'Ghazal ka taaruf',
    'Insha pardazi',
    'Tafheem-e-ibarat',
    'Nasr ke asbaq',
    'Khulasa nigari',
    'Adabi asnaf',
    'Tanqeedi mutalia',
  ],
  [S.maths]: [
    'Counting and number names',
    'Addition and subtraction',
    'Multiplication tables',
    'Division',
    'Fractions',
    'Decimals',
    'Measurement and units',
    'Geometry: shapes and angles',
    'Percentages',
    'Ratio and proportion',
    'Integers',
    'Algebraic expressions',
    'Linear equations',
    'Factorisation',
    'Sets and functions',
    'Matrices and determinants',
    'Quadratic equations',
    'Trigonometry basics',
  ],
  [S.computer]: [
    'Parts of a computer',
    'Using the mouse and keyboard',
    'Paint and drawing tools',
    'Typing practice',
    'Word processing basics',
    'Files and folders',
    'Internet safety',
    'Presentations',
    'Spreadsheets',
    'Introduction to algorithms',
    'Scratch programming',
    'Networks and the internet',
    'HTML basics',
    'Python fundamentals',
    'Databases',
    'Problem solving with flowcharts',
  ],
  [S.science]: [
    'Living and non-living things',
    'Plants and their parts',
    'Animals and their habitats',
    'Our body',
    'Matter and its states',
    'Force and motion',
    'Light and shadows',
    'Water cycle',
    'Electricity and circuits',
    'Cells and organisms',
    'Acids, bases and salts',
    'Heat and temperature',
    'Sound',
    'Chemical reactions',
    'Human systems',
    'Environment and ecology',
  ],
  [S.social]: [
    'My family and community',
    'Our neighbourhood',
    'Pakistan: provinces and capitals',
    'Maps and directions',
    'Means of transport',
    'Our national heroes',
    'History of the subcontinent',
    'Pakistan Movement',
    'Climate and natural resources',
    'Government and citizenship',
    'Population and settlements',
    'Economy of Pakistan',
    'World geography',
    'Pakistan and the world',
    'Human rights',
    'Culture and heritage of Sindh',
  ],
  [S.islamiat]: [
    'Kalimas',
    'Arkan-e-Islam',
    'Wudu and Salah',
    'Seerat-un-Nabi (SAW)',
    'Stories of the Prophets',
    'Akhlaq: good manners',
    'Huqooq-ul-Ibad',
    'Selected Surahs',
    'Hadith and Sunnah',
    'Khulafa-e-Rashideen',
    'Islamic months and festivals',
    'Zakat and Hajj',
    'Quranic teachings',
    'Islamic civilisation',
    'Ethics and society',
    'Tafseer of selected verses',
  ],
  [S.sindhi]: [
    'Sindhi alphabet',
    'Lafz ain jumla',
    'Kahaani parhan',
    'Nazm',
    'Grammar: ism ain fael',
    'Mazmoon',
    'Khat likhan',
    'Muhawra',
    'Sindh ji tareekh',
    'Shah Abdul Latif ji shayari',
    'Nasr jo mutalio',
    'Insha',
    'Adabi tanqeed',
    'Lok kahaniyon',
    'Khulaso likhan',
    'Sindhi adab',
  ],
  [S.gk]: [
    'My school',
    'Colours and shapes',
    'Fruits and vegetables',
    'Animals around us',
    'Seasons and weather',
    'Community helpers',
    'Our national symbols',
    'Healthy habits',
  ],
};

// --- Main --------------------------------------------------------------------------------------------

async function main() {
  console.log(`The Seeds School seed — as of ${iso(TODAY)}`);
  const passwordHash = await argon2.hash(PASSWORD);

  // ---------------------------------------------------------------- organisation
  stage('Organisation: school, campus, session, terms, holidays');
  const schoolId = id('school');
  const existing = await prisma.school.findUnique({
    where: { code: SCHOOL_CODE },
  });
  if (existing && existing.id !== schoolId) {
    throw new Error(
      `A school with code ${SCHOOL_CODE} already exists (${existing.id}) but was not made by this seed; aborting.`,
    );
  }
  const campusId = id('campus');
  const sessionId = id('session:2026-2027');
  const otherActive = await prisma.academicSession.findFirst({
    where: { schoolId, isActive: true, NOT: { id: sessionId } },
  });
  if (otherActive) {
    throw new Error(
      `The Seeds School already has another active session (${otherActive.label}); this seed will not deactivate it. Resolve it first.`,
    );
  }
  const schoolAddress = address('school', 'Gulistan-e-Jauhar Block 7');
  schoolAddress.line1 = 'Plot ST-12, Block 7, Gulistan-e-Jauhar';
  schoolAddress.line2 = 'Near Johar Chowrangi';
  const campusAddress = {
    ...address('campus', 'Gulistan-e-Jauhar Block 7'),
    line1: 'Plot ST-12, Block 7, Gulistan-e-Jauhar',
    line2: 'Main University Road side',
  };
  await insert('address', [schoolAddress, campusAddress]);
  await insert('school', [
    {
      id: schoolId,
      name: 'The Seeds School',
      code: SCHOOL_CODE,
      registrationNumber: 'DIPS-KHI-2009-0417',
      website: 'https://theseeds.example.edu.pk',
      principalName: 'Mrs. Farzana Siddiqui',
      principalPhone: '0321-2457813',
      principalEmail: `principal@${DOMAIN}`,
      establishedDate: d('2009-03-16'),
      schoolType: 'PRIVATE',
      educationBoard: 'Board of Secondary Education Karachi (BSEK)',
      timezone: 'Asia/Karachi',
      currency: 'PKR',
      alternatePhone: '021-34012457',
      addressId: schoolAddress.id,
      address: `${schoolAddress.line1}, Karachi`,
      phone: '021-34012456',
      email: `info@${DOMAIN}`,
    },
  ]);
  await insert('campus', [
    {
      id: campusId,
      schoolId,
      name: 'Gulistan-e-Jauhar Block-7',
      code: 'TSS-1',
      campusType: 'MAIN',
      principalName: 'Mrs. Farzana Siddiqui',
      principalPhone: '0321-2457813',
      principalEmail: `principal@${DOMAIN}`,
      openingDate: d('2009-04-01'),
      capacity: 900,
      latitude: 24.9147,
      longitude: 67.1319,
      departments: [
        'Early Years',
        'Primary',
        'Secondary',
        'Administration',
        'Accounts',
      ],
      alternatePhone: '021-34012458',
      addressId: campusAddress.id,
      address: `${campusAddress.line1}, Karachi`,
      phone: '021-34012456',
      email: `block7@${DOMAIN}`,
    },
  ]);
  await insert('academicSession', [
    {
      id: sessionId,
      schoolId,
      label: SESSION.label,
      startDate: SESSION.start,
      endDate: SESSION.end,
      isActive: true,
    },
  ]);
  await insert(
    'term',
    TERMS.map((t) => ({
      id: id(`term:${t.key}`),
      academicSessionId: sessionId,
      label: t.label,
      order: t.order,
      startDate: t.start,
      endDate: t.end,
    })),
  );
  await insert(
    'holiday',
    HOLIDAYS.map(([title, from, to]) => ({
      id: id(`holiday:${from}`),
      title,
      startDate: d(from),
      endDate: d(to),
      schoolId,
      campusId: null,
    })),
  );
  const holidayDates = new Set<string>();
  for (const [, from, to] of HOLIDAYS)
    for (let x = d(from); x <= d(to); x = addDays(x, 1))
      holidayDates.add(iso(x));
  const isSchoolDay = (date: Date) =>
    isWeekday(date) &&
    !holidayDates.has(iso(date)) &&
    date >= SESSION.start &&
    date <= SESSION.end;

  // ---------------------------------------------------------------- staff accounts
  stage('Staff accounts: admin, principal, accounts, office and support staff');
  const adminUserId = id('user:admin');
  const principalUserId = id('user:principal');
  const accountsUserId = id('user:accounts');
  await insert('user', [
    {
      id: adminUserId,
      identifier: `admin@${DOMAIN}`,
      passwordHash,
      role: 'SCHOOL_ADMIN',
      schoolId,
    },
    {
      id: principalUserId,
      identifier: `principal@${DOMAIN}`,
      passwordHash,
      role: 'SCHOOL_ADMIN',
      isPrincipal: true,
      schoolId,
    },
    {
      id: accountsUserId,
      identifier: `accounts@${DOMAIN}`,
      passwordHash,
      role: 'ACCOUNTS',
      schoolId,
      grants: ['MESSAGES'],
    },
  ]);
  type Person = {
    key: string;
    first: string;
    middle?: string;
    last: string;
    gender: 'MALE' | 'FEMALE';
  };
  const staffRows: Record<string, unknown>[] = [];
  const staffAddresses: Record<string, unknown>[] = [];
  const staffContacts: Record<string, unknown>[] = [];
  const staffExperience: Record<string, unknown>[] = [];
  function addStaff(
    p: Person,
    extra: {
      employeeType: string;
      userId?: string;
      teacherId?: string;
      email?: string;
      joined: Date;
      role: string;
      qualification: string;
      age: number;
    },
  ) {
    const r = rngFor(`staff:${p.key}`);
    const cur = address(`staff-cur:${p.key}`);
    const perm = address(`staff-perm:${p.key}`);
    staffAddresses.push(cur, perm);
    const staffId = id(`staff:${p.key}`);
    const name = [p.first, p.middle, p.last].filter(Boolean).join(' ');
    staffRows.push({
      id: staffId,
      userId: extra.userId ?? null,
      name,
      firstName: p.first,
      middleName: p.middle ?? null,
      lastName: p.last,
      employeeType: extra.employeeType,
      campusId,
      gender: p.gender,
      dateOfBirth: d(
        `${2026 - extra.age}-${String(int(r, 1, 12)).padStart(2, '0')}-${String(int(r, 1, 28)).padStart(2, '0')}`,
      ),
      cnic: cnic(r, p.gender),
      mobile: mobile(r),
      email: extra.email ?? null,
      currentAddressId: cur.id,
      permanentAddressId: perm.id,
      joiningDate: extra.joined,
      employmentStatus: 'ACTIVE',
      teacherId: extra.teacherId ?? null,
    });
    const kin =
      p.gender === 'FEMALE'
        ? pick(r, ['Husband', 'Father', 'Brother'])
        : pick(r, ['Wife', 'Father', 'Brother']);
    staffContacts.push({
      id: id(`staff-contact:${p.key}`),
      staffId,
      name: `${kin === 'Wife' ? pick(r, FEMALE_NAMES) : pick(r, MALE_NAMES)} ${p.last}`,
      relationship: kin,
      phone: mobile(r),
      alternatePhone: mobile(r),
      priority: 1,
      isPrimary: true,
    });
    const prevYears = int(r, 2, 6);
    const prevEnd = addDays(extra.joined, -int(r, 20, 60));
    const prevStart = d(`${prevEnd.getUTCFullYear() - prevYears}-08-01`);
    staffExperience.push({
      id: id(`staff-exp:${p.key}`),
      staffId,
      organization: pick(r, [
        'Bright Future Grammar School',
        'City Model School',
        'Al-Huda Academy',
        'Karachi Public School System',
        'Beaconlight Academy',
      ]),
      role: extra.role,
      fromDate: prevStart,
      toDate: prevEnd,
      description: `Qualification: ${extra.qualification}. ${prevYears} years at the previous school.`,
    });
    return staffId;
  }
  addStaff(
    { key: 'admin', first: 'Kamran', last: 'Qureshi', gender: 'MALE' },
    {
      employeeType: 'OFFICE_STAFF',
      userId: adminUserId,
      email: `admin@${DOMAIN}`,
      joined: d('2015-07-01'),
      role: 'Administrative Officer',
      qualification: 'MBA (HR)',
      age: 44,
    },
  );
  addStaff(
    { key: 'principal', first: 'Farzana', last: 'Siddiqui', gender: 'FEMALE' },
    {
      employeeType: 'OFFICE_STAFF',
      userId: principalUserId,
      email: `principal@${DOMAIN}`,
      joined: d('2012-08-01'),
      role: 'Vice Principal',
      qualification: 'M.Ed., M.A. English',
      age: 51,
    },
  );
  addStaff(
    {
      key: 'accounts',
      first: 'Naveed',
      last: 'Ahmed',
      middle: 'Iqbal',
      gender: 'MALE',
    },
    {
      employeeType: 'OFFICE_STAFF',
      userId: accountsUserId,
      email: `accounts@${DOMAIN}`,
      joined: d('2018-01-15'),
      role: 'Accountant',
      qualification: 'B.Com, ICMA (Part)',
      age: 38,
    },
  );
  const SUPPORT: [string, string, string, 'MALE' | 'FEMALE', string, string][] =
    [
      [
        'receptionist',
        'Saba',
        'Hashmi',
        'FEMALE',
        'OFFICE_STAFF',
        'Receptionist',
      ],
      [
        'office-assistant',
        'Arif',
        'Memon',
        'MALE',
        'OFFICE_STAFF',
        'Office Assistant',
      ],
      [
        'lab-assistant',
        'Tariq',
        'Baig',
        'MALE',
        'OFFICE_STAFF',
        'Computer Lab Assistant',
      ],
      ['janitor-1', 'Shabbir', 'Masih', 'MALE', 'JANITORIAL', 'Janitor'],
      ['janitor-2', 'Javed', 'Gill', 'MALE', 'JANITORIAL', 'Janitor'],
      ['helper-1', 'Parveen', 'Bibi', 'FEMALE', 'HELPER', 'Early Years Helper'],
      ['helper-2', 'Razia', 'Begum', 'FEMALE', 'HELPER', 'Early Years Helper'],
      ['guard-1', 'Gul', 'Khan', 'MALE', 'GUARD', 'Security Guard'],
      ['guard-2', 'Sher', 'Zaman', 'MALE', 'GUARD', 'Security Guard'],
      ['driver', 'Nadeem', 'Abbasi', 'MALE', 'OTHER', 'Van Driver'],
    ];
  for (const [key, first, last, gender, type, role] of SUPPORT) {
    addStaff(
      { key, first, last, gender },
      {
        employeeType: type,
        joined: d(
          `20${int(rngFor(key), 14, 23)}-0${int(rngFor(key + 'm'), 1, 9)}-01`,
        ),
        role,
        qualification:
          type === 'OFFICE_STAFF' ? 'Intermediate (Commerce)' : 'Matric',
        age: int(rngFor(key + 'a'), 24, 55),
      },
    );
  }

  // ---------------------------------------------------------------- subjects, classes, sections
  stage('Subjects, classes and sections');
  const subjectId = (name: string) => id(`subject:${name}`);
  await insert(
    'subject',
    ALL_SUBJECTS.map((name) => ({
      id: subjectId(name),
      schoolId,
      name,
      isActive: true,
    })),
  );

  interface SectionDef {
    id: string;
    classDef: ClassDef;
    classId: string;
    letter: string;
    name: string;
    plan: Record<string, number>;
  }
  const sections: SectionDef[] = [];
  for (const c of CLASSES) {
    for (const letter of SECTION_LETTERS) {
      sections.push({
        id: id(`section:${c.key}:${letter}`),
        classDef: c,
        classId: id(`class:${c.key}`),
        letter,
        name: `${c.short}-${letter}`,
        plan: c.early ? EARLY_PLAN : PRIMARY_PLAN,
      });
    }
  }

  // ---------------------------------------------------------------- teachers and teaching load
  stage('Teachers: allocation, class teachers and a conflict-free timetable');
  interface TeacherDef {
    key: string;
    id: string;
    userId: string;
    person: Person;
    email: string;
    group: (typeof TEACHING_GROUPS)[number];
    sectionIds: string[];
  }
  const teachers: TeacherDef[] = [];
  const usedEmails = new Set<string>();
  /** subject teacher per section and subject */
  const teacherFor = new Map<string, TeacherDef>();
  for (const group of TEACHING_GROUPS) {
    const pool = sections.filter((s) => s.classDef.early === group.early);
    const perSection = group.subjects.reduce(
      (sum, s) => sum + (pool[0].plan[s] ?? 0),
      0,
    );
    const capacity = Math.floor(MAX_LOAD / perSection);
    const n = Math.ceil(pool.length / capacity);
    const base = Math.floor(pool.length / n);
    let extra = pool.length % n;
    let cursor = 0;
    for (let t = 0; t < n; t++) {
      const size = base + (extra-- > 0 ? 1 : 0);
      const key = `${group.key}-${t + 1}`;
      const r = rngFor(`teacher:${key}`);
      const gender: 'MALE' | 'FEMALE' =
        group.key === 'ptp' || group.key === 'isl'
          ? pick(r, ['MALE', 'MALE', 'FEMALE'])
          : r() < 0.78
            ? 'FEMALE'
            : 'MALE';
      const person: Person = {
        key: `teacher:${key}`,
        first: pick(r, gender === 'MALE' ? MALE_NAMES : FEMALE_NAMES),
        last: pick(r, SURNAMES),
        gender,
      };
      let email = `${person.first}.${person.last}@${DOMAIN}`.toLowerCase();
      for (let k = 2; usedEmails.has(email); k++)
        email = `${person.first}.${person.last}${k}@${DOMAIN}`.toLowerCase();
      usedEmails.add(email);
      const def: TeacherDef = {
        key,
        id: id(`teacher:${key}`),
        userId: id(`user:teacher:${key}`),
        person,
        email,
        group,
        sectionIds: pool.slice(cursor, cursor + size).map((s) => s.id),
      };
      cursor += size;
      teachers.push(def);
      for (const sid of def.sectionIds)
        for (const subject of group.subjects)
          teacherFor.set(`${sid}:${subject}`, def);
    }
  }
  for (const s of sections)
    for (const subject of Object.keys(s.plan)) {
      if (!teacherFor.has(`${s.id}:${subject}`))
        throw new Error(`No teacher for ${subject} in ${s.name}`);
    }

  // Class teacher: a teacher of the section with the most periods there, each teacher at most once.
  const classTeacher = new Map<string, TeacherDef>();
  const taken = new Set<string>();
  for (const s of sections) {
    const candidates = teachers
      .filter((t) => t.sectionIds.includes(s.id) && !taken.has(t.id))
      .map((t) => ({
        t,
        periods: t.group.subjects.reduce(
          (sum, sub) => sum + (s.plan[sub] ?? 0),
          0,
        ),
      }))
      .sort((a, b) => b.periods - a.periods || a.t.key.localeCompare(b.t.key));
    if (!candidates.length)
      throw new Error(`No free class teacher for ${s.name}`);
    classTeacher.set(s.id, candidates[0].t);
    taken.add(candidates[0].t.id);
  }

  const timetable = buildTimetable(sections, teacherFor);

  const teacherUsers = teachers.map((t) => ({
    id: t.userId,
    identifier: t.email,
    passwordHash,
    role: 'TEACHER',
    schoolId,
    campusId: null,
  }));
  await insert('user', teacherUsers);
  await insert(
    'teacher',
    teachers.map((t) => ({
      id: t.id,
      userId: t.userId,
      name: `${t.person.first} ${t.person.last}`,
      campusId,
    })),
  );
  for (const t of teachers) {
    const r = rngFor(`join:${t.key}`);
    addStaff(t.person, {
      employeeType: 'TEACHER',
      userId: t.userId,
      teacherId: t.id,
      email: t.email,
      joined: d(`20${int(r, 12, 25)}-08-01`),
      role: t.group.early
        ? 'Early Years Teacher'
        : `${t.group.subjects[0]} Teacher`,
      qualification: t.group.qualification,
      age: int(r, 26, 52),
    });
  }
  await insert('address', staffAddresses);
  await insert('staff', staffRows);
  await insert('staffEmergencyContact', staffContacts);
  await insert('staffExperience', staffExperience);

  await insert(
    'class',
    CLASSES.map((c) => ({
      id: id(`class:${c.key}`),
      campusId,
      academicSessionId: sessionId,
      name: c.name,
    })),
  );
  await insert(
    'section',
    sections.map((s) => ({
      id: s.id,
      classId: s.classId,
      name: s.name,
      classTeacherId: classTeacher.get(s.id)!.id,
    })),
  );
  const room = (subject: string, s: SectionDef) =>
    subject === S.lab
      ? 'Computer Lab'
      : subject === S.library
        ? 'Library'
        : subject === S.pt
          ? 'Playground'
          : subject === S.arts
            ? 'Art Room'
            : `Room ${s.name}`;
  await insert(
    'timetable',
    timetable.map((slot) => {
      const s = sections.find((x) => x.id === slot.sectionId)!;
      const [startTime, endTime] = (slot.day === 5 ? FRIDAY : MON_THU)[
        slot.period - 1
      ];
      return {
        id: id(`tt:${slot.sectionId}:${slot.day}:${slot.period}`),
        sectionId: slot.sectionId,
        subjectId: subjectId(slot.subject),
        teacherId: teacherFor.get(`${slot.sectionId}:${slot.subject}`)!.id,
        dayOfWeek: slot.day,
        period: slot.period,
        startTime,
        endTime,
        room: room(slot.subject, s),
      };
    }),
  );

  // ---------------------------------------------------------------- policies
  stage('Policies: grading scale, promotion, attendance risk, fees');
  const scaleId = id('grading-scale');
  await insert('gradingScale', [
    {
      id: scaleId,
      schoolId,
      name: 'TSS Standard Scale',
      isDefault: true,
      updatedById: adminUserId,
    },
  ]);
  const BANDS: [number, string, string, number][] = [
    [90, 'A+', 'Outstanding', 4.0],
    [80, 'A', 'Excellent', 3.7],
    [70, 'B', 'Very Good', 3.0],
    [60, 'C', 'Good', 2.5],
    [50, 'D', 'Satisfactory', 2.0],
    [40, 'E', 'Needs Improvement', 1.0],
    [0, 'F', 'Unsatisfactory', 0],
  ];
  await insert(
    'gradeBand',
    BANDS.map(([minPercent, letter, remark, gradePoint]) => ({
      id: id(`band:${minPercent}`),
      gradingScaleId: scaleId,
      minPercent,
      letter,
      remark,
      gradePoint,
    })),
  );
  await insert('promotionPolicy', [
    {
      id: id('promotion-policy'),
      schoolId,
      minAttendancePercent: 75,
      minResultPercent: 40,
      blockOnAttendance: false,
      blockOnResults: true,
      blockOnFees: false,
      updatedById: adminUserId,
    },
  ]);
  await insert('attendanceRiskPolicy', [
    {
      id: id('risk-policy'),
      schoolId,
      windowDays: 30,
      thresholdPercent: 20,
      minTrackedDays: 10,
      notifyParents: true,
      updatedById: adminUserId,
    },
  ]);
  await insert('feePolicy', [
    {
      id: id('fee-policy'),
      schoolId,
      lateFeeAmount: rupees(500),
      lateFeeGraceDays: 5,
      updatedById: adminUserId,
    },
  ]);

  // ---------------------------------------------------------------- gradebook and syllabus
  stage('Gradebook categories, assessments and syllabi');
  const CATEGORIES: [string, string, number][] = [
    ['quiz', 'Quizzes', 10],
    ['assign', 'Assignments', 15],
    ['test', 'Class Test', 25],
    ['final', 'Term Final Exam', 50],
  ];
  const ASSESSMENTS: [string, string, string, number][] = [
    ['quiz', 'q1', 'Quiz 1', 0.2],
    ['assign', 'a1', 'Assignment 1', 0.3],
    ['quiz', 'q2', 'Quiz 2', 0.45],
    ['assign', 'a2', 'Assignment 2', 0.55],
    ['test', 't', 'Class Test', 0.68],
    ['final', 'f', 'Term Final Exam', 0.9],
  ];
  const categoryRows: Record<string, unknown>[] = [];
  const assessmentRows: {
    id: string;
    assessmentCategoryId: string;
    subjectId: string;
    label: string;
    maxMarks: number;
    date: Date;
    classKey: string;
    subject: string;
  }[] = [];
  for (const c of CLASSES) {
    const examined = c.early ? EARLY_EXAMINED : PRIMARY_EXAMINED;
    for (const t of TERMS) {
      for (const [ck, name, weight] of CATEGORIES)
        categoryRows.push({
          id: id(`cat:${c.key}:${t.key}:${ck}`),
          classId: id(`class:${c.key}`),
          termId: id(`term:${t.key}`),
          name,
          weightPercent: weight,
        });
      const span = (t.end.getTime() - t.start.getTime()) / 86_400_000;
      for (const subject of examined) {
        for (const [ck, ak, label, at_] of ASSESSMENTS) {
          let date = addDays(t.start, Math.round(span * at_));
          while (!isSchoolDay(date)) date = addDays(date, 1);
          const maxMarks =
            ck === 'quiz'
              ? 10
              : ck === 'assign'
                ? 20
                : ck === 'test'
                  ? 25
                  : c.early
                    ? 50
                    : 100;
          assessmentRows.push({
            id: id(`asmt:${c.key}:${t.key}:${subject}:${ak}`),
            assessmentCategoryId: id(`cat:${c.key}:${t.key}:${ck}`),
            subjectId: subjectId(subject),
            label: `${label} (${short(date)})`,
            maxMarks,
            date,
            classKey: c.key,
            subject,
          });
        }
      }
    }
  }
  await insert('assessmentCategory', categoryRows);
  await insert(
    'assessment',
    assessmentRows.map(
      ({ id: aid, assessmentCategoryId, subjectId: sid, label, maxMarks }) => ({
        id: aid,
        assessmentCategoryId,
        subjectId: sid,
        label,
        maxMarks,
      }),
    ),
  );

  const syllabi: Record<string, unknown>[] = [];
  const units: Record<string, unknown>[] = [];
  for (const c of CLASSES) {
    const examined = c.early ? EARLY_EXAMINED : PRIMARY_EXAMINED;
    for (const subject of examined) {
      const sylId = id(`syllabus:${c.key}:${subject}`);
      const bank = TOPICS[subject];
      const perClass = 6;
      const levels = c.early ? 3 : 10;
      const pos = c.early ? c.level : c.level - 1;
      const startAt = Math.round(
        (pos * Math.max(0, bank.length - perClass)) / Math.max(1, levels - 1),
      );
      const titles = Array.from(
        { length: perClass },
        (_, i) => bank[Math.min(bank.length - 1, startAt + i)],
      );
      syllabi.push({
        id: sylId,
        classId: id(`class:${c.key}`),
        subjectId: subjectId(subject),
        overview: `${subject} for ${c.name}: ${titles.slice(0, 3).join(', ').toLowerCase()} and more, taught over three terms with continuous assessment.`,
        updatedById: adminUserId,
      });
      titles.forEach((title, i) => {
        const term = TERMS[Math.floor(i / 2)];
        const half = (term.end.getTime() - term.start.getTime()) / 2;
        const start = new Date(term.start.getTime() + (i % 2) * half);
        units.push({
          id: id(`unit:${c.key}:${subject}:${i}`),
          syllabusId: sylId,
          order: i + 1,
          title,
          topics: `${title}: concepts, guided practice, worksheets and a short review.`,
          termId: id(`term:${term.key}`),
          plannedStart: d(iso(start)),
          plannedEnd: d(iso(new Date(start.getTime() + half - 86_400_000))),
        });
      });
    }
  }
  await insert('syllabus', syllabi);
  await insert('syllabusUnit', units);

  // ---------------------------------------------------------------- fee structures
  stage('Fee structures');
  const FEES: [string, string, number][] = [
    ['tuition-early', 'Monthly Tuition — Montessori & KG', 6500],
    ['tuition-1-5', 'Monthly Tuition — Classes 1–5', 8000],
    ['tuition-6-8', 'Monthly Tuition — Classes 6–8', 9500],
    ['tuition-9-10', 'Monthly Tuition — Classes 9–10', 11000],
    ['admission', 'Admission Fee', 25000],
    ['annual', 'Annual Charges', 12000],
    ['exam', 'Examination Fee', 2500],
  ];
  const INVOICED = new Set(['tuition-1-5', 'annual', 'exam']); // used on Barzah's vouchers
  await insert(
    'feeStructure',
    FEES.map(([key, name, pkr]) => ({
      id: id(`fee:${key}`),
      schoolId,
      status: INVOICED.has(key) ? 'LOCKED' : 'ACTIVE',
      name,
      amount: rupees(pkr),
    })),
  );

  // ---------------------------------------------------------------- the student: Barzah
  stage('Student: Barzah Zain Noman (GR-02578), guardians and enrolment');
  const section3C = sections.find(
    (s) => s.classDef.key === 'c3' && s.letter === 'C',
  )!;
  const studentId = id('student:GR-02578');
  const gr = 'GR-02578';
  const studentCur = {
    ...address('barzah-cur', 'Gulistan-e-Jauhar Block 7'),
    line1: 'House R-214, Block 7, Gulistan-e-Jauhar',
  };
  const studentPerm = {
    ...address('barzah-perm', 'Gulistan-e-Jauhar Block 7'),
    line1: 'House R-214, Block 7, Gulistan-e-Jauhar',
  };
  const prevSchoolAddr = address('barzah-prev', 'Gulistan-e-Jauhar Block 13');
  const fatherAddrCur = { ...studentCur, id: id('address:father-cur') };
  const fatherAddrPerm = { ...studentPerm, id: id('address:father-perm') };
  const motherAddrCur = { ...studentCur, id: id('address:mother-cur') };
  const motherAddrPerm = {
    ...address('mother-perm', 'Gulshan-e-Iqbal Block 13-D'),
  };
  const emergencyAddr = address(
    'barzah-emergency',
    'Gulshan-e-Iqbal Block 13-D',
  );
  await insert('address', [
    studentCur,
    studentPerm,
    prevSchoolAddr,
    fatherAddrCur,
    fatherAddrPerm,
    motherAddrCur,
    motherAddrPerm,
    emergencyAddr,
  ]);
  const br = rngFor('barzah');
  await insert('student', [
    {
      id: studentId,
      grNumber: gr,
      name: 'Barzah Zain Noman',
      firstName: 'Barzah',
      middleName: 'Zain',
      lastName: 'Noman',
      preferredName: 'Barzah',
      gender: 'FEMALE',
      dateOfBirth: d('2018-03-14'),
      placeOfBirth: 'Karachi',
      nationality: 'Pakistani',
      religion: 'Islam',
      bFormNumber: cnic(br, 'FEMALE'),
      status: 'ACTIVE',
      admissionDate: d('2022-08-01'),
      studentEmail: `${gr.toLowerCase()}@student.${DOMAIN}`,
      currentAddressId: studentCur.id,
      permanentAddressId: studentPerm.id,
    },
  ]);
  await insert('studentPreviousSchool', [
    {
      id: id('prev-school:barzah'),
      studentId,
      schoolName: 'Little Learners Montessori',
      addressId: prevSchoolAddr.id,
      contactNumber: '021-34619022',
      email: 'admissions@littlelearners.example.pk',
      lastClassAttended: 'Montessori',
      admissionDate: d('2021-04-05'),
      leavingDate: d('2022-06-30'),
      leavingCertificateNumber: 'LLM-LC-2022-118',
      leavingCertificateDate: d('2022-07-08'),
      reasonForLeaving: 'Moved to a full-time school closer to home',
      academicRemarks: 'Confident, curious learner; ready for KG.',
    },
  ]);
  await insert('studentMedicalInfo', [
    {
      id: id('medical:barzah'),
      studentId,
      bloodGroup: 'B_POS',
      allergies: 'None known',
      medicalConditions: 'None',
      specialEducationalNeeds: 'None',
      medicationNotes: 'No regular medication',
      emergencyMedicalNotes:
        'Call father first, then mother. Family doctor at Darul Sehat Hospital.',
    },
  ]);
  await insert('studentEmergencyContact', [
    {
      id: id('emergency:barzah'),
      studentId,
      name: 'Irshad Ali Abro',
      relationship: 'Maternal Grandfather',
      phone: mobile(br),
      alternatePhone: mobile(br),
      email: 'irshad.abro@example.pk',
      addressId: emergencyAddr.id,
      priority: 1,
      isPrimary: true,
    },
  ]);
  const enrollmentId = id('enrollment:barzah:2026-2027');
  await insert('enrollment', [
    {
      id: enrollmentId,
      studentId,
      campusId,
      sectionId: section3C.id,
      academicSessionId: sessionId,
      startDate: SESSION.start,
      status: 'ACTIVE',
      rollNumber: '15',
      remarks: 'Promoted from Class 2',
    },
  ]);

  const fatherUserId = id('user:father:GR-02578');
  const motherUserId = id('user:mother:GR-02578');
  const fatherProfileId = id('parent:father:GR-02578');
  const motherProfileId = id('parent:mother:GR-02578');
  const fr = rngFor('father');
  const mr = rngFor('mother');
  const fatherPhone = mobile(fr);
  const motherPhone = mobile(mr);
  await insert('user', [
    {
      id: fatherUserId,
      identifier: `father.${gr.toLowerCase()}@parent.schoolos.local`,
      passwordHash,
      role: 'PARENT',
      schoolId,
    },
    {
      id: motherUserId,
      identifier: `mother.${gr.toLowerCase()}@parent.schoolos.local`,
      passwordHash,
      role: 'PARENT',
      schoolId,
    },
  ]);
  await insert('parentProfile', [
    {
      id: fatherProfileId,
      userId: fatherUserId,
      name: 'Zain Noman Kamali',
      phone: fatherPhone,
      cnic: cnic(fr, 'MALE'),
      gender: 'MALE',
      dateOfBirth: d('1988-06-21'),
      alternatePhone: mobile(fr),
      whatsappNumber: fatherPhone,
      email: `father.${gr.toLowerCase()}@parent.schoolos.local`,
      occupation: 'Software Engineer',
      employerName: 'Private software company',
      designation: 'Senior Software Engineer',
      currentAddressId: fatherAddrCur.id,
      permanentAddressId: fatherAddrPerm.id,
    },
    {
      id: motherProfileId,
      userId: motherUserId,
      name: 'Mehak Irshad Ali Abro',
      phone: motherPhone,
      cnic: cnic(mr, 'FEMALE'),
      gender: 'FEMALE',
      dateOfBirth: d('1991-11-03'),
      alternatePhone: mobile(mr),
      whatsappNumber: motherPhone,
      email: `mother.${gr.toLowerCase()}@parent.schoolos.local`,
      occupation: 'Homemaker',
      employerName: null,
      designation: null,
      currentAddressId: motherAddrCur.id,
      permanentAddressId: motherAddrPerm.id,
    },
  ]);
  await insert('studentParent', [
    {
      id: id('link:father'),
      studentId,
      parentProfileId: fatherProfileId,
      relationship: 'father',
      isPrimary: true,
      isEmergencyContact: true,
      relationshipType: 'FATHER',
      primarySlot: 1,
    },
    {
      id: id('link:mother'),
      studentId,
      parentProfileId: motherProfileId,
      relationship: 'mother',
      isPrimary: true,
      isEmergencyContact: true,
      relationshipType: 'MOTHER',
      primarySlot: 2,
    },
  ]);

  // ---------------------------------------------------------------- attendance and leave
  stage('Attendance and leave');
  const ct3C = classTeacher.get(section3C.id)!;
  const leaveDays = new Set<string>();
  const leaveFrom = d('2026-09-21');
  const leaveTo = d('2026-09-22');
  for (let x = leaveFrom; x <= leaveTo; x = addDays(x, 1))
    leaveDays.add(iso(x));
  const attendance: Record<string, unknown>[] = [];
  for (
    let x = SESSION.start;
    x <= TODAY && x <= SESSION.end;
    x = addDays(x, 1)
  ) {
    if (!isSchoolDay(x)) continue;
    const r = rngFor(`att:${iso(x)}`);
    const roll = r();
    const status = leaveDays.has(iso(x))
      ? 'LEAVE'
      : roll < 0.04
        ? 'LATE'
        : roll < 0.06
          ? 'ABSENT'
          : 'PRESENT';
    attendance.push({
      id: id(`att:barzah:${iso(x)}`),
      studentId,
      date: x,
      status,
      markedById: ct3C.id,
      markedByUserId: ct3C.userId,
      createdAt: at(x, '08:10'),
    });
  }
  await insert('attendance', attendance);
  const nextWeek = (() => {
    let x = addDays(TODAY, 7);
    while (!isWeekday(x)) x = addDays(x, 1);
    return x;
  })();
  const leaveRows: Record<string, unknown>[] = [];
  if (leaveFrom <= TODAY) {
    leaveRows.push({
      id: id('leave:sept'),
      studentId,
      startDate: leaveFrom,
      endDate: leaveTo,
      reason: 'Fever and flu; doctor advised two days of rest.',
      status: 'approved',
      recommendedById: ct3C.userId,
      recommendedAt: at(addDays(leaveFrom, -1), '14:00'),
      recommendsApproval: true,
      recommendationNote: 'Parent informed in advance.',
      decidedById: adminUserId,
      decidedAt: at(addDays(leaveFrom, -1), '15:30'),
      decisionNote: 'Approved. Get well soon.',
      createdAt: at(addDays(leaveFrom, -1), '09:00'),
    });
  }
  leaveRows.push({
    id: id('leave:upcoming'),
    studentId,
    startDate: nextWeek,
    endDate: nextWeek,
    reason: 'Family wedding in Hyderabad.',
    status: 'pending',
    recommendedById: ct3C.userId,
    recommendedAt: at(TODAY, '13:00'),
    recommendsApproval: true,
    recommendationNote: 'Regular attendance; recommend approval.',
    createdAt: at(TODAY, '08:30'),
  });
  await insert('leaveRequest', leaveRows);

  // ---------------------------------------------------------------- marks
  stage('Marks for assessments already held');
  const marks: Record<string, unknown>[] = [];
  for (const a of assessmentRows) {
    if (a.classKey !== 'c3' || a.date >= TODAY) continue;
    const r = rngFor(`mark:${a.id}`);
    const subjectSkill = 0.84 + (rngFor(`skill:${a.subject}`)() - 0.5) * 0.12;
    const pct = Math.min(1, Math.max(0.45, subjectSkill + (r() - 0.5) * 0.12));
    const obtainedMarks = Math.round(pct * a.maxMarks * 2) / 2;
    const enteredBy = teacherFor.get(`${section3C.id}:${a.subject}`)!.userId;
    marks.push({
      id: id(`mark:${a.id}:barzah`),
      assessmentId: a.id,
      studentId,
      obtainedMarks,
      enteredById: enteredBy,
      createdAt: at(addDays(a.date, 2), '15:00'),
    });
  }
  await insert('mark', marks);

  // ---------------------------------------------------------------- report cards for finished terms
  const finished = TERMS.filter((t) => t.end < TODAY);
  if (finished.length) {
    stage(
      `Results and report cards: ${finished.map((t) => t.label).join(', ')}`,
    );
    const p = prisma as unknown as PrismaService;
    const orgScope = new OrgScopeService(p);
    const scales = new GradingScalesService(p, orgScope);
    const noAccess = {} as StudentAccessService;
    const publications = new ResultPublicationsService(
      p,
      orgScope,
      noAccess,
      scales,
    );
    const cards = new GeneratedReportCardsService(
      p,
      orgScope,
      noAccess,
      new GradesService(p, scales),
    );
    // The seed acts with the school admin's id; the SUPER_ADMIN role only skips the scope lookup.
    const actor = { id: adminUserId, role: 'SUPER_ADMIN' };
    for (const t of finished) {
      const classId = id('class:c3');
      const termId = id(`term:${t.key}`);
      const done = await prisma.resultPublication.findUnique({
        where: { classId_termId: { classId, termId } },
      });
      if (!done) await publications.publish(actor, classId, termId);
      const res = await cards.generate(actor, {
        classId,
        termId,
        remarks: [
          {
            studentId,
            remark:
              'Barzah is attentive and participates eagerly. Keep reading every day!',
          },
        ],
      });
      console.log(
        `  ${t.label}: ${res.generated} generated, ${res.unchanged} unchanged`,
      );
    }
  }

  // ---------------------------------------------------------------- fees: vouchers, payments, receipts
  stage('Fee vouchers, payments and receipts');
  const months: string[] = [];
  for (let y = 2026, m = 8; ; m++) {
    if (m > 12) {
      m = 1;
      y++;
    }
    const key = `${y}-${String(m).padStart(2, '0')}`;
    if (d(`${key}-01`) > TODAY || d(`${key}-01`) > SESSION.end) break;
    months.push(key);
  }
  const examMonths = new Set(TERMS.map((t) => iso(t.end).slice(0, 7)));
  const currentMonth = iso(TODAY).slice(0, 7);
  const vouchers: Record<string, unknown>[] = [];
  const items: Record<string, unknown>[] = [];
  const payments: Record<string, unknown>[] = [];
  const allocations: Record<string, unknown>[] = [];
  const receipts: Record<string, unknown>[] = [];
  for (const month of months) {
    const vid = id(`voucher:barzah:${month}`);
    const issue = d(`${month}-01`);
    const due = d(`${month}-10`);
    vouchers.push({
      id: vid,
      studentId,
      academicSessionId: sessionId,
      month,
      kind: 'REGULAR',
      issueDate: issue,
      dueDate: due,
      createdAt: at(issue, '09:00'),
    });
    const lines: [string, string, number][] = [
      ['tuition-1-5', 'Monthly Tuition — Classes 1–5', 8000],
    ];
    if (month === '2026-08') lines.push(['annual', 'Annual Charges', 12000]);
    if (examMonths.has(month)) lines.push(['exam', 'Examination Fee', 2500]);
    let total = 0;
    for (const [key, label, pkr] of lines) {
      items.push({
        id: id(`item:${month}:${key}`),
        feeVoucherId: vid,
        feeStructureId: id(`fee:${key}`),
        label,
        amount: rupees(pkr),
        kind: 'CHARGE',
        createdById: accountsUserId,
        createdAt: at(issue, '09:00'),
      });
      total += rupees(pkr);
    }
    if (month === currentMonth) continue; // the current month is still open
    // September was paid late, with the late fee; every other month on time.
    const late = month === '2026-09';
    let paidOn = addDays(due, late ? 8 : -int(rngFor(`pay:${month}`), 1, 6));
    while (!isWeekday(paidOn)) paidOn = addDays(paidOn, 1);
    if (paidOn > TODAY) continue;
    if (late) {
      const lateFee = rupees(500);
      items.push({
        id: id(`item:${month}:late`),
        feeVoucherId: vid,
        label: 'Late fee',
        amount: lateFee,
        kind: 'LATE_FEE',
        reason: `Unpaid after ${iso(due)}`,
        createdById: accountsUserId,
        createdAt: at(addDays(due, 6), '09:00'),
      });
      total += lateFee;
    }
    const pid = id(`payment:${month}`);
    payments.push({
      id: pid,
      amount: total,
      method: month === '2026-08' ? 'bank_transfer' : 'cash',
      status: 'completed',
      reference: `manual_${pid}`,
      note:
        month === '2026-08'
          ? 'Paid by bank transfer (HBL), slip attached at the office'
          : 'Paid in cash at the accounts office',
      recordedById: accountsUserId,
      createdAt: at(paidOn, '11:30'),
    });
    allocations.push({
      id: id(`alloc:${month}`),
      feePaymentId: pid,
      feeVoucherId: vid,
      amount: total,
      createdAt: at(paidOn, '11:30'),
    });
    receipts.push({
      id: id(`receipt:${month}`),
      feePaymentId: pid,
      receiptNumber: `RCPT-${iso(paidOn).replace(/-/g, '')}-${pid.slice(0, 6)}`,
      createdAt: at(paidOn, '11:30'),
    });
  }
  await prisma.$transaction(async (tx) => {
    await insert('feeVoucher', vouchers, tx);
    await insert('feeItem', items, tx);
    await insert('feePayment', payments, tx);
    await insert('feePaymentAllocation', allocations, tx);
    await insert('receipt', receipts, tx);
  });

  // ---------------------------------------------------------------- diary
  stage('Diary: the last ten school days, every section');
  const HOMEWORK: Record<string, string[]> = {
    [S.english]: [
      'Read the lesson aloud twice and learn the new words.',
      "Write five sentences using this week's spellings.",
      'Complete the grammar worksheet on page {p}.',
      'Write a short paragraph about your favourite season.',
    ],
    [S.urdu]: [
      'Sabaq ki dohrai karein aur mushkil alfaaz yaad karein.',
      'Khushkhati ka safha {p} mukammal karein.',
      'Paanch jumlay banaein.',
      'Nazm zabani yaad karein.',
    ],
    [S.maths]: [
      'Solve exercise {p} questions 1 to 10.',
      'Learn tables 2 to 12 for a quick quiz.',
      'Complete the worksheet on fractions.',
      'Revise the solved examples on page {p}.',
    ],
    [S.computer]: [
      'Label the parts of a computer in your notebook.',
      'Practise typing for 15 minutes.',
      'Revise the lesson for a short quiz.',
    ],
    [S.science]: [
      'Draw and label the diagram on page {p}.',
      'Answer the questions at the end of the chapter.',
      "Bring a leaf for tomorrow's activity.",
    ],
    [S.social]: [
      'Mark the provinces of Pakistan on the outline map.',
      'Read the chapter and underline key words.',
      'Answer the short questions on page {p}.',
    ],
    [S.islamiat]: [
      'Memorise the Surah taught in class.',
      'Write the Arkan-e-Islam in your notebook.',
      'Revise the lesson for an oral quiz.',
    ],
    [S.sindhi]: [
      'Sabaq parho ain lafz yaad karyo.',
      'Khushkhati jo safho {p} poro karyo.',
      'Panj jumla thahiyo.',
    ],
    [S.gk]: [
      'Colour the picture of fruits on page {p}.',
      'Bring a picture of an animal you like.',
      'Talk at home about your family members.',
    ],
  };
  const diary: Record<string, unknown>[] = [];
  const schoolDays: Date[] = [];
  for (
    let x = TODAY;
    schoolDays.length < 10 && x >= SESSION.start;
    x = addDays(x, -1)
  )
    if (isSchoolDay(x)) schoolDays.push(x);
  for (const s of sections) {
    const subjects = s.classDef.early ? EARLY_EXAMINED : PRIMARY_EXAMINED;
    schoolDays.forEach((day, i) => {
      for (let k = 0; k < 2; k++) {
        const subject =
          subjects[(i * 2 + k + s.letter.charCodeAt(0)) % subjects.length];
        const r = rngFor(`diary:${s.id}:${iso(day)}:${subject}`);
        let due = addDays(day, 1);
        while (!isSchoolDay(due) && due < SESSION.end) due = addDays(due, 1);
        diary.push({
          id: id(`diary:${s.id}:${iso(day)}:${subject}`),
          sectionId: s.id,
          subjectId: subjectId(subject),
          authorId: teacherFor.get(`${s.id}:${subject}`)!.userId,
          date: day,
          text: pick(r, HOMEWORK[subject]).replace(
            '{p}',
            String(int(r, 8, 96)),
          ),
          dueDate: due,
          createdAt: at(day, '12:30'),
        });
      }
    });
  }
  await insert('diaryEntry', diary);

  // ---------------------------------------------------------------- circulars, messages, notifications
  stage('Circulars, conversations and notifications');
  const parents = [fatherUserId, motherUserId];
  const CIRCULARS: [
    string,
    string,
    string,
    string,
    'school' | 'section',
    string,
  ][] = [
    [
      'welcome',
      '2026-07-28',
      'Welcome to session 2026-27',
      'School reopens on Monday 3 August 2026. Timings: Monday to Thursday 7:30 am to 1:40 pm, Friday 7:30 am to 12:25 pm. Assembly starts at 7:30 am sharp.',
      'school',
      'high',
    ],
    [
      'independence',
      '2026-08-10',
      'Independence Day celebrations',
      'Students may wear green and white on Thursday 13 August for the Independence Day assembly. The school stays closed on Friday 14 August.',
      'school',
      'normal',
    ],
    [
      'ptm',
      '2026-09-03',
      'Parent-Teacher Meeting',
      "The first Parent-Teacher Meeting is on Saturday 12 September from 9:00 am to 12:00 pm. Please meet the class teacher to discuss your child's progress.",
      'school',
      'normal',
    ],
    [
      'exams',
      '2026-10-01',
      'First Term examination schedule',
      'First Term final exams run from 19 to 29 October 2026. The date sheet has been shared in the diary. Students must clear dues before the exams.',
      'school',
      'high',
    ],
    [
      'science-3c',
      '2026-09-24',
      'Class 3-C science project',
      'Class 3-C will make a model of the water cycle in groups. Please send a shoe box and cotton wool by Monday.',
      'section',
      'normal',
    ],
  ];
  const circularRows: Record<string, unknown>[] = [];
  const recipients: Record<string, unknown>[] = [];
  const notifications: Record<string, unknown>[] = [];
  for (const [key, date, title, description, scope, priority] of CIRCULARS) {
    const published = at(d(date), '10:00');
    if (published > at(TODAY, '23:59')) continue;
    const cid = id(`circular:${key}`);
    circularRows.push({
      id: cid,
      title,
      description,
      scope,
      schoolId,
      sectionId: scope === 'section' ? section3C.id : null,
      priority,
      authorId: key === 'science-3c' ? ct3C.userId : principalUserId,
      publishedAt: published,
      createdAt: published,
    });
    for (const u of parents) {
      const read = rngFor(`read:${key}:${u}`)() < 0.75;
      recipients.push({
        id: id(`circular-recipient:${key}:${u}`),
        circularId: cid,
        userId: u,
        readAt: read ? at(d(date), '19:45') : null,
        createdAt: published,
      });
      notifications.push({
        id: id(`notif:circular:${key}:${u}`),
        userId: u,
        type: 'circular',
        title,
        body: description,
        entityRef: cid,
        readAt: read ? at(d(date), '19:45') : null,
        dispatchedAt: published,
        deliveryStatus: 'SENT',
        deliveryAttempts: 1,
        createdAt: published,
      });
    }
  }
  await insert('circular', circularRows);
  await insert('circularRecipient', recipients);

  const conversations: Record<string, unknown>[] = [];
  const messages: Record<string, unknown>[] = [];
  const THREADS: {
    key: string;
    parent: string;
    staff: string;
    type: string;
    on: string;
    lines: [string, string][];
  }[] = [
    {
      key: 'ct-homework',
      parent: fatherUserId,
      staff: ct3C.userId,
      type: 'CLASS_TEACHER',
      on: '2026-09-15',
      lines: [
        [
          'parent',
          'Assalam-o-Alaikum. Barzah found the Maths worksheet on fractions difficult. Could you suggest some practice at home?',
        ],
        [
          'staff',
          'Walaikum Assalam. She is doing well in class. Please practise halves and quarters with real objects; I will send an extra worksheet tomorrow.',
        ],
        ['parent', 'JazakAllah, we will practise over the weekend.'],
        [
          'staff',
          'Great. She solved the extra worksheet correctly today. Well done Barzah!',
        ],
      ],
    },
    {
      key: 'accounts-fee',
      parent: motherUserId,
      staff: accountsUserId,
      type: 'ACCOUNTS',
      on: '2026-09-17',
      lines: [
        [
          'parent',
          'September fee was delayed due to travel. Will the late fee apply if we pay this Friday?',
        ],
        [
          'staff',
          'The late fee of PKR 500 is added after the 5-day grace period. You can pay at the accounts office on Friday between 9 am and 12 pm.',
        ],
      ],
    },
  ];
  for (const t of THREADS) {
    const cid = id(`conversation:${t.key}`);
    const start = at(d(t.on), '09:15');
    if (start > at(TODAY, '23:59')) continue;
    const times = t.lines.map(
      (_, i) => new Date(start.getTime() + i * 3 * 3_600_000),
    );
    conversations.push({
      id: cid,
      parentUserId: t.parent,
      staffUserId: t.staff,
      recipientType: t.type,
      studentId,
      parentReadAt: times[times.length - 1],
      staffReadAt: times[times.length - 1],
      lastMessageAt: times[times.length - 1],
      createdAt: start,
    });
    t.lines.forEach(([who, body], i) => {
      const sender = who === 'parent' ? t.parent : t.staff;
      const receiver = who === 'parent' ? t.staff : t.parent;
      messages.push({
        id: id(`message:${t.key}:${i}`),
        conversationId: cid,
        senderId: sender,
        body,
        createdAt: times[i],
      });
      notifications.push({
        id: id(`notif:message:${t.key}:${i}`),
        userId: receiver,
        type: 'message',
        title: 'New message',
        body,
        entityRef: cid,
        readAt: times[i + 1] ?? null,
        dispatchedAt: times[i],
        deliveryStatus: 'SENT',
        deliveryAttempts: 1,
        createdAt: times[i],
      });
    });
  }
  await insert('conversation', conversations);
  await insert('message', messages);
  await insert('notification', notifications);

  // ---------------------------------------------------------------- complaint
  stage('Complaint');
  const complaintOn = d('2026-09-08');
  if (complaintOn <= TODAY) {
    const cid = id('complaint:water');
    await insert('complaint', [
      {
        id: cid,
        studentId,
        raisedById: fatherUserId,
        schoolId,
        category: 'FACILITIES',
        subject: 'Drinking water cooler on the first floor',
        description:
          'Barzah says the water cooler near the Class 3 rooms has not been working for a few days. Children have to go downstairs for water.',
        status: 'resolved',
        assignedToId: adminUserId,
        resolution:
          'The cooler compressor was replaced on 10 September and the cooler is working again. Thank you for reporting it.',
        resolvedAt: at(d('2026-09-10'), '13:00'),
        resolvedById: adminUserId,
        createdAt: at(complaintOn, '08:45'),
      },
    ]);
    await insert('complaintNote', [
      {
        id: id('complaint-note:1'),
        complaintId: cid,
        authorId: adminUserId,
        body: 'Maintenance vendor called; compressor needs replacement.',
        internal: true,
        createdAt: at(complaintOn, '11:00'),
      },
      {
        id: id('complaint-note:2'),
        complaintId: cid,
        authorId: adminUserId,
        body: 'We are getting the cooler repaired; a temporary dispenser has been placed in the corridor.',
        internal: false,
        createdAt: at(complaintOn, '11:15'),
      },
    ]);
  }

  // ---------------------------------------------------------------- admissions and hiring pipelines
  stage('Admissions and hiring pipelines');
  const APPLICANTS: [
    string,
    string,
    string,
    'MALE' | 'FEMALE',
    string,
    string,
  ][] = [
    ['ap1', 'Hadi Rehan Siddiqui', 'mont', 'MALE', 'SUBMITTED', ''],
    [
      'ap2',
      'Inaya Faraz Memon',
      'kg1',
      'FEMALE',
      'UNDER_REVIEW',
      'Assessment scheduled for next Saturday.',
    ],
    ['ap3', 'Musa Adnan Baig', 'c1', 'MALE', 'SUBMITTED', ''],
    [
      'ap4',
      'Zoya Kashif Ansari',
      'c4',
      'FEMALE',
      'UNDER_REVIEW',
      'Previous school report card received.',
    ],
    [
      'ap5',
      'Abdullah Waqar Khan',
      'c6',
      'MALE',
      'REJECTED',
      'No seat available in Class 6 this session; placed on the waiting list for next year.',
    ],
    [
      'ap6',
      'Hania Salman Qureshi',
      'c2',
      'FEMALE',
      'WITHDRAWN',
      'Family relocated to Lahore.',
    ],
    [
      'ap7',
      'Ibrahim Tariq Rizvi',
      'c9',
      'MALE',
      'UNDER_REVIEW',
      'Entry test on 10 October.',
    ],
    ['ap8', 'Aleena Junaid Abbasi', 'kg2', 'FEMALE', 'SUBMITTED', ''],
  ];
  await insert(
    'applicant',
    APPLICANTS.map(([key, name, cls]) => {
      const r = rngFor(`applicant:${key}`);
      const age = CLASSES.find((c) => c.key === cls)!.age;
      return {
        id: id(`applicant:${key}`),
        name,
        dateOfBirth: d(
          `${2026 - age}-${String(int(r, 1, 12)).padStart(2, '0')}-${String(int(r, 1, 28)).padStart(2, '0')}`,
        ),
        guardianName: `${name.split(' ')[1]} ${name.split(' ')[2]}`,
        guardianPhone: mobile(r),
        schoolId,
        createdAt: at(d('2026-09-01'), '10:00'),
      };
    }),
  );
  await insert(
    'application',
    APPLICANTS.map(([key, , cls, , status, notes]) => ({
      id: id(`application:${key}`),
      applicantId: id(`applicant:${key}`),
      desiredClassId: id(`class:${cls}`),
      academicSessionId: sessionId,
      status,
      decisionNotes: notes || null,
      reviewedById: status === 'SUBMITTED' ? null : adminUserId,
    })),
  );
  const CANDIDATES: [string, string, string, string, string][] = [
    ['hc1', 'Sidra Naveed', 'TEACHER', 'SUBMITTED', ''],
    [
      'hc2',
      'Umair Hafeez',
      'TEACHER',
      'SHORTLISTED',
      'Strong Mathematics background; demo lesson booked.',
    ],
    [
      'hc3',
      'Mahnoor Ali',
      'TEACHER',
      'INTERVIEWED',
      'Good classroom management in the demo lesson.',
    ],
    [
      'hc4',
      'Kashif Raza',
      'GUARD',
      'REJECTED',
      'Could not provide a police character certificate.',
    ],
    [
      'hc5',
      'Rukhsana Perveen',
      'HELPER',
      'SHORTLISTED',
      'Experience with early years children.',
    ],
    ['hc6', 'Faheem Akhtar', 'OFFICE_STAFF', 'SUBMITTED', ''],
  ];
  await insert(
    'hiringCandidate',
    CANDIDATES.map(([key, name]) => {
      const r = rngFor(`candidate:${key}`);
      return {
        id: id(`candidate:${key}`),
        name,
        dateOfBirth: d(
          `${int(r, 1985, 2001)}-0${int(r, 1, 9)}-1${int(r, 0, 9)}`,
        ),
        cnic: cnic(
          r,
          ['Sidra', 'Mahnoor', 'Rukhsana'].includes(name.split(' ')[0])
            ? 'FEMALE'
            : 'MALE',
        ),
        contactPhone: mobile(r),
        contactEmail: `${name.toLowerCase().replace(' ', '.')}@example.pk`,
        schoolId,
      };
    }),
  );
  await insert(
    'hiringApplication',
    CANDIDATES.map(([key, , type, status, notes]) => ({
      id: id(`hiring:${key}`),
      candidateId: id(`candidate:${key}`),
      employeeType: type,
      campusId,
      status,
      decisionNotes: notes || null,
      reviewedById: status === 'SUBMITTED' ? null : principalUserId,
    })),
  );

  // ---------------------------------------------------------------- summary
  console.log('\nRows per model (inserted this run / in the seed):');
  for (const [model, c] of [...counts.entries()].sort())
    console.log(
      `  ${model.padEnd(24)} ${String(c.inserted).padStart(6)} / ${c.total}`,
    );
  const loads = teachers.map(
    (t) =>
      timetable.filter(
        (s) => teacherFor.get(`${s.sectionId}:${s.subject}`) === t,
      ).length,
  );
  console.log(
    `\nTeachers: ${teachers.length}; weekly load ${Math.min(...loads)}–${Math.max(...loads)} periods (max ${MAX_LOAD}); no double bookings.`,
  );
  console.log(`\nLogins (password = SEED_PASSWORD):`);
  console.log(`  School admin   admin@${DOMAIN}`);
  console.log(`  Principal      principal@${DOMAIN}`);
  console.log(`  Accounts       accounts@${DOMAIN}`);
  console.log(`  Teacher        ${ct3C.email}  (class teacher of 3-C)`);
  console.log(
    `  Father         father.gr-02578@parent.schoolos.local  (Zain Noman Kamali)`,
  );
  console.log(
    `  Mother         mother.gr-02578@parent.schoolos.local  (Mehak Irshad Ali Abro)`,
  );
}

// --- Timetable -----------------------------------------------------------------------------------------

interface Slot {
  sectionId: string;
  day: number;
  period: number;
  subject: string;
}

/**
 * Places every section's weekly lessons into 5 days × 8 periods so that no teacher is in two
 * sections at once and a subject appears at most ceil(n/5) times a day. Each section is a max-flow
 * (subject → subject-day → free slot); sections are placed one after another in a seeded order and
 * the whole week is retried with another order if one cannot be completed. The result is verified.
 */
function buildTimetable(
  sections: { id: string; name: string; plan: Record<string, number> }[],
  teacherFor: Map<string, { id: string }>,
): Slot[] {
  for (let attempt = 0; attempt < 50; attempt++) {
    const r = rngFor(`timetable:${attempt}`);
    const busy = new Set<string>();
    const out: Slot[] = [];
    let ok = true;
    for (const s of shuffled(r, sections)) {
      const placed = placeSection(s, teacherFor, busy, r);
      if (!placed) {
        ok = false;
        break;
      }
      for (const slot of placed)
        busy.add(
          `${teacherFor.get(`${s.id}:${slot.subject}`)!.id}:${slot.day}:${slot.period}`,
        );
      out.push(...placed);
    }
    if (ok) {
      verifyTimetable(out, sections, teacherFor);
      return out;
    }
  }
  throw new Error('Could not build a conflict-free timetable');
}

function placeSection(
  s: { id: string; plan: Record<string, number> },
  teacherFor: Map<string, { id: string }>,
  busy: Set<string>,
  r: Rng,
): Slot[] | null {
  const subjects = shuffled(r, Object.keys(s.plan));
  const DAYS = 5,
    PERIODS = 8;
  // node ids: 0 source, 1 sink, subjects, subject-days, slots
  const subjNode = (i: number) => 2 + i;
  const sdNode = (i: number, day: number) =>
    2 + subjects.length + i * DAYS + day;
  const slotBase = 2 + subjects.length + subjects.length * DAYS;
  const slotNode = (day: number, p: number) => slotBase + day * PERIODS + p;
  const n = slotBase + DAYS * PERIODS;
  const cap: Map<number, number>[] = Array.from(
    { length: n },
    () => new Map<number, number>(),
  );
  const add = (u: number, v: number, c: number) => {
    cap[u].set(v, (cap[u].get(v) ?? 0) + c);
    if (!cap[v].has(u)) cap[v].set(u, 0);
  };
  subjects.forEach((sub, i) => {
    const weekly = s.plan[sub];
    add(0, subjNode(i), weekly);
    const teacher = teacherFor.get(`${s.id}:${sub}`)!.id;
    for (const day of shuffled(r, [0, 1, 2, 3, 4])) {
      add(subjNode(i), sdNode(i, day), Math.ceil(weekly / DAYS));
      for (const p of shuffled(r, [0, 1, 2, 3, 4, 5, 6, 7])) {
        if (!busy.has(`${teacher}:${day + 1}:${p + 1}`))
          add(sdNode(i, day), slotNode(day, p), 1);
      }
    }
  });
  for (let day = 0; day < DAYS; day++)
    for (let p = 0; p < PERIODS; p++) add(slotNode(day, p), 1, 1);
  let flow = 0;
  for (;;) {
    const prev = new Array<number>(n).fill(-1);
    prev[0] = 0;
    const queue = [0];
    while (queue.length && prev[1] === -1) {
      const u = queue.shift()!;
      for (const [v, c] of cap[u])
        if (c > 0 && prev[v] === -1) {
          prev[v] = u;
          queue.push(v);
        }
    }
    if (prev[1] === -1) break;
    for (let v = 1; v !== 0; v = prev[v]) {
      const u = prev[v];
      cap[u].set(v, cap[u].get(v)! - 1);
      cap[v].set(u, cap[v].get(u)! + 1);
    }
    flow++;
  }
  if (flow !== DAYS * PERIODS) return null;
  const out: Slot[] = [];
  subjects.forEach((sub, i) => {
    for (let day = 0; day < DAYS; day++)
      for (let p = 0; p < PERIODS; p++) {
        // flow went sd → slot when the reverse edge carries capacity
        if ((cap[slotNode(day, p)].get(sdNode(i, day)) ?? 0) > 0)
          out.push({
            sectionId: s.id,
            day: day + 1,
            period: p + 1,
            subject: sub,
          });
      }
  });
  return out;
}

function verifyTimetable(
  slots: Slot[],
  sections: { id: string; name: string; plan: Record<string, number> }[],
  teacherFor: Map<string, { id: string }>,
) {
  const seen = new Set<string>();
  const load = new Map<string, number>();
  for (const slot of slots) {
    const teacher = teacherFor.get(`${slot.sectionId}:${slot.subject}`)!.id;
    const key = `${teacher}:${slot.day}:${slot.period}`;
    if (seen.has(key))
      throw new Error(
        `Timetable conflict: teacher ${teacher} double-booked on day ${slot.day} period ${slot.period}`,
      );
    seen.add(key);
    const sk = `section:${slot.sectionId}:${slot.day}:${slot.period}`;
    if (seen.has(sk))
      throw new Error(
        `Timetable conflict: two lessons in one section slot (${sk})`,
      );
    seen.add(sk);
    load.set(teacher, (load.get(teacher) ?? 0) + 1);
  }
  for (const [teacher, n] of load)
    if (n > MAX_LOAD)
      throw new Error(`Teacher ${teacher} has ${n} periods (> ${MAX_LOAD})`);
  for (const s of sections) {
    for (const [subject, weekly] of Object.entries(s.plan)) {
      const n = slots.filter(
        (x) => x.sectionId === s.id && x.subject === subject,
      ).length;
      if (n !== weekly)
        throw new Error(
          `${s.name} has ${n} ${subject} periods, expected ${weekly}`,
        );
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
