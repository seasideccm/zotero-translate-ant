import { config } from "../../package.json";

/**
 * Get preference value.
 * Wrapper of `Zotero.Prefs.get`.
 * @param key
 */
export function getPref(key: string) {
  return Zotero.Prefs.get(`${config.prefsPrefix}.${key}`, true);
}

/**
 * Set preference value.
 * Wrapper of `Zotero.Prefs.set`.
 * @param key
 * @param value
 */
export function setPref(key: string, value: string | number | boolean) {
  return Zotero.Prefs.set(`${config.prefsPrefix}.${key}`, value, true);
}

/**
 * Clear preference value.
 * Wrapper of `Zotero.Prefs.clear`.
 * @param key
 */
export function clearPref(key: string) {
  return Zotero.Prefs.clear(`${config.prefsPrefix}.${key}`, true);
}

/**
 * 获取指定插件的prefs中的key
 * @param plugin
 * @param key
 * @returns
 */
export function getPluginsPref(plugin: string, key: string) {
  const prefsPrefix = "extensions.zotero." + plugin;
  return Zotero.Prefs.get(`${prefsPrefix}.${key}`, true);
}

/**
 * 设置指定插件的prefs中的key
 * @param plugin
 * @param key
 * @param value
 * @returns
 */
export function setPluginsPref(
  plugin: string,
  key: string,
  value: string | number | boolean,
) {
  const prefsPrefix = "extensions.zotero." + plugin;
  return Zotero.Prefs.set(`${prefsPrefix}.${key}`, value, true);
}

/**
 * 获取当前使用的引擎对象
 * 如果是 pdfTranslate 的翻译引擎，返回其 prefs 相关信息
 *
 * @returns
 */
export function getServiceInfoPDFTranslate() {
  const secrets: object = JSON.parse(
    (getPluginsPref("ZoteroPDFTranslate", "secretObj") as string) || "{}",
  );
  const serviceID = getPluginsPref(
    "ZoteroPDFTranslate",
    "translateSource",
  ) as string;
  const key = secrets[serviceID as keyof typeof secrets] as string;
  //if (isAll) return { serviceID, secrets };
  return { serviceID, key };
}
