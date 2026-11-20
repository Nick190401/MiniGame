import { useCallback } from 'react';
import { create } from 'zustand';
import { useGameStore } from '../store/gameStore';
import { DE } from './de';
import { DE_UI } from './de.ui';
import { DE_EXTRA } from './de.extra';

/**
 * Display-time translation: the game's text stays English in code, and tr()
 * swaps in the German line when German is selected. Keys are the English text
 * with the hero's name as {name} and each run of digits as {0}, {1}, … in order.
 */
export type Language = 'en' | 'de';

const STORAGE_KEY = 'sound-quest:language';
/** An unnamed hero's title in saves from before the default name became Mr Mario. */
const DEFAULT_NAME = 'Sound Keeper';

// DE_EXTRA first: should a key land in de.ts or de.ui.ts later, their wording wins.
const DICTIONARY: Readonly<Record<string, string>> = { ...DE_EXTRA, ...DE_UI, ...DE };

const isLanguage = (value: unknown): value is Language => value === 'en' || value === 'de';

function initialLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    // Storage is blocked: go by the browser's language.
  }
  const browser = typeof navigator === 'undefined' ? '' : navigator.language ?? '';
  return browser.toLowerCase().startsWith('de') ? 'de' : 'en';
}

interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => void;
}

/** The chosen language. Kept apart from the journey: never part of the save. */
export const useLanguageStore = create<LanguageState>(set => ({
  language: initialLanguage(),
  setLanguage: (language: Language) => {
    if (!isLanguage(language)) return;
    set({ language });
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Storage is blocked: the choice lasts for this visit.
    }
  },
}));

const applyDocumentLanguage = (language: Language) => {
  if (typeof document !== 'undefined') document.documentElement.lang = language;
};
applyDocumentLanguage(useLanguageStore.getState().language);
useLanguageStore.subscribe(state => applyDocumentLanguage(state.language));

const WORD_CHAR = /[\p{L}\p{N}]/u;
const isWordChar = (char: string | undefined) => char !== undefined && WORD_CHAR.test(char);

/** The name as a whole word only, so a hero called "Echo" leaves "Echoes" alone. */
function markName(text: string, name: string): string {
  let result = '';
  let from = 0;
  let at = text.indexOf(name);
  while (at !== -1) {
    const end = at + name.length;
    if (isWordChar(text[at - 1]) || isWordChar(text[end])) {
      at = text.indexOf(name, at + 1);
      continue;
    }
    result += `${text.slice(from, at)}{name}`;
    from = end;
    at = text.indexOf(name, end);
  }
  return from === 0 ? text : result + text.slice(from);
}

function markNumbers(text: string, values: string[]): string {
  return text.replace(/\d+/g, digits => `{${values.push(digits) - 1}}`);
}

/** One pass, so a name or number that itself looks like a placeholder is never filled again. */
function fill(template: string, values: readonly string[], name: string): string {
  return template.replace(/\{(name|\d+)\}/g, (slot, key: string) => (key === 'name' ? name : values[Number(key)] ?? slot));
}

// Own keys only: a hero or line reading "constructor" must not find Object.prototype.
const entry = (key: string): string | undefined =>
  Object.prototype.hasOwnProperty.call(DICTIONARY, key) ? DICTIONARY[key] : undefined;

/** Spoken lines are keyed with the quotes they are written with; the dialogue box shows them without. */
function lookup(key: string): string | undefined {
  const template = entry(key);
  if (template !== undefined) return template;
  const spoken = entry(`"${key}"`);
  return spoken !== undefined && spoken.length > 1 && spoken.startsWith('"') && spoken.endsWith('"')
    ? spoken.slice(1, -1)
    : spoken;
}

const reportedMissing = new Set<string>();

function translate(text: string, language: Language): string {
  if (language === 'en' || !text) return text;
  const playerName = useGameStore.getState().playerName.trim();
  const name = playerName === DEFAULT_NAME ? entry(DEFAULT_NAME) ?? playerName : playerName;
  // A name is never a phrase to translate, whatever words the player chose.
  if (playerName && text === playerName) return name;

  let key: string | undefined;
  if (playerName) {
    const named = markName(text, playerName);
    if (named !== text) {
      const values: string[] = [];
      key = markNumbers(named, values);
      const template = lookup(key);
      if (template !== undefined) return fill(template, values, name);
    }
  }
  // Without the name: a hero called "Echo" must not hide "Echo Village".
  const values: string[] = [];
  const plainKey = markNumbers(text, values);
  const template = lookup(plainKey);
  if (template !== undefined) return fill(template, values, name);

  key ??= plainKey;
  if (import.meta.env.DEV && !reportedMissing.has(key)) {
    reportedMissing.add(key);
    console.debug(`[i18n] no German for "${key}"`);
  }
  return text;
}

/** The text in the current language; the English original when there is no translation. */
export function tr(text: string): string {
  return translate(text, useLanguageStore.getState().language);
}

/** tr() for components: they render again when the language changes. */
export function useTr(): (text: string) => string {
  const language = useLanguageStore(state => state.language);
  return useCallback((text: string) => translate(text, language), [language]);
}
