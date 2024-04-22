import { getString } from "../utils/locale";
import { config } from "../../package.json";
import { getDom, makeId, } from "./ui/uiTools";
import { getDB } from "./database/database";
import { showInfo } from "../utils/tools";
import { mountMenu } from "./menu";
import { elemHiddenSwitch, getSelectedRow, labelHiddenSwitch, priorityWithKeyTable, priorityWithoutKeyTable, replaceSecretKeysTable, updateServiceData } from "./ui/tableSecretKeys";
import { getServices } from "./translate/translateServices";
import { addonSetting, setCurrentServiceSN } from "./addonSetting";
import { setHiddenState } from "./command";
import { encryptState } from "./crypto";
import { llmSettings } from "./ui/llmSettings";





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
  await replaceSecretKeysTable();
  await priorityWithKeyTable();
  await priorityWithoutKeyTable();
  await llmSettings();

  bindPrefEvents();
  addonSetting();
}

async function buildPrefsPane() {
  const doc = addon.data.prefs?.window?.document;
  if (!doc) {
    return;
  }
  const DB = await getDB();

  // 原文语言 目标语言
  const langPair = async () => {

    let defaultSourceLang, defaultTargetLang;
    if (DB) {
      try {
        defaultSourceLang = await DB.valueQueryAsync(
          "SELECT value FROM settings WHERE setting='translate' AND key='defaultSourceLang'",
        );
        defaultTargetLang = await DB.valueQueryAsync(
          "SELECT value FROM settings WHERE setting='translate' AND key='defaultTargetLang'",
        );

      } catch (e) {
        ztoolkit.log(e);
      }
    }

    defaultSourceLang = defaultSourceLang ? defaultSourceLang : void 0;
    defaultTargetLang = defaultTargetLang ? defaultTargetLang : Zotero.locale;


    const sourceLangPlaceholder = getDom("sourceLang-placeholder")!;
    const targetLangPlaceholder = getDom("targetLang-placeholder")!;

    const sourceLangChilds = Object.keys(Zotero.Locale.availableLocales).map(
      (e) => ({
        tag: "menuitem",
        id: makeId(e),
        attributes: {
          //@ts-ignore has
          label: Zotero.Locale.availableLocales[e],
          value: e,
        },
      }),
    );
    const autoDetect = {
      tag: "menuitem",
      id: makeId("autoDetect"),
      attributes: {
        //@ts-ignore has
        label: getString("autoDetect"),
        value: "autoDetect",
      },
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
          label: defaultSourceLang
            ? //@ts-ignore has
            Zotero.Locale.availableLocales[defaultSourceLang]
            : getString("autoDetect"),
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
      sourceLangPlaceholder,
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
            children: Object.keys(Zotero.Locale.availableLocales).map((e) => ({
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
      targetLangPlaceholder,
    );
  };
  await langPair();
  //监视
  const observeLangPair = async () => {
    const sourceLangMenulist = getDom("sourceLang")!;
    const targetLangMenulist = getDom("targetLang")!;

    const configObserver = {
      attributes: true,
      attributeFilter: ["label"],
      attributeOldValue: true,
    };
    //@ts-ignore has
    const mutationObserver = new addon.data.prefs!.window.MutationObserver(
      callback,
    );
    mutationObserver.observe(sourceLangMenulist, configObserver);
    mutationObserver.observe(targetLangMenulist, configObserver);
    async function callback(mutationsList: any[]) {
      const DB = await getDB();
      if (!DB) return;
      for (const mutation of mutationsList) {
        if (!mutation.target.id.match(/(sourceLang)|(targetLang)/g)) return;
        const value = mutation.target.value;
        const label = mutation.target.label;
        const keyTorecord = mutation.target.id.includes("sourceLang")
          ? "defaultSourceLang"
          : "defaultTargetLang";
        const sql =
          "REPLACE INTO settings (setting, key, value) VALUES ('translate', ?, ?)";
        if (!value) return;
        showInfo(
          "The " +
          keyTorecord +
          " was modified from " +
          mutation.oldValue +
          " to " +
          label +
          "."
        );
        await DB.executeTransaction(async function () {
          await DB.queryAsync(sql, [keyTorecord, value]);
        });
      }
    }
  };
  await observeLangPair();


  // 安全设置   在账号表格前设置，以便控制 secretKey 和 token 字段内容
  const state = await encryptState();
  await setHiddenState();

  //多账户管理

  const services = await getServices();
  const childrenArr = Object.values(services)
    .filter((e) => !e.forbidden)
    .map((service) => ({
      tag: "menuitem",
      id: makeId(`${service.serviceID}`),
      attributes: {
        label: getString(`service-${service.serviceID}`),
        value: service.serviceID,
      },
    }));

  ztoolkit.UI.replaceElement(
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

          },
        },
      ],
      children: [
        {
          tag: "menupopup",
          //map出的对象数组赋值给键 children
          children: childrenArr,
        },
      ],
    },
    // 将要被替换掉的元素
    doc.querySelector(`#${makeId("serviceID-placeholder")}`)!,
  );

  ztoolkit.UI.replaceElement(
    {
      tag: "menulist",
      id: makeId("limitMode"),
      attributes: {
        value: '',
        native: "true",
      },
      children: [
        {
          tag: "menupopup",
          children: [
            {
              tag: "menuitem",
              attributes: {
                label: getString("pref-limitMode-daily"),
                value: "daily",
              },
            },
            {
              tag: "menuitem",
              attributes: {
                label: getString("pref-limitMode-month"),
                value: "month",
              },
            },
            {
              tag: "menuitem",
              attributes: {
                label: getString("pref-limitMode-total"),
                value: "total",
              },
            },
            {
              tag: "menuitem",
              attributes: {
                label: getString("pref-limitMode-noLimit"),
                value: "noLimit",
              },
            },
            {
              tag: "menuitem",
              attributes: {
                label: getString("pref-limitMode-pay"),
                value: "pay",
              },
            },
          ]
        },
      ],
    },
    doc.querySelector(`#${makeId("limitMode-placeholder")}`)!
  );







}

