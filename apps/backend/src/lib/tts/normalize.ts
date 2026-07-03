// Normalize Persian text before sending it to a TTS engine.
//
// Content typed with an Arabic keyboard layout carries Arabic codepoints
// (ي ك …) that Persian TTS voices mispronounce or spell out; digits typed as
// ASCII or Arabic-Indic can be read in the wrong language. Display text is
// left untouched — this runs only on the synthesis path.
const DIGITS: Record<string, string> = {
  '0': '۰', '1': '۱', '2': '۲', '3': '۳', '4': '۴',
  '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹',
  '٠': '۰', '١': '۱', '٢': '۲', '٣': '۳', '٤': '۴',
  '٥': '۵', '٦': '۶', '٧': '۷', '٨': '۸', '٩': '۹',
}

export function normalizeForTts(text: string): string {
  return text
    .replace(/ي/g, 'ی')                          // Arabic yeh → Persian yeh
    .replace(/ك/g, 'ک')                          // Arabic kaf → Persian kaf
    .replace(/ۀ/g, 'هٔ')                          // decompose heh + hamza
    .replace(/ـ/g, '')                       // tatweel (kashida)
    .replace(/[0-9٠-٩]/g, d => DIGITS[d] ?? d)    // digits → Persian digits
    .replace(/‌+/g, '‌')                // collapse ZWNJ runs
    .replace(/\s+/g, ' ')
    .trim()
}
