import { iso6393 } from "iso-639-3";
import { getSettingValue } from "../modules/addonSetting";
import { getElementValue } from "../modules/ui/uiTools";
import { showInfo } from "./tools";
import { langCode_francVsZotero } from "./constant";

/* import("iso-639-3").then((module) => {
  const iso6393 = module.iso6393;
}); */

export function zoteroLangCode() {
  const lang = "eng";
  const zoteroLangCode = iso6393
    .filter((e: any) => e.iso6393 == lang)
    .map((e: any) => e.iso6391);

  ztoolkit.log(iso6393.slice(1820, 1830));
  ztoolkit.log(...zoteroLangCode);
}

export async function getLangCode(code: string, type: number) {
  //@ts-ignore xxx
  const name = Zotero.Locale.availableLocales[code] as string;
  //中文（简体）不好查询
  let lang;
  while (!iso6393) {
    await Zotero.Promise.delay(500);
  }
  const langCodeObj = iso6393.filter(
    (e: any) => e.name.toLocaleLowerCase() == name.toLocaleLowerCase(),
  )[0];
  if (!langCodeObj) {
    showInfo(code + " 查询失败");
    throw code + " 查询失败";
  }
  if (type == 2) {
    lang = langCodeObj.iso6391;
  }
  if (type == 3) {
    lang = langCodeObj.iso6393;
  }
  return lang;
}

export async function getLang(serviceID: string) {
  const format: { [key: string]: number; } = {
    baidufieldModify: 2,
    baiduModify: 2,
  };
  const defaultSourceLang = await getSettingValue(
    "defaultSourceLang",
    "translate",
  );
  const defaultTargetLang = await getSettingValue(
    "defaultTargetLang",
    "translate",
  );

  let sourceLang = getElementValue("sourceLang") || defaultSourceLang;
  let targetLang = getElementValue("targetLang") || defaultTargetLang;

  const type = format[serviceID as keyof typeof format];
  sourceLang = sourceLang.split("-")[0];
  targetLang = targetLang.split("-")[0];

  if (type == 3) {
    //@ts-ignore xxx
    const ss = Object.keys(langCode_francVsZotero).filter(
      (key) => langCode_francVsZotero[key as keyof typeof langCode_francVsZotero] == sourceLang,
    );
    if (ss.length > 0) {
      sourceLang = Object.keys(ss[0])[0];
    }
    //@ts-ignore xxx
    const tt = Object.keys(langCode_francVsZotero).filter(
      (key) => langCode_francVsZotero[key as keyof typeof langCode_francVsZotero] == targetLang,
    );
    if (tt.length > 0) {
      targetLang = Object.keys(ss[0])[0];
    }

    return {
      targetLang: targetLang,
      sourceLang: sourceLang,
    };
  }
  /* return lang;


  sourceLang = await getLangCode(sourceLang, type);
  targetLang = await getLangCode(targetLang, type); */
  return {
    targetLang: targetLang,
    sourceLang: sourceLang,
  };
}
