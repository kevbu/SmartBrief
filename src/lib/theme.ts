/**
 * Per-device theme preference (System / Light / Dark).
 *
 * The preference lives in localStorage. <html data-theme> always carries the
 * resolved theme ("light" | "dark"); CSS tokens and Tailwind `dark:` key off it.
 * THEME_INIT_SCRIPT runs in <head> before first paint so there is no flash.
 */

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'sb-theme'

export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: '#f7f6f2',
  dark: '#0e0e11',
}

const DARK_QUERY = '(prefers-color-scheme: dark)'

export function parseThemePreference(raw: unknown): ThemePreference {
  return raw === 'light' || raw === 'dark' ? raw : 'system'
}

export function resolveTheme(pref: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (pref === 'system') return systemPrefersDark ? 'dark' : 'light'
  return pref
}

export function readThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system'
  try {
    return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

function applyResolvedTheme(theme: ResolvedTheme) {
  document.documentElement.dataset.theme = theme
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute('content', THEME_COLORS[theme]))
}

export function setThemePreference(pref: ThemePreference) {
  if (typeof window === 'undefined') return
  try {
    if (pref === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY)
    else window.localStorage.setItem(THEME_STORAGE_KEY, pref)
  } catch {
    // Storage unavailable (private mode): theme still applies for this page.
  }
  applyResolvedTheme(resolveTheme(pref, window.matchMedia(DARK_QUERY).matches))
}

/**
 * Self-contained, ES5-safe IIFE injected into <head>. It must never throw.
 * In System mode it also follows live OS appearance changes.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var K=${JSON.stringify(THEME_STORAGE_KEY)},C=${JSON.stringify(THEME_COLORS)},mq=window.matchMedia(${JSON.stringify(DARK_QUERY)});
function pref(){try{var v=localStorage.getItem(K);return v==="light"||v==="dark"?v:"system";}catch(e){return "system";}}
function apply(){var p=pref(),t=p==="system"?(mq.matches?"dark":"light"):p;document.documentElement.setAttribute("data-theme",t);
var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement("meta");m.setAttribute("name","theme-color");document.head.appendChild(m);}m.setAttribute("content",C[t]);}
apply();
var on=function(){if(pref()==="system")apply();};
if(mq.addEventListener)mq.addEventListener("change",on);else if(mq.addListener)mq.addListener(on);
}catch(e){}})();`
