import { getString } from "../utils/locale";
import { config } from "../../package.json";
import { getElementValue, makeId } from "./ui/uiTools";
import { services } from "./translate/services";
import { getDB } from "./database";
import { Command } from "zotero-plugin-toolkit/dist/managers/prompt";
import { showInfo } from "../utils/tools";


export function registerPrefs() {
  const prefOptions = {
    pluginID: config.addonID,
    src: rootURI + "chrome/content/preferences.xhtml",
    label: getString("prefs-title"),
    image: `chrome://${config.addonRef}/content/icons/favicon.png`,
    defaultXUL: true,
  };
  ztoolkit.PreferencePane.register(prefOptions);
}


export async function registerPrefsScripts(_window: Window) {

  if (!addon.data.prefs) {
    addon.data.prefs = {
      window: _window,
    };
  } else {
    addon.data.prefs.window = _window;
  }
  buildPrefsPane();

}

async function buildPrefsPane() {
  const doc = addon.data.prefs?.window?.document;
  if (!doc) {
    return;
  }
  /* ztoolkit.UI.replaceElement(
    {
      // 下拉列表
      tag: "menulist",
      id: makeId("serviceID"),
      attributes: {
        native: "true",
      },
      listeners: [
        {
          type: "command",
          listener: (e: Event) => {
            const serviceID = getElementValue("serviceID")!;


          },
        },
      ],
      children: [
        {
          tag: "menupopup",
          //map出的对象数组赋值给键 children
          children: Object.values(services).filter(e => !e.forbidden).map((service) => ({
            tag: "menuitem",
            id: makeId(`${service.id}`),
            attributes: {
              label: getString(`service-${service.id}`),
              value: service.id,
            },
          })),
        },
      ],
    },
    // 将要被替换掉的元素
    doc.querySelector(`#${makeId("serviceID-placeholder")}`)!
  ); */
  // 原文语言
  let defaultSourceLang;
  const DB = await getDB();
  if (DB) {
    try {
      defaultSourceLang = await DB.valueQueryAsync("SELECT value FROM settings WHERE setting='translate' AND key='defaultSourceLang'");
    }
    catch (e) {
      ztoolkit.log(e);
    }
  }

  defaultSourceLang = defaultSourceLang ? defaultSourceLang : defaultSourceLang = "en-US";
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
      /* listeners: [
        {
          type: "command",
          listener: (e: Event) => {
            showInfo("有动静");
          }
        }
      ] */
    },
    // 将要被替换掉的元素
    doc.querySelector(`#${makeId("sourceLang-placeholder")}`)!
  );
  function observeValue(targetId: string, attributes: string[], keyTorecord: 'defaultSourceLang' | 'defaultTargetLang') {
    const doc = addon.data.prefs?.window?.document;
    if (!doc) {
      return;
    }
    const win: Window | undefined = addon.data.prefs?.window;
    if (!win) {
      return;
    }
    const config: any = { attributes: true };
    if (attributes) {
      config.attributeFilter = attributes;
    }
    const target = doc.querySelector(`#${targetId}`);
    if (!target) return;
    const sql = "REPLACE INTO settings (setting, key, value) VALUES ('translate', '" + keyTorecord + "', ?)";
    //callback=cb
    async function callback(mutationsList: any[], observer: any) {
      for (const mutation of mutationsList) {
        if (mutation.type === "attributes") {
          if (attributes?.includes(mutation.attributeName)) {
            showInfo(("The selected" + mutation.attributeName + " attribute was modified."));
            const value = mutation.target[mutation.attributeName];
            if (!sql) return;
            const DB = await getDB();
            await DB.executeTransaction(async function () {
              await DB.queryAsync(sql, value);
            });

          } else {
            showInfo(("The " + mutation.attributeName + " attribute was modified."));
          }
        }
      }
    }
    //@ts-ignore has
    return new win.MutationObserver(callback);

  }


  const oob = observeValue(makeId("sourceLang"), ["value"], "defaultSourceLang");
  oob.observe(target, config);

  // 目标语言


  ztoolkit.UI.replaceElement(
    {
      tag: "menulist",
      id: makeId("targetLang"),
      attributes: {
        native: "true",
        label: Zotero.Locale.availableLocales[Zotero.locale],
        value: Zotero.locale,
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
    doc.querySelector(`#${makeId("targetLang-placeholder")}`)!
  );
  observeValue(makeId("targetLang"), ["values"], "defaultTargetLang");


  //menuPopupTargetLang.parentNode!.setAttribute("label", Zotero.Locale.availableLocales[Zotero.locale]);




}