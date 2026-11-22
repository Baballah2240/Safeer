import arStaff from './locales/ar/staff.js';
import enStaffErrors from './locales/en/staff-errors.js';
import enStaffLabels from './locales/en/staff-labels.js';
const ar=arStaff;
const errors=enStaffErrors;
const labels=enStaffLabels;
export const staffText=(key,language)=>({ar}[language]?.[key]||{ar}[language]?.[labels[key]]||{ar}[language]?.[errors[key]])||labels[key]||errors[key]||key;
