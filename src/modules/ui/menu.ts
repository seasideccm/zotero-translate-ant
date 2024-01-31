import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
import { getPref } from "../../utils/prefs";
import { arrToObj } from "../../utils/tools";
import { test } from "../database/translationItem";
import { openWindow } from "./testOpen";
import { makeClickButton, makeId, makeTagElementProps } from "./uiTools";

const keysForButtonMenu = ["label", "func", "args"];
const paras = ["最新ID号", test, []];
const paras2 = ["openWindow", openWindow, []];

//const paras3 = ["zotero js 模块", zmodules, []];
function menuitemObj(argsArr: any[]) {
  return arrToObj(keysForButtonMenu, argsArr);
}

const menuitemGroupArr = [[menuitemObj(paras)], [menuitemObj(paras2)]];

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