function bindPrefEvents() {
  const win = addon.data.prefs?.window;
  const doc = addon.data.prefs?.window.document;
  if (!win || !doc) return;
  bilingualContrastHideShow();
  getDom("bilingualContrast")?.addEventListener("command", (e) => {
    bilingualContrastHideShow();
  });

  skipLangsHideShow();
  getDom("sourceLang")!.addEventListener("command", (e) => {
    skipLangsHideShow();
  });

  getDom("switchService")!.addEventListener("command", async (e) => {
    const elem = getDom("serviceID") as XUL.MenuList;
    if (!elem) return;
    const serviceID = elem.value;

    let serialNumber: string;
    const row = getSelectedRow();
    if (!row) {
      //未选择行
      const services = await getServices();
      const service = services[serviceID];
      if (!service.hasSecretKey && service.hasToken) {
        //引擎没有秘钥
        if (!service.serialNumber) return;
        serialNumber = service.serialNumber.toString();
      } else {
        //引擎有秘钥，选一个可用的
        if (!service.accounts || !service.accounts.length) return;
        serialNumber = service.accounts?.filter(account => {
          account.usable && !account.forbidden;
        })[0].serialNumber.toString();
      }
    } else {
      const appID = row.children[0].textContent;
      if (!appID) {
        throw "no appID in the table's row ";
      } else {
        serialNumber = await getSerialNumberByAppid(serviceID, appID);
      }
    }
    await setCurrentServiceSN(serialNumber);
  });

  getDom("recoverService")!.addEventListener("command", async (e) => {
    const serviceMenu_popup = doc.querySelector(`#${config.addonRef}-serviceID > menupopup`)!;
    //用户确认，弹出在addon.data.prefs!.window窗口
    const confirm = addon.data.prefs!.window.confirm(
      `${getString("pref-recoverService")}`
    );
    if (confirm) {
      const services = await getServices();
      for (const e of Object.values(services)) {
        if (e.forbidden) {
          await updateServiceData(e, "forbidden", false);
          //e.forbidden = false;
          if (!serviceMenu_popup) continue;
          const menuItemObj = {
            tag: "menuitem",
            id: makeId(`${e.serviceID}`),
            attributes: {
              label: getString(`service-${e.serviceID}`),
              value: e.serviceID,
            }
          };
          ztoolkit.UI.appendElement(menuItemObj, serviceMenu_popup);
        }
      }
      /* Object.values(services).forEach(e => {
        if (e.forbidden) {
          await updateServiceData(e, "forbidden", false);
          e.forbidden = false;
          const menuItemObj = {
            tag: "menuitem",
            id: makeId(`${e.serviceID}`),
            attributes: {
              label: getString(`service-${e.serviceID}`),
              value: e.serviceID,
            }
          };
          ztoolkit.UI.appendElement(menuItemObj, serviceMenu_popup);
        }
      }); */

    }
  });

  getDom("isPriority")?.addEventListener("command", async function dodo(this: any, e) {
    if (this.checked) {
      await priorityWithKeyTable();
      await priorityWithoutKeyTable();
    }
    elemHiddenSwitch(
      ["labelPriorityWithoutKey",
        "labelPriorityWithKey",
        "table-servicePriorityWithoutKey",
        "table-servicePriorityWithKey"],
      !this.checked);

  });



  async function getSerialNumberByAppid(serviceID: string, appID: string) {
    const sql = `SELECT serialNumber FROM translateServiceSN WHERE serviceID = '${serviceID}' AND appID = '${appID}'`;
    const DB = await getDB();
    return await DB.valueQueryAsync(sql);
  }





  //监控插件菜单的位置，如果有变化，重新加载
  //@ts-ignore has
  const mutationObserver = new win.MutationObserver(mountMenu);
  mutationObserver.observe(getDom("addonMenuLocation")!, {
    attributes: true,
    attributeFilter: ["value"],
  });
  //监控插件设置项目变化
  //@ts-ignore has
  const mutationObserverSettings = new win.MutationObserver(addonSettingUpdate);
  mutationObserverSettings.observe(doc.querySelector(`#zotero-prefpane-${config.addonRef}`)!.parentElement, {
    attributes: true, childList: true, subtree: true,
  });
  function addonSettingUpdate(mutationsList: MutationRecord[], observer: any) {
    for (const mutation of mutationsList) {//@ts-ignore has
      if (!mutation.target.id.match(/-setting-(.*)/)) continue;//@ts-ignore has
      showInfo(mutation.target.id);
      if (mutation.type === "childList") {
        showInfo("A child node has been added or removed.");
      } else if (mutation.type === "attributes") {
        showInfo("The " + mutation.attributeName + " attribute was modified.");
      }
    }
  }


}

