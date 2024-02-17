import { getString } from "../utils/locale";
import { config } from "../../package.json";
import { getDom, getElementValue, makeId, } from "./ui/uiTools";
import { getDB } from "./database/database";
import { arrToObj, showInfo } from "../utils/tools";
import { TranslateService, services } from "./translate/services";
import { mountMenu } from "./ui/menu";
import { ColumnOptions } from "zotero-plugin-toolkit/dist/helpers/virtualizedTable";
import { replaceSecretKeysTable } from "./ui/tableProps";
//import { makeColumnProps, makeTableProps } from "./ui/tableProps";



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

  //多账户管理
  const childrenArr = Object.values(services)
    .filter((e) => !e.forbidden)
    .map((service) => ({
      tag: "menuitem",
      id: makeId(`${service.id}`),
      attributes: {
        label: getString(`service-${service.id}`),
        value: service.id,
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
            /* const serviceID = getElementValue("serviceID")!;
            serviceManage.syncBaiduSecretKey(serviceID);
            serviceManage.mergeAndRemoveDuplicates(serviceID);
            addon.data.prefs!.rows = getRows(serviceID);
            updatePrefsUI();
            onPrefsEvents("update-QPS");
            onPrefsEvents("update-charasPerTime");
            onPrefsEvents("update-hasSecretKey");
            onPrefsEvents("update-charasLimit");
            onPrefsEvents("update-limitMode");
            onPrefsEvents("update-isMultiParas");
            onPrefsEvents("update-secretKeyInfo"); */
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

/* async function replaceSecretKeysTable() {

  let rows;
  if (!(rows = addon.mountPoint.rows)) {
    const serviceID = getElementValue("serviceID");
    rows = addon.mountPoint.rows = secretKeysTableRowsData(serviceID);
  }



  const propsOption: VTableProps & { columnPropKeys?: string[]; columnPropValues?: any[][]; rows?: any[]; containerId?: string; } = {
    columnPropKeys: ["dataKey", "label", "staticWidth", "fixedWidth", "flex"],
    columnPropValues: [
      ["key", getString("prefs-table-key"), false, false, 2],
      ["usable", getString("prefs-table-usable"), false, false, 1],
      ["charConsum", getString("prefs-table-charConsum"), false, false, 1]
    ],
    rows,
    id: `${config.addonRef}-` + "secretKeysTable",
    containerId: `${config.addonRef}-table-container`,

  };

  // makeColumnProps(propsOption.columnPropKeys!)(propsOption.columnPropValues!)

  const containerId = `${config.addonRef}-table-container`;


  if (addon.data.prefs?.window == undefined) return;
  async function tableFactory(win: Window, propsOption: any) {
    if (!propsOption.containerId) {
      throw "Must pass propsOption.containerId which assign table location";
    }
    const renderLock = ztoolkit.getGlobal("Zotero").Promise.defer();
    const tableHelper = new ztoolkit.VirtualizedTable(win);

    const tableProps = makeTableProps(propsOption, tableHelper);
    tableHelper.setContainerId(propsOption.containerId);
    tableHelper.setProp(tableProps);
    tableHelper.render(-1, () => {
      renderLock.resolve();
    });
    await renderLock.promise;
    if (!addon.mountPoint.tables) addon.mountPoint.tables = {};
    addon.mountPoint.tables[tableProps.id] = tableHelper;
    return tableHelper;
  }
  const renderLock = ztoolkit.getGlobal("Zotero").Promise.defer();
  const tableHelper = new ztoolkit.VirtualizedTable(addon.data.prefs?.window);

  const tableProps = makeTableProps(propsOption, tableHelper);
  tableHelper.setContainerId(containerId);
  tableHelper.setProp(tableProps);
  tableHelper.render(-1, () => {
    renderLock.resolve();
  });
  await renderLock.promise;

  if (!addon.mountPoint.tables) addon.mountPoint.tables = {};
  addon.mountPoint.tables[tableProps.id] = tableHelper;
} */

function getTable(tableID?: string) {
  if (!addon.mountPoint.tables) return;
  const tables = addon.mountPoint.tables;
  if (!tableID) return tables;
  return tables[tableID];
}



function bindPrefEvents() {
  bilingualContrastHideShow();
  getDom("bilingualContrast")?.addEventListener("command", (e) => {
    bilingualContrastHideShow();
  });

  skipLangsHideShow();
  getDom("sourceLang")!.addEventListener("command", (e) => {
    skipLangsHideShow();
  });
  //@ts-ignore has
  const mutationObserver = new addon.data.prefs!.window.MutationObserver(mountMenu);
  mutationObserver.observe(getDom("addonMenuLocation")!, {
    attributes: true,
    attributeFilter: ["value"],
  });

  getDom("addSecretKey")!.addEventListener("command", (e) => {
    const table = getTable(`${config.addonRef}-` + "secretKeysTable");
    const rows = table.treeInstance.rows;
    const keys = Object.keys(rows[0]);
    const row = arrToObj(keys, keys.map((k) => k + ' + empty'));
    rows.push(row);
    table.render();
  });

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
    for (const checkbox of checkboxs) {
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
      for (const checkbox of checkboxs) {
        //@ts-ignore has
        if (Zotero.Locale.availableLocales[Zotero.locale] != checkbox.label)
          continue;
        (checkbox as XUL.Checkbox).checked = (e.target as XUL.Checkbox).checked;
      }
    },
  );
}


declare type columnsProp = {
  dataKey: string,
  label: string,
  staticWidth: boolean,
  fixedWidth: boolean,
  flex: number;
};


declare type CS = {
  dataKey: string;
  label: string;
  iconLabel?: React.ReactElement;
  defaultSort?: 1 | -1;
  flex?: number;
  width?: number;
  fixedWidth?: boolean;
  staticWidth?: boolean;
  minWidth?: number;
  ignoreInColumnPicker?: boolean;
  submenu?: boolean;
};

declare type columnOption<K extends keyof ColumnOptions> = [K];

declare type CS2 = [dataKey: string,
  label: string,
  iconLabel?: React.ReactElement,
  defaultSort?: 1 | -1,
  flex?: number,
  width?: number,
  fixedWidth?: boolean,
  staticWidth?: boolean];








/* const secretKeysTableRowsData = <T extends keyof TranslateService>(serviceID?: T) => {
  const serviceSelected: TranslateService | undefined = serviceID ? services[serviceID] : undefined;
  let rows;
  const secretKeysTableConfig = {
    columnPropKeys: ["dataKey", "label", "staticWidth", "fixedWidth", "flex"],
    columnPropValues: [
      ["key", getString("prefs-table-key"), false, false, 3],
      ["usable", getString("prefs-table-usable"), false, false, 1],
      ["charConsum", getString("prefs-table-charConsum"), false, false, 1]
    ],
  };
  const keys = keysRowDate(secretKeysTableConfig.columnPropValues);
  const getRowDataValues = kvArrsToObjects(keys);
  if (serviceSelected?.secretKey?.length) {
    const secretKey: object[] = serviceSelected.secretKey;
    rows = secretKey.map((e: any) => getRowDataValues(Object.values(e)));
  } else {
    rows = [getRowDataValues()];
  }
  return rows;
}; */



