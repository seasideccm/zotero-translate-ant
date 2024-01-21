import { getString } from "../utils/locale";
import { config } from "../../package.json";
import { getElementValue, makeId } from "./ui/uiTools";
import { services } from "./translate/services";


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

function buildPrefsPane() {
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
  ztoolkit.UI.replaceElement(
    {
      // 下拉列表
      tag: "menulist",
      id: makeId("sourceLang"),
      attributes: {
        native: "true",
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
    doc.querySelector(`#${makeId("sourceLang-placeholder")}`)!
  );

  // 目标语言
  ztoolkit.UI.replaceElement(
    {
      // 下拉列表
      tag: "menulist",
      id: makeId("targetLang"),
      attributes: {
        native: "true",
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
    doc.querySelector(`#${makeId("targetLang-placeholder")}`)!
  );


}