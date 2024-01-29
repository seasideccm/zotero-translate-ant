export const langCodeDatabaseArr = [
  ["Afrikaans", "Afrikaans", "af-ZA", "af", "afr"],
  ["العربية", "Arabic", "ar", "ar", "arb"],
  ["Български", "Bulgarian", "bg-BG", "bg", "bul"],
  ["Català", "Catalan", "ca-AD", "ca", "cat"],
  ["Čeština", "Czech", "cs-CZ", "cs", "ces"],
  ["Cymraeg", "Welsh", "cy-GB", "cy", "cym"],
  ["Dansk", "Danish", "da-DK", "da", "dan"],
  ["Deutsch (Österreich)", "German (Austria)", "de-AT", "", ""],
  ["Deutsch (Schweiz)", "German (Switzerland)", "de-CH", "", ""],
  ["Deutsch (Deutschland)", "German (Germany)", "de-DE", "de", "deu"],
  ["Ελληνικά", "Greek", "el-GR", "el", "ell"],
  ["English (UK)", "English (UK)", "en-GB", "", ""],
  ["English (US)", "English (US)", "en-US", "en", "eng"],
  ["Español (Chile)", "Spanish (Chile)", "es-CL", "", ""],
  ["Español (España)", "Spanish (Spain)", "es-ES", "es", "spa"],
  ["Español (México)", "Spanish (Mexico)", "es-MX", "", ""],
  ["Eesti keel", "Estonian", "et-EE", "et", "ekk"],
  ["Euskara", "Basque", "eu", "eu", ""],
  ["فارسی", "Persian", "fa-IR", "fa", "pes"],
  ["Suomi", "Finnish", "fi-FI", "fi", "fin"],
  ["Français (Canada)", "French (Canada)", "fr-CA", "", ""],
  ["Français (France)", "French (France)", "fr-FR", "fr", "fra"],
  ["Galego (Spain)", "Galician (Spain)", "gl-ES", "", ""],
  ["עברית", "Hebrew", "he-IL", "he", "heb"],
  ["हिंदी", "Hindi", "hi-IN", "hi", "hin"],
  ["Hrvatski", "Croatian", "hr-HR", "hr", "hrv"],
  ["Magyar", "Hungarian", "hu-HU", "hu", "hun"],
  ["Bahasa Indonesia", "Indonesian", "id-ID", "id", "ind"],
  ["Íslenska", "Icelandic", "is-IS", "is", "isl"],
  ["Italiano", "Italian", "it-IT", "it", "ita"],
  ["日本語", "Japanese", "ja-JP", "ja", "jpn"],
  ["ភាសាខ្មែរ", "Khmer", "km-KH", "km", "khm"],
  ["한국어", "Korean", "ko-KR", "ko", "kor"],
  ["Latina", "Latin", "la", "la", "lat"],
  ["Lietuvių kalba", "Lithuanian", "lt-LT", "lt", "lit"],
  ["Latviešu", "Latvian", "lv-LV", "lv", "lvs"],
  ["Монгол", "Mongolian", "mn-MN", "mn", "khk"],
  ["Norsk bokmål", "Norwegian (Bokmål)", "nb-NO", "nb", "nob"],
  ["Nederlands", "Dutch", "nl-NL", "nl", "nld"],
  ["Norsk nynorsk", "Norwegian (Nynorsk)", "nn-NO", "nn", "nno"],
  ["Polski", "Polish", "pl-PL", "pl", "pol"],
  ["Português (Brasil)", "Portuguese (Brazil)", "pt-BR", "", ""],
  ["Português (Portugal)", "Portuguese (Portugal)", "pt-PT", "pt", "por"],
  ["Română", "Romanian", "ro-RO", "ro", "ron"],
  ["Русский", "Russian", "ru-RU", "ru", "rus"],
  ["Slovenčina", "Slovak", "sk-SK", "sk", "slk"],
  ["Slovenščina", "Slovenian", "sl-SI", "sl", "slv"],
  ["Српски / Srpski", "Serbian", "sr-RS", "sr", "srp"],
  ["Svenska", "Swedish", "sv-SE", "sv", "swe"],
  ["ไทย", "Thai", "th-TH", "th", "tha"],
  ["Türkçe", "Turkish", "tr-TR", "tr", "tur"],
  ["Українська", "Ukrainian", "uk-UA", "uk", "ukr"],
  ["Tiếng Việt", "Vietnamese", "vi-VN", "vi", "vie"],
  ["中文 (中国大陆)", "Chinese (PRC)", "zh-CN", "zh", "cmn"],
  ["中文 (台灣)", "Chinese (Taiwan)", "zh-TW", "", ""],
];
export async function insertLangCode(DB: any) {
  const sqlColumns = [
    "langNameNative",
    "langNameEn",
    "zoteroPrimaryDialects",
    "zoteroCode",
    "francCode",
  ];
  for (const sqlValues of langCodeDatabaseArr) {
    const sql =
      "INSERT INTO language (" +
      sqlColumns.join(", ") +
      ") " +
      "VALUES (" +
      sqlValues.map(() => "?").join() +
      ")";
    await DB.queryAsync(sql, sqlValues);
  }
}
