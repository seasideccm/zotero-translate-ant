import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
import { getPref } from "../../utils/prefs";
import { arrToObj, collectFilesRecursive, getFilesRecursive, resourceFilesName, resourceFilesRecursive } from "../../utils/tools";
import { compareSQLUpdateDB, DB, getDB } from '../database/database';
import { DBsync, jsonTofileTest } from "../database/sync";

import { makeClickButton, makeId, makeTagElementProps } from "./uiTools";

const keysForButtonMenu = ["label", "func", "args"];

async function renameTable() {
  const olds = ["account", "accessToken", "alive"];
  const news = [];
  const old = "translateService";
  const newTable = "translateServices";
  const DB = await getDB();
  await DB.renameTable(old, newTable);
}


const paraArrs = [
  ["getFilesRecursive", getFilesRecursive, ["C:\\Users\\Administrator\\Documents\\test"]],
  ["collectFilesRecursive", collectFilesRecursive, ["C:\\Users\\Administrator\\Documents\\test"]],
  ["compareSQLUpdateDB", compareSQLUpdateDB, []],
  ["renameTable", renameTable, []],
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
