import { getString } from "../utils/locale";
import { config } from "../../package.json";
import { getDom, getElementValue, makeId } from "./ui/uiTools";
import { services } from "./translate/services";
import { getDB } from "./database";
import { Command } from "zotero-plugin-toolkit/dist/managers/prompt";
import { showInfo } from "../utils/tools";


export function registerPrefs() {
  ztoolkit.PreferencePane.register({
    pluginID: config.addonID,
    src: rootURI + "chrome/content/preferences.xhtml",
    label: getString("prefs-title"),
    image: `chrome://${config.addonRef}/content/icons/favicon.png`,
    defaultXUL: true,
  });
}


export async function registerPrefsScripts(_window: Window) {

  if (!addon.data.prefs) {
    addon.data.prefs = {
      window: _window,
    };
  } else {
    addon.data.prefs.window = _window;
  }
  await buildPrefsPane();
  bindPrefEvents();

}

async function buildPrefsPane() {
  const doc = addon.data.prefs?.window?.document;
  if (!doc) {
    return;
  }

  // 原文语言
  let defaultSourceLang;
  let defaultTargetLang;
  const DB = await getDB();
  if (DB) {
    try {
      defaultSourceLang = await DB.valueQueryAsync("SELECT value FROM settings WHERE setting='translate' AND key='defaultSourceLang'");
      defaultTargetLang = await DB.valueQueryAsync("SELECT value FROM settings WHERE setting='translate' AND key='defaultTargetLang'");
    }
    catch (e) {
      ztoolkit.log(e);
    }
  }

  defaultSourceLang = defaultSourceLang ? defaultSourceLang : "en-US";
  defaultTargetLang = defaultTargetLang ? defaultTargetLang : Zotero.locale;

  const sourceLangPlaceholder = getDom("sourceLang-placeholder")!;
  const targetLangPlaceholder = getDom("targetLang-placeholder")!;
  ztoolkit.UI.replaceElement(
    {
      // 下拉列表
      tag: "menulist",
      id: makeId("sourceLang"),
      attributes: {
        native: "true",
        //@ts-ignore has
        label: Zotero.Locale.availableLocales[defaultSourceLang],
        value: defaultSourceLang,
      },
      children: [
        {
          tag: "menupopup",
          //map出的对象数组赋值给键 children
          children: Object.keys(Zotero.Locale.availableLocales).map(e => ({
            tag: "menuitem",
            id: makeId(e),
            attributes: {
              //@ts-ignore has
              label: Zotero.Locale.availableLocales[e],
              value: e,
            },
          })),
        },
      ],
    },
    // 将要被替换掉的元素
    sourceLangPlaceholder
  );
  const sourceLangMenulist = getDom("sourceLang")!;
  // 目标语言
  ztoolkit.UI.replaceElement(
    {
      tag: "menulist",
      id: makeId("targetLang"),
      attributes: {
        native: "true",
        //@ts-ignore has
        label: Zotero.Locale.availableLocales[defaultTargetLang],
        value: defaultTargetLang,
      },
      children: [
        {
          tag: "menupopup",
          children: Object.keys(Zotero.Locale.availableLocales).map(e => ({
            tag: "menuitem",
            attributes: {
              //@ts-ignore has
              label: Zotero.Locale.availableLocales[e],
              value: e,
            },
          })),
        },
      ],
    },
    targetLangPlaceholder
  );
  const targetLangMenulist = getDom("targetLang")!;
  const configObserver = { attributes: true, attributeFilter: ["label"], attributeOldValue: true };
  //@ts-ignore has
  const mutationObserver = new addon.data.prefs!.window.MutationObserver(callback);
  mutationObserver.observe(sourceLangMenulist, configObserver);
  mutationObserver.observe(targetLangMenulist, configObserver);
  async function callback(mutationsList: any[]) {
    const DB = await getDB();
    if (!DB) return;
    for (const mutation of mutationsList) {
      if (!mutation.target.id.match(/(sourceLang)|(targetLang)/g)) return;
      const value = mutation.target.value;
      const label = mutation.target.label;
      const keyTorecord = mutation.target.id.includes("sourceLang") ? "defaultSourceLang" : "defaultTargetLang";
      const sql = "REPLACE INTO settings (setting, key, value) VALUES ('translate', ?, ?)";
      if (!value) return;
      showInfo(("The " + keyTorecord + " was modified from " + mutation.oldValue + " to " + label + "."), 2000);
      await DB.executeTransaction(async function () {
        await DB.queryAsync(sql, [keyTorecord, value]);
      });
    }
  };
}

function bindPrefEvents() {
  getDom("bilingualContrast")?.addEventListener("command", (e) => {
    const checked = (e.target as XUL.Checkbox).checked;
    const sourceTargetOrder = getDom("sourceTargetOrder") as XUL.RadioGroup;
    if (!sourceTargetOrder) return;
    sourceTargetOrder.disabled = !checked;
  });
}

