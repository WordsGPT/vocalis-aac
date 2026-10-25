const STORAGE_KEY = 'vocalis_onboarding_v1';

export function shouldShowOnboarding() {
  try { return !['completed', 'skipped'].includes(JSON.parse(localStorage.getItem(STORAGE_KEY))?.status); }
  catch { return true; }
}
