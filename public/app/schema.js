// Mobile View Properties - customer application form definition.
// The form, the review screen, the admin dashboard and the PDF all read
// from this one file, so a question only ever needs to be changed here.

const COUNTRIES = ['United States', 'Canada', 'Mexico', 'United Kingdom', 'Other'];

const OWNS_LAND = [
  'Yes, I own land.',
  'I have purchased land but do not yet own it officially.',
];

export const STATUS_OPTIONS = [
  ['new', 'New'],
  ['contacted', 'Contacted'],
  ['under_review', 'Under review'],
  ['quotation_prepared', 'Quotation prepared'],
  ['quotation_sent', 'Quotation sent'],
  ['negotiating', 'Negotiating'],
  ['approved', 'Approved'],
  ['in_progress', 'In progress'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
];

export const statusLabel = (s) => (STATUS_OPTIONS.find(([v]) => v === s) || [s, s])[1];

const has = (arr, v) => Array.isArray(arr) && arr.includes(v);
export const ownsLand = (d) => OWNS_LAND.includes(d.land_status);
const isInstallment = (d) => d.purchase_method === 'Installment payment';
const isOutright = (d) => d.purchase_method === 'Outright purchase';
const isDownPayment = (d) => d.purchase_method === 'Down payment';

export const FILE_RULES = {
  maxFilesPerField: 5,
  maxBytes: 10 * 1024 * 1024,
  images: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  documents: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'],
};

// Option lists that include a short description use [value, description].
export const STEPS = [
  {
    id: 'customer',
    title: 'Your Details',
    intro: 'Tell us who you are and how you would like us to reach you.',
    fields: [
      { id: 'full_name', label: 'Full legal name', type: 'text', required: true, autocomplete: 'name', maxlength: 150 },
      { id: 'phone', label: 'Phone number', type: 'tel', required: true, autocomplete: 'tel', half: true },
      { id: 'alt_phone', label: 'Alternative phone number', type: 'tel', half: true },
      { id: 'email', label: 'Email address', type: 'email', required: true, autocomplete: 'email' },
      { id: 'address', label: 'Current residential address', type: 'text', required: true, autocomplete: 'street-address', placeholder: 'Street address' },
      { id: 'city', label: 'City', type: 'text', required: true, autocomplete: 'address-level2', half: true },
      { id: 'state', label: 'State / Province', type: 'text', required: true, autocomplete: 'address-level1', half: true },
      { id: 'zip', label: 'ZIP / Postal code', type: 'text', required: true, autocomplete: 'postal-code', half: true, maxlength: 20 },
      { id: 'country', label: 'Country', type: 'select', required: true, options: COUNTRIES, half: true, default: 'United States' },
      { id: 'country_other', label: 'Please enter your country', type: 'text', required: true, showIf: (d) => d.country === 'Other' },
      { id: 'preferred_contact', label: 'Preferred contact method', type: 'cards', required: true, compact: true,
        options: ['Phone call', 'WhatsApp', 'Telegram', 'Email', 'Text message'] },
      { id: 'whatsapp_same', label: 'Is your WhatsApp number the same as your phone number?', type: 'yesno', required: true,
        showIf: (d) => d.preferred_contact === 'WhatsApp' },
      { id: 'whatsapp_number', label: 'WhatsApp number', type: 'tel', required: true,
        showIf: (d) => d.preferred_contact === 'WhatsApp' && d.whatsapp_same === 'No' },
      { id: 'telegram', label: 'Telegram username or phone', type: 'text', required: true, placeholder: '@username',
        showIf: (d) => d.preferred_contact === 'Telegram' },
    ],
  },
  {
    id: 'home',
    title: 'Home Preferences',
    intro: 'Choose the kind of home you have in mind. Not sure? That is fine, we will advise you.',
    fields: [
      { id: 'home_type', label: 'What type of home are you interested in?', type: 'cards', required: true,
        options: ['Single-wide', 'Double-wide', 'Triple-wide', 'Multi-section manufactured home',
          'Custom-designed mobile home', 'Not sure – need professional advice'] },
      { id: 'interest', label: 'Are you interested in:', type: 'cards', required: true,
        options: ['Purchasing a completed home', 'Building a new custom home', 'Purchasing and installing a home',
          'Replacing an existing mobile home', 'Exploring available options'] },
      { id: 'bedrooms', label: 'How many bedrooms?', type: 'pills', required: true, options: ['1', '2', '3', '4', '5', '6 or more'] },
      { id: 'bathrooms', label: 'How many bathrooms?', type: 'pills', required: true, options: ['1', '1.5', '2', '2.5', '3', '4 or more'] },
      { id: 'home_size', label: 'Preferred home size', type: 'select', required: true,
        options: ['Under 600 sq ft', '600–900 sq ft', '901–1,200 sq ft', '1,201–1,500 sq ft', '1,501–1,800 sq ft',
          '1,801–2,200 sq ft', 'Above 2,200 sq ft', 'Not sure'] },
      { id: 'features', label: 'Additional preferences', type: 'multi', help: 'Select all that apply.',
        options: ['Open-plan kitchen', 'Separate kitchen', 'Kitchen island', 'Walk-in closet', 'Master bedroom',
          'Master bathroom', 'Laundry room', 'Living room', 'Dining room', 'Porch', 'Garage',
          'Additional storage', 'Accessibility features'] },
    ],
  },
  {
    id: 'land',
    title: 'Land & Property',
    intro: 'Tell us about the land where your home will be placed.',
    fields: [
      { id: 'land_status', label: 'Do you already own land?', type: 'cards', required: true,
        options: ['Yes, I own land.', 'I have purchased land but do not yet own it officially.',
          'I am currently searching for land.', 'I need assistance finding suitable land.',
          'I plan to purchase land later.'] },
      { id: 'land_location', label: 'Land location (area or description)', type: 'text', showIf: ownsLand,
        placeholder: 'e.g. rural lot north of town' },
      { id: 'land_address', label: 'Property address', type: 'text', showIf: ownsLand },
      { id: 'land_city', label: 'City', type: 'text', required: true, half: true, showIf: ownsLand },
      { id: 'land_state', label: 'State / Province', type: 'text', required: true, half: true, showIf: ownsLand },
      { id: 'land_zip', label: 'ZIP / Postal code', type: 'text', half: true, maxlength: 20, showIf: ownsLand },
      { id: 'land_country', label: 'Country', type: 'select', required: true, half: true, options: COUNTRIES,
        default: 'United States', showIf: ownsLand },
      { id: 'land_country_other', label: 'Please enter the country', type: 'text', required: true,
        showIf: (d) => ownsLand(d) && d.land_country === 'Other' },
      { id: 'land_size', label: 'Land size', type: 'select', required: true, showIf: ownsLand,
        options: ['Under 1,000 sq ft', '1,000–2,500 sq ft', '2,501–5,000 sq ft', '5,001–10,000 sq ft',
          '0.25 acre', '0.5 acre', '1 acre', '2 acres', 'More than 2 acres', 'Custom size'] },
      { id: 'land_size_custom', label: 'Custom land size', type: 'number', required: true, half: true, min: 0, step: 'any',
        showIf: (d) => ownsLand(d) && d.land_size === 'Custom size' },
      { id: 'land_unit', label: 'Measurement unit', type: 'select', required: true, half: true,
        options: ['Square feet', 'Acres', 'Square metres', 'Hectares'],
        showIf: (d) => ownsLand(d) && d.land_size === 'Custom size' },
      { id: 'land_features', label: 'Does the land have any of the following?', type: 'multi', help: 'Select all that apply.',
        showIf: ownsLand,
        options: ['Road access', 'Electricity', 'Water connection', 'Sewer connection', 'Septic system',
          'Existing foundation', 'Cleared ground', 'Level ground'] },
      { id: 'land_photos', label: 'Land photos', type: 'files', accept: 'images', showIf: ownsLand,
        help: 'Optional. Up to 5 photos, 10 MB each.' },
      { id: 'land_documents', label: 'Property documents', type: 'files', accept: 'documents', showIf: ownsLand,
        help: 'Optional. Deed, survey or plot plan. PDF or image, 10 MB each.' },
      { id: 'want_land_help', label: 'Would you like our help finding suitable land?', type: 'yesno', required: true,
        showIf: (d) => !!d.land_status && !ownsLand(d) },
      { id: 'preferred_land_area', label: 'Where would you like your land to be?', type: 'text',
        placeholder: 'City, county or region', showIf: (d) => !ownsLand(d) && d.want_land_help === 'Yes' },
    ],
  },
  {
    id: 'building',
    title: 'Building & Installation',
    intro: 'Choose how you would like your home built and set up.',
    fields: [
      { id: 'foundation', label: 'Foundation preference', type: 'cards', required: true, compact: true,
        options: ['Concrete slab', 'Crawl space', 'Pier foundation', 'Not sure'] },
      { id: 'utilities', label: 'Utilities you need', type: 'multi', help: 'Select all that apply.',
        options: ['Electricity installation', 'Plumbing', 'Water supply', 'Septic installation',
          'Heating and cooling', 'Air conditioning', 'Internet installation'] },
      { id: 'exterior', label: 'Exterior style', type: 'cards', required: true, compact: true,
        options: ['Vinyl siding', 'Metal siding', 'Brick appearance', 'Modern exterior', 'Traditional exterior', 'Not sure'] },
      { id: 'interior', label: 'Interior style', type: 'cards', required: true, compact: true,
        options: ['Modern', 'Contemporary', 'Traditional', 'Luxury', 'Minimalist', 'Custom design'] },
      { id: 'services', label: 'Which services do you require?', type: 'multi', help: 'Select all that apply.',
        options: ['Transportation', 'Home delivery', 'Site preparation', 'Foundation construction',
          'Full installation', 'Turnkey project'] },
      { id: 'building_notes', label: 'Additional building requirements', type: 'textarea' },
    ],
  },
  {
    id: 'budget',
    title: 'Budget & Purchase Readiness',
    intro: 'This helps us prepare options that fit your budget and plans.',
    fields: [
      { id: 'budget', label: 'What is your estimated total budget?', type: 'pills', required: true, wide: true,
        options: ['Under $30,000', '$30,000–$50,000', '$50,001–$75,000', '$75,001–$100,000',
          '$100,001–$150,000', '$150,001–$200,000', '$200,001–$300,000', 'Above $300,000',
          'I need a quotation first', 'I would like to specify my own budget'] },
      { id: 'budget_custom', label: 'Your budget (USD)', type: 'money', required: true,
        showIf: (d) => d.budget === 'I would like to specify my own budget' },
      { id: 'purchase_method', label: 'How do you intend to purchase your mobile home?', type: 'cards', required: true,
        options: [
          ['Outright purchase', 'I am ready to pay the full amount.'],
          ['Installment payment', 'I want to start an installment plan now.'],
          ['Financing', 'I would like financing information.'],
          ['Down payment', 'I can pay an initial deposit and arrange the balance.'],
          ['Still comparing prices', 'I am not ready to commit.'],
          ['I need professional guidance', 'Help me understand my options.'],
        ] },
      // Installment
      { id: 'deposit_amount', label: 'How much can you pay as an initial deposit? (USD)', type: 'money', required: true, showIf: isInstallment },
      { id: 'monthly_amount', label: 'Preferred installment amount per payment (USD)', type: 'money', required: true, showIf: isInstallment },
      { id: 'installment_duration', label: 'Preferred installment duration', type: 'select', required: true, half: true, showIf: isInstallment,
        options: ['3 months', '6 months', '12 months', '18 months', '24 months', '36 months', '48 months', '60 months', 'Other'] },
      { id: 'installment_start', label: 'Preferred payment start date', type: 'date', required: true, half: true, minToday: true, showIf: isInstallment },
      { id: 'installment_duration_other', label: 'Describe your preferred duration', type: 'text', required: true,
        showIf: (d) => isInstallment(d) && d.installment_duration === 'Other' },
      { id: 'installment_frequency', label: 'How frequently would you like to pay?', type: 'pills', required: true, wide: true, showIf: isInstallment,
        options: ['Weekly', 'Biweekly', 'Monthly', 'Custom arrangement'] },
      { id: 'installment_frequency_custom', label: 'Describe your custom arrangement', type: 'text', required: true,
        showIf: (d) => isInstallment(d) && d.installment_frequency === 'Custom arrangement' },
      { id: 'installment_ready', label: 'Are you ready to begin your installment plan immediately?', type: 'cards', required: true,
        compact: true, showIf: isInstallment,
        options: ['Yes, I am ready to start now.', 'I need a quotation first.',
          'I want to discuss payment arrangements.', 'I will start later.'] },
      // Down payment
      { id: 'down_payment_amount', label: 'How much can you pay as an initial deposit? (USD)', type: 'money', showIf: isDownPayment },
      // Outright
      { id: 'outright_ready', label: 'Are you ready to purchase now?', type: 'yesno', required: true, showIf: isOutright },
      { id: 'outright_funds', label: 'Do you have the full budget available?', type: 'pills', required: true, showIf: isOutright,
        options: ['Yes', 'Partially', 'Not yet'] },
      { id: 'outright_date', label: 'When would you like to complete the purchase?', type: 'date', minToday: true, showIf: isOutright },
      { id: 'budget_disclaimer', type: 'note', tone: 'info',
        text: 'Please note: all payment plans, financing arrangements, deposits and final prices are subject to review by Mobile View Properties and a separate written agreement. Submitting this application does not guarantee financing approval, interest rates or installment terms.' },
    ],
  },
  {
    id: 'payment',
    title: 'Mode of Payment',
    intro: 'Which payment methods would you prefer to use? You can choose more than one.',
    fields: [
      { id: 'payment_security_note', type: 'note', tone: 'secure',
        text: 'For your security we never ask for card numbers, bank passwords or PINs on this form, and you will not be charged. We only record your preferred method.' },
      { id: 'payment_methods', label: 'Preferred payment method(s)', type: 'multi', required: true,
        options: ['Bank transfer', 'Debit card', 'Credit card', 'Cash', 'Certified cheque', 'Money order',
          'Approved financing', 'Bank financing', 'Monthly installment arrangement', 'Other – specify'] },
      { id: 'payment_other', label: 'Please specify the other payment method', type: 'text', required: true,
        showIf: (d) => has(d.payment_methods, 'Other – specify') },
    ],
  },
  {
    id: 'timeline',
    title: 'Delivery & Timeline',
    intro: 'Let us know when you need your home so we can plan ahead.',
    fields: [
      { id: 'needed_by', label: 'How soon do you need your mobile home?', type: 'pills', required: true, wide: true,
        options: ['Immediately', 'Within 2 weeks', 'Within 30 days', 'Within 60 days', 'Within 3 months',
          'Within 6 months', 'Within 12 months', 'More than 12 months', 'No fixed timeline yet'] },
      { id: 'begin_by', label: 'When are you ready to begin?', type: 'pills', required: true, wide: true,
        options: ['Immediately', 'Within 7 days', 'Within 30 days', 'Within 3 months', 'Later this year', 'Still researching'] },
      { id: 'proceed_ready', label: 'Are you ready to proceed with the purchase?', type: 'cards', required: true,
        options: ['Yes, I am ready to purchase outright now.', 'Yes, I am ready to begin an installment plan now.',
          'I am interested but need a quotation.', 'I am still comparing options.', 'I am only gathering information.'] },
      { id: 'delivery_instructions', label: 'Delivery instructions', type: 'textarea',
        placeholder: 'Access notes, gate codes, best route, anything our delivery team should know' },
      { id: 'consultation_date', label: 'Preferred consultation date', type: 'date', half: true, minToday: true },
      { id: 'consultation_date_alt', label: 'Alternative consultation date', type: 'date', half: true, minToday: true },
      { id: 'consultation_time', label: 'Preferred time of day', type: 'pills',
        options: ['Morning', 'Afternoon', 'Evening', 'Any time'] },
    ],
  },
  {
    id: 'final',
    title: 'Final Details & Signature',
    intro: 'Add anything else we should know, review your answers and sign.',
    fields: [
      { id: 'comments', label: 'Additional comments', type: 'textarea' },
      { id: 'special_requests', label: 'Special requests', type: 'textarea' },
      { id: 'design_ideas', label: 'Design ideas', type: 'textarea' },
      { id: 'design_images', label: 'Inspiration images', type: 'files', accept: 'images', help: 'Optional. Up to 5 images, 10 MB each.' },
      { id: 'extra_documents', label: 'Other documents', type: 'files', accept: 'documents', help: 'Optional. PDF or image, 10 MB each.' },
      { id: 'review', type: 'review' },
      { id: 'signature', label: 'Your signature', type: 'signature', required: true },
      { id: 'signature_name', label: 'Full name (as signed)', type: 'text', required: true, half: true, maxlength: 150 },
      { id: 'signature_date', label: 'Date of signature', type: 'date', required: true, half: true, readonly: true, today: true },
      { id: 'consent', type: 'consent', required: true,
        text: 'I confirm that the information I have provided is accurate to the best of my knowledge. I authorize Mobile View Properties to contact me regarding my home purchase, construction preferences and quotation. I understand that submitting this application does not constitute a purchase contract or financing approval.' },
    ],
  },
];

// ---------------------------------------------------------------------
// Helpers shared by the form, admin dashboard and PDF
// ---------------------------------------------------------------------
export const optValue = (o) => (Array.isArray(o) ? o[0] : o);
export const optDesc = (o) => (Array.isArray(o) ? o[1] : '');

const NON_ANSWER_TYPES = ['note', 'review', 'signature', 'consent'];

export function isVisible(field, d) {
  return !field.showIf || !!field.showIf(d);
}

export function isEmpty(v) {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^[0-9+()\-.\s]{6,40}$/;

export function todayISO() {
  const t = new Date();
  return new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Returns an error message, or '' when the value is fine.
export function validateField(field, value, d) {
  if (!isVisible(field, d) || field.type === 'note' || field.type === 'review') return '';
  if (field.type === 'consent') return value === true ? '' : 'Please tick the box to confirm.';
  if (field.type === 'signature') return value ? '' : 'Please draw your signature.';
  if (field.type === 'files') return '';
  if (isEmpty(value)) return field.required ? 'This field is required.' : '';
  const s = String(value).trim();
  if (field.type === 'email' && !EMAIL_RE.test(s)) return 'Please enter a valid email address.';
  if (field.type === 'tel' && (!PHONE_RE.test(s) || s.replace(/\D/g, '').length < 6)) return 'Please enter a valid phone number.';
  if (field.type === 'money' || field.type === 'number') {
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) return 'Please enter a valid positive number.';
    if (n > 100000000) return 'That number looks too large.';
  }
  if (field.type === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'Please choose a valid date.';
    if (field.minToday && s < todayISO()) return 'Please choose today or a future date.';
  }
  if (['text', 'email', 'tel'].includes(field.type) && s.length > (field.maxlength || 300)) return 'This answer is too long.';
  if (field.type === 'textarea' && s.length > 3000) return 'Please keep this under 3000 characters.';
  if (field.type === 'select' || field.type === 'cards' || field.type === 'pills') {
    if (!field.options.some((o) => optValue(o) === value)) return 'Please choose one of the options.';
  }
  if (field.type === 'yesno' && !['Yes', 'No'].includes(value)) return 'Please choose Yes or No.';
  if (field.type === 'multi') {
    if (!Array.isArray(value) || !value.every((v) => field.options.some((o) => optValue(o) === v))) {
      return 'Please choose from the options.';
    }
  }
  return '';
}

export function validateStep(step, d) {
  const errors = {};
  for (const f of step.fields) {
    const e = validateField(f, d[f.id], d);
    if (e) errors[f.id] = e;
  }
  return errors;
}

export function formatMoney(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function formatDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || '';
  const [y, m, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function displayValue(field, value) {
  if (isEmpty(value)) return '';
  if (field.type === 'money') return formatMoney(value);
  if (field.type === 'date') return formatDate(value);
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

// Only the answers to questions the customer could actually see.
export function cleanAnswers(d) {
  const out = {};
  for (const step of STEPS) {
    for (const f of step.fields) {
      if (NON_ANSWER_TYPES.includes(f.type) || !isVisible(f, d)) continue;
      const v = d[f.id];
      if (isEmpty(v)) continue;
      out[f.id] = typeof v === 'string' ? v.trim() : v;
    }
  }
  return out;
}

// [{ title, rows: [[label, value], ...] }] for review / admin / PDF.
// `fileNames` optionally maps a files field id -> array of names.
export function summarySections(d, fileNames = {}) {
  return STEPS.map((step) => {
    const rows = [];
    for (const f of step.fields) {
      if (NON_ANSWER_TYPES.includes(f.type) || !isVisible(f, d)) continue;
      if (f.type === 'files') {
        const names = fileNames[f.id] || d[f.id];
        if (!isEmpty(names)) rows.push([f.label, names.join(', ')]);
        continue;
      }
      const shown = displayValue(f, d[f.id]);
      if (shown) rows.push([f.label, shown]);
    }
    return { title: step.title, rows };
  }).filter((s) => s.rows.length);
}

export function findField(id) {
  for (const step of STEPS) {
    const f = step.fields.find((x) => x.id === id);
    if (f) return f;
  }
  return null;
}
