//langNameNative, langNameEn, ZoteroLangCode, francLangCode, ISO 639-1

import { getDB } from "./database";
export async function saveDBLangCode() {
  const DB = await getDB();
  const sql = "SELECT COUNT(*) FROM language";
  const count = await DB.valueQueryAsync(sql);
  if (count) return;
  //ISO 639-1 (i.e., the two letter language code),
  const langCodeDatabaseArr = [
    ["Afrikaans", "Afrikaans", "af-ZA", "afr", "af"],
    ["العربية", "Arabic", "ar", "arb", "ar"],
    ["Български", "Bulgarian", "bg-BG", "bul", "bg"],
    ["Català", "Catalan", "ca-AD", "cat", "ca"],
    ["Čeština", "Czech", "cs-CZ", "ces", "cs"],
    ["Cymraeg", "Welsh", "cy-GB", "cym", "cy"],
    ["Dansk", "Danish", "da-DK", "dan", "da"],
    ["Deutsch (Österreich)", "German (Austria)", "de-AT", "", ""],
    ["Deutsch (Schweiz)", "German (Switzerland)", "de-CH", "", ""],
    ["Deutsch (Deutschland)", "German (Germany)", "de-DE", "deu", "de"],
    ["Ελληνικά", "Greek", "el-GR", "ell", "el"],
    ["English (UK)", "English (UK)", "en-GB", "", ""],
    ["English (US)", "English (US)", "en-US", "eng", "en"],
    ["Español (Chile)", "Spanish (Chile)", "es-CL", "", ""],
    ["Español (España)", "Spanish (Spain)", "es-ES", "spa", "es"],
    ["Español (México)", "Spanish (Mexico)", "es-MX", "", ""],
    ["Eesti keel", "Estonian", "et-EE", "ekk", "et"],
    ["Euskara", "Basque", "eu", "", "eu"],
    ["فارسی", "Persian", "fa-IR", "pes", "fa"],
    ["Suomi", "Finnish", "fi-FI", "fin", "fi"],
    ["Français (Canada)", "French (Canada)", "fr-CA", "", ""],
    ["Français (France)", "French (France)", "fr-FR", "fra", "fr"],
    ["Galego (Spain)", "Galician (Spain)", "gl-ES", "", ""],
    ["עברית", "Hebrew", "he-IL", "heb", "he"],
    ["हिंदी", "Hindi", "hi-IN", "hin", "hi"],
    ["Hrvatski", "Croatian", "hr-HR", "hrv", "hr"],
    ["Magyar", "Hungarian", "hu-HU", "hun", "hu"],
    ["Bahasa Indonesia", "Indonesian", "id-ID", "ind", "id"],
    ["Íslenska", "Icelandic", "is-IS", "isl", "is"],
    ["Italiano", "Italian", "it-IT", "ita", "it"],
    ["日本語", "Japanese", "ja-JP", "jpn", "ja"],
    ["ភាសាខ្មែរ", "Khmer", "km-KH", "khm", "km"],
    ["한국어", "Korean", "ko-KR", "kor", "ko"],
    ["Latina", "Latin", "la", "lat", "la"],
    ["Lietuvių kalba", "Lithuanian", "lt-LT", "lit", "lt"],
    ["Latviešu", "Latvian", "lv-LV", "lvs", "lv"],
    ["Монгол", "Mongolian", "mn-MN", "khk", "mn"],
    ["Norsk bokmål", "Norwegian (Bokmål)", "nb-NO", "nob", "nb"],
    ["Nederlands", "Dutch", "nl-NL", "nld", "nl"],
    ["Norsk nynorsk", "Norwegian (Nynorsk)", "nn-NO", "nno", "nn"],
    ["Polski", "Polish", "pl-PL", "pol", "pl"],
    ["Português (Brasil)", "Portuguese (Brazil)", "pt-BR", "", ""],
    ["Português (Portugal)", "Portuguese (Portugal)", "pt-PT", "por", "pt"],
    ["Română", "Romanian", "ro-RO", "ron", "ro"],
    ["Русский", "Russian", "ru-RU", "rus", "ru"],
    ["Slovenčina", "Slovak", "sk-SK", "slk", "sk"],
    ["Slovenščina", "Slovenian", "sl-SI", "slv", "sl"],
    ["Српски / Srpski", "Serbian", "sr-RS", "srp", "sr"],
    ["Svenska", "Swedish", "sv-SE", "swe", "sv"],
    ["ไทย", "Thai", "th-TH", "tha", "th"],
    ["Türkçe", "Turkish", "tr-TR", "tur", "tr"],
    ["Українська", "Ukrainian", "uk-UA", "ukr", "uk"],
    ["Tiếng Việt", "Vietnamese", "vi-VN", "vie", "vi"],
    ["中文 (中国大陆)", "Chinese (PRC)", "zh-CN", "cmn", "zh"],
    ["中文 (台灣)", "Chinese (Taiwan)", "zh-TW", "", ""],
  ];
  const sqlColumns = [
    "langNameNative",
    "langNameEn",
    "zoteroCode",
    "francCode",
    "iso6391",
    "zoteroPrimaryDialects",
  ];

  await DB.executeTransaction(async () => {
    for (const sqlValues of langCodeDatabaseArr) {
      sqlValues.push("");
      const sql =
        "INSERT INTO " +
        "language" +
        " (" +
        sqlColumns.join(", ") +
        ") " +
        "VALUES (" +
        sqlValues.map(() => "?").join() +
        ")";
      await DB.queryAsync(sql, sqlValues);
    }
  });
}



