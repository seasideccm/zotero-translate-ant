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

  defaultSourceLang = defaultSourceLang ? defaultSourceLang : void 0;
  defaultTargetLang = defaultTargetLang ? defaultTargetLang : Zotero.locale;

  const sourceLangPlaceholder = getDom("sourceLang-placeholder")!;
  const targetLangPlaceholder = getDom("targetLang-placeholder")!;

  const sourceLangChilds = Object.keys(Zotero.Locale.availableLocales).map(e => ({
    tag: "menuitem",
    id: makeId(e),
    attributes: {
      //@ts-ignore has
      label: Zotero.Locale.availableLocales[e],
      value: e,
    },
  }));
  const autoDetect = {
    tag: "menuitem",
    id: makeId("autoDetect"),
    attributes: {
      //@ts-ignore has
      label: getString("autoDetect"),
      value: "autoDetect",
    }
  };
  sourceLangChilds.unshift(autoDetect);
  ztoolkit.UI.replaceElement(
    {
      // 下拉列表
      tag: "menulist",
      id: makeId("sourceLang"),
      attributes: {
        native: "true",
        //@ts-ignore has
        label: defaultSourceLang ? Zotero.Locale.availableLocales[defaultSourceLang] : getString("autoDetect"),
        value: defaultSourceLang ? defaultSourceLang : "autoDetect",
      },
      children: [
        {
          tag: "menupopup",
          //map出的对象数组赋值给键 children
          children: sourceLangChilds,
        },
      ],
    },
    // 将要被替换掉的元素
    sourceLangPlaceholder
  );

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
  const sourceLangMenulist = getDom("sourceLang")!;
  const targetLangMenulist = getDom("targetLang")!;


  /*  const skipLangs = getDom("skipLanguages-placeholder")!;
   if (sourceLangMenulist.value == "autoDetect") {
     skipLangs.hidden = true;
   } else {
     const checkboxs = Object.keys(Zotero.Locale.availableLocales).map(e => ({
       tag: "checkbox",
       attributes: {
         //@ts-ignore has
         label: Zotero.Locale.availableLocales[e],
       },
       properties: {
         //@ts-ignore has
         checked: sourceLangMenulist.value == "autoDetect" ? e == Zotero.locale : sourceLangMenulist.value != e,
       },
     }));
     const checkboxsRows = [];
     let start = 0;
     const step = 5;
     let end = step;
     for (; start < checkboxs.length; start += step, end += step) {
 
       checkboxsRows.push(checkboxs.slice(start, end));
     }
     const childrenArr: any[] = checkboxsRows.map(e => ({
       tag: "hbox",
       children: e
     }));
     const caption = {
       tag: "caption",
       namespace: "xul",
       attributes: {
         label: "测试group",
       }
     };
     childrenArr.unshift(caption);
 
     ztoolkit.UI.replaceElement({
       tag: "groupbox",
       namespace: "xul",
       id: makeId("skipLangs"),
       properties: {
         collapse: true,
       },
 
       children: childrenArr,
 
 
     }, skipLangs);
   }
  */




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



  skipLangsSwitch();
  getDom("sourceLang")!.addEventListener("command", (e) => {
    skipLangsSwitch();
    /* const value = sourceLangMenulist.value;
    const skipLangs = getDom("skipLangs");
    if (value != "autoDetect") {
      if (skipLangs) {
        skipLangs.hidden = true;
        return;
      }

    }
    if (skipLangs) {
      skipLangs.hidden = false;
      return;
    }
    const checkboxs = Object.keys(Zotero.Locale.availableLocales).map(e => ({
      tag: "checkbox",
      attributes: {
        //@ts-ignore has
        label: Zotero.Locale.availableLocales[e],
      },
      properties: {
        //@ts-ignore has
        checked: sourceLangMenulist.value == "autoDetect" ? e == Zotero.locale : sourceLangMenulist.value != e,
      },
    }));
    const checkboxsRows = [];
    let start = 0;
    const step = 5;
    let end = step;
    for (; start < checkboxs.length; start += step, end += step) {

      checkboxsRows.push(checkboxs.slice(start, end));
    }
    const childrenArr: any[] = checkboxsRows.map(e => ({
      tag: "hbox",
      children: e
    }));
    const caption = {
      tag: "caption",
      namespace: "xul",
      attributes: {
        label: "测试group",
      }
    };
    childrenArr.unshift(caption);

    ztoolkit.UI.replaceElement({
      tag: "groupbox",
      namespace: "xul",
      id: makeId("skipLangs"),
      properties: {
        collapse: true,
      },

      children: childrenArr,


    }, getDom("skipLanguages-placeholder")!); */


  });
}


function skipLangsSwitch() {
  {
    const sourceLangMenulist = getDom("sourceLang")!;
    const value = sourceLangMenulist.value;
    const skipLangs = getDom("skipLangs");
    if (value != "autoDetect") {
      if (skipLangs) {
        skipLangs.parentElement.hidden = true;
        return;
      }
      getDom("skipLanguages-placeholder").parentElement.hidden = true;
      return;
    }
    if (skipLangs) {
      skipLangs.parentElement.hidden = false;
      return;
    }
    const checkboxs = Object.keys(Zotero.Locale.availableLocales).map(e => ({
      tag: "checkbox",
      attributes: {
        //@ts-ignore has
        label: Zotero.Locale.availableLocales[e],
      },
      properties: {
        //@ts-ignore has
        checked: sourceLangMenulist.value == "autoDetect" ? e == Zotero.locale : sourceLangMenulist.value != e,
      },
    }));
    const checkboxsRows = [];
    let start = 0;
    const step = 5;
    let end = step;
    for (; start < checkboxs.length; start += step, end += step) {

      checkboxsRows.push(checkboxs.slice(start, end));
    }
    const childrenArr: any[] = checkboxsRows.map(e => ({
      tag: "hbox",
      children: e
    }));
    const caption = {
      tag: "caption",
      namespace: "xul",
      attributes: {
        label: "测试group",
      }
    };
    childrenArr.unshift(caption);

    ztoolkit.UI.replaceElement({
      tag: "groupbox",
      namespace: "xul",
      id: makeId("skipLangs"),
      properties: {
        collapse: true,
      },

      children: childrenArr,


    }, getDom("skipLanguages-placeholder")!);


  }
}

