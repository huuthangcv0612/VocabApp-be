import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let viLocales = {};
let enLocales = {};

try {
  viLocales = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../locales/vi.json'), 'utf8')
  );
  enLocales = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../locales/en.json'), 'utf8')
  );
} catch (err) {
  console.error('[i18n] Failed to load locale files:', err.message);
}

const dictionaries = {
  vi: viLocales,
  en: enLocales,
};

/**
 * Resolve a dot-notated key from a dictionary (e.g. 'auth.login_success')
 */
export const translate = (locale = 'vi', key = '', fallback = '') => {
  if (!key || typeof key !== 'string') return fallback || key;

  const targetDict = dictionaries[locale] || dictionaries.vi;
  const parts = key.split('.');
  let current = targetDict;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return fallback || key;
    }
  }

  return typeof current === 'string' ? current : fallback || key;
};

/**
 * Express middleware to attach locale and translate function to req
 */
export const i18nMiddleware = (req, res, next) => {
  const headerLang = req.headers['accept-language'];
  const queryLang = req.query?.lang;

  let locale = 'vi'; // Default locale is Vietnamese

  const rawLang = String(queryLang || headerLang || '').toLowerCase();
  if (rawLang.startsWith('en')) {
    locale = 'en';
  } else if (rawLang.startsWith('vi')) {
    locale = 'vi';
  }

  req.locale = locale;
  req.t = (key, fallback) => translate(locale, key, fallback);

  next();
};

export default i18nMiddleware;
