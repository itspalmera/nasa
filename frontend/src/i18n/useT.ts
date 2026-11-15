'use client';
import {useMemo} from 'react';
import {useScenario} from '../context/ScenarioContext';
import messages from './messages.json';
import extra from './extra.json';
const pairs: string[][] = [...messages, ...extra];
const dictionaries = {
  en: new Map(pairs.flatMap(([en, es]) => [[en.toLocaleLowerCase(), en], [es.toLocaleLowerCase(), en]] as [string,string][])),
  es: new Map(pairs.flatMap(([en, es]) => [[en.toLocaleLowerCase(), es], [es.toLocaleLowerCase(), es]] as [string,string][])),
};
const templates = pairs.filter(pair => pair.some(text => /\{\w+\}/.test(text))).flatMap(pair => pair.map(source => {
  const keys: string[] = [];
  const pattern = source.split(/(\{\w+\})/).map(part => {
    if (/^\{\w+\}$/.test(part)) {keys.push(part); return '(.+?)';}
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
  return {pattern: new RegExp('^'+pattern+'$', 'i'), keys, pair};
}));
export function translateText<T>(value: T, lang: 'es' | 'en'): T {
  if (typeof value !== 'string' || !value.trim()) return value;
  const normalized = value.replace(/\s+/g, ' ').trim();
  const translated = dictionaries[lang].get(normalized.toLocaleLowerCase());
  if (translated) return translated as T;
  for (const template of templates) {
    const match = normalized.match(template.pattern);
    if (match) return template.keys.reduce((text,key,index) => text.replace(key,match[index+1]),template.pair[lang === 'en' ? 0 : 1]) as T;
  }
  if (normalized.startsWith('Error: ')) return ('Error: '+translateText(normalized.slice(7),lang)) as T;
  // Preserve numbers, source identifiers and units in compound labels.
  const parts = value.split(/( · |; |, )/);
  if (parts.length > 1) return parts.map((part,index) => index % 2 ? part : translateText(part, lang)).join('') as T;
  return value;
}
export function useT() {
  const {lang} = useScenario();
  return useMemo(() => <T,>(value: T): T => translateText(value, lang), [lang]);
}