function bilingualContrastHideShow(e?: Event) {
  const target = getDom("bilingualContrast") as XUL.Checkbox;
  if (!target) return;
  const checked = (target as XUL.Checkbox).checked;
  const sourceTargetOrder = getDom("sourceTargetOrder") as XUL.RadioGroup;
  if (!sourceTargetOrder) return;
  sourceTargetOrder.disabled = !checked;
}

function skipLangsHideShow() {
  const sourceLangMenulist = getDom("sourceLang")! as XUL.MenuList;
  const value = sourceLangMenulist.value;
  const skipLangs = getDom("skipLangs");
  if (value != "autoDetect") {
    if (skipLangs) {
      skipLangs.parentElement
        ? (skipLangs.parentElement.hidden = true)
        : () => { };
      return;
    }
    const placeholder = getDom("skipLanguages-placeholder");
    if (!placeholder) return;
    placeholder.parentElement
      ? (placeholder.parentElement.hidden = true)
      : () => { };
    return;
  }
  if (skipLangs) {
    skipLangs.parentElement
      ? (skipLangs.parentElement.hidden = false)
      : () => { };
    return;
  }
  const checkboxs = Object.keys(Zotero.Locale.availableLocales).map((e) => ({
    tag: "checkbox",
    attributes: {
      //@ts-ignore has
      label: Zotero.Locale.availableLocales[e],
    },
    properties: {
      //语种自动识别时选中与界面相同的语言，否则除了指定的源语言选中所有语言
      checked:
        sourceLangMenulist.value == "autoDetect"
          ? e == Zotero.locale
          : sourceLangMenulist.value != e,
    },
  }));
  //每行显示 5 个复选框
  const checkboxsRows = [];
  let start = 0;
  const step = 5;
  let end = step;
  for (; start < checkboxs.length; start += step, end += step) {
    checkboxsRows.push(checkboxs.slice(start, end));
  }
  //每行一个 hbox 子元素为 5个 复选框
  const childrenArr: any[] = checkboxsRows.map((e) => ({
    tag: "hbox",
    namespace: "xul",
    children: e,
  }));

  ztoolkit.UI.replaceElement(
    {
      tag: "groupbox",
      namespace: "xul",
      id: makeId("skipLangs"),
      properties: {
        collapse: true,
      },

      children: childrenArr,
    },
    getDom("skipLanguages-placeholder")!,
  );

  getDom("skipLangs")?.addEventListener("click", function (e) {
    const tagName = (e.target as any).tagName;
    if (tagName && tagName == "checkbox") {
      showInfo(
        (e.target as XUL.Checkbox).label +
        ": " +
        (e.target as XUL.Checkbox).checked,
      );
    }
  });
  getDom("selectAll")?.addEventListener("command", function (e) {
    let excludes;
    if ((getDom("isSkipLocal") as XUL.Checkbox)?.checked) {
      excludes = ["English", Zotero.Locale.availableLocales[Zotero.locale]];
    } else {
      excludes = ["English"];
    }
    const checkboxs = getDom("skipLangs")?.getElementsByTagName("checkbox");
    if (!checkboxs || !checkboxs.length) return;
    for (const checkbox of Array.from(checkboxs)) {
      //@ts-ignore has
      if (excludes.includes(checkbox.label)) continue;

      (checkbox as XUL.Checkbox).checked = (e.target as XUL.Checkbox).checked;
    }
  });
  (getDom("isSkipLocal") as XUL.Checkbox)?.addEventListener(
    "command",
    function (e) {
      const checkboxs = getDom("skipLangs")?.getElementsByTagName("checkbox");
      if (!checkboxs || !checkboxs.length) return;
      for (const checkbox of Array.from(checkboxs)) {
        //@ts-ignore has
        if (Zotero.Locale.availableLocales[Zotero.locale] != checkbox.label)
          continue;
        (checkbox as XUL.Checkbox).checked = (e.target as XUL.Checkbox).checked;
      }
    },
  );
}


export async function openAddonPrefPane() {

  //shortcut.xhtml
  const addonPrefPane = Zotero.PreferencePanes.pluginPanes.filter(e => e.pluginID == config.addonID && e.src.endsWith("preferences.xhtml"))[0];
  if (addonPrefPane.id) {
    Zotero.Utilities.Internal.openPreferences(addonPrefPane.id);
  }
  addonSetting();
}

export async function openAddonShortcut() {
  //shortcut.xhtml
  const addonPrefPane = Zotero.PreferencePanes.pluginPanes.filter(e => e.pluginID == config.addonID && e.src.endsWith("shortcut.xhtml"))[0];
  if (addonPrefPane.id) {
    Zotero.Utilities.Internal.openPreferences(addonPrefPane.id);
  }

}




