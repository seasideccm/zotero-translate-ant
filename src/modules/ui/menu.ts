import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
import { getPref } from "../../utils/prefs";
import { arrToObj, collectFilesRecursive, getFilesRecursive, test1 } from "../../utils/tools";
import { compareSQLUpdateDB, getDB } from '../database/database';
import { openAddonPrefPane } from "../preferenceScript";

import { makeClickButton, makeId, makeTagElementProps } from "./uiTools";

const keysForButtonMenu = ["label", "func", "args"];

async function renameTable() {

  const old = "translateService";
  const newTable = "translateServices";
  const DB = await getDB();
  await DB.renameTable(old, newTable);
}

async function clearTable(tableNames: string[]) {
  const DB = await getDB();
  for (const tableName of tableNames) {
    const sql = `DELETE FROM ${tableName}`;
    await DB.queryAsync(sql);
  }
}

const tableNames2 = ["translateServiceSN", "translateServices", "accounts", "accessTokens", "freeLoginServices", "charConsum", "totalCharConsum", "serviceLimits", "serviceTypes"];

const paraArrs = [
  ["getFilesRecursive", getFilesRecursive, ["C:\\Users\\Administrator\\Documents\\test"]],
  ["collectFilesRecursive", collectFilesRecursive, ["C:\\Users\\Administrator\\Documents\\test"]],
  ["compareSQLUpdateDB", compareSQLUpdateDB, []],
  ["clearTable", clearTable, [tableNames2]],
  ["openAddonPrefPane", openAddonPrefPane, []],
];



function menuitemObj(argsArr: any[]) {
  return arrToObj(keysForButtonMenu, argsArr);
}

const menuitemGroupArr = paraArrs.map(e => [menuitemObj(e)]);
export function mountMenu() {
  let menu = document.querySelector(`#${makeId("menu")}`);
  if (!menu) {
    const menuProps = makeTagElementProps({
      tag: "menu",
      id: makeId("menu"),
      namespace: "xul",
      attributes: {
        align: "right",
        draggable: "true",
      },
      styles: {
        padding: "4px 2px 4px 28px",
        backgroundImage: `url(chrome://${config.addonRef}/content/icons/favicon.png)`,
        backgroundSize: "24px 24px",
        backgroundPosition: "left",
        backgroundRepeat: "no-repeat",
      },
      properties: {
        label: getString("menu-label"),
        accesskey: "A",
        crop: "right",
        tooltiptext: getString("menu-label"),
        //"oncommand": "Zotero_Tools.imgTableTool.toggle();"
      },
    });
    menu = ztoolkit.UI.createElement(document, "menu", menuProps);
    const menuPopup = makeClickButton(makeId("menu"), menuitemGroupArr) as Element;
    menu.append(menuPopup);
  }
  const location = getPref("addonMenuLocation") || "right";
  let ref;
  if (location == "right") {
    ref = document.querySelector(".titlebar-button.titlebar-min");
    ref?.parentElement?.insertBefore(menu, ref);
  } else {

    ref = document.querySelector("#helpMenu");
    ref?.insertAdjacentElement("afterend", menu);
  }


}
