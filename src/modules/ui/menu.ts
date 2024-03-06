import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
import { getPref } from "../../utils/prefs";
import { arrToObj, collectFilesRecursive, getFilesRecursive } from "../../utils/tools";
import { clearAllTable } from '../database/database';
import { openAddonPrefPane } from "../preferenceScript";
import { translate } from "../translate/translate";
import { testTableClass } from "./table";
import { makeClickButton, makeId, makeTagElementProps } from "./uiTools";


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
        accesskey: "A",
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
        //crop: "right",
        tooltiptext: getString("menu-label"),
        //"oncommand": "Zotero_Tools.imgTableTool.toggle();"
      },
    });
    menu = ztoolkit.UI.createElement(document, "menu", menuProps);
    if (!menu) {
      ztoolkit.log("menu not created");
      return;
    }
    const paraArrs = [
      ["getFilesRecursive", getFilesRecursive, ["C:\\Users\\Administrator\\Documents\\test"]],
      ["collectFilesRecursive", collectFilesRecursive, ["C:\\Users\\Administrator\\Documents\\test"]],
      ["翻译测试", translate, ["跑流程"], "T", "Ctrl+T"],
      ["clearTable", clearAllTable,],
      ["menuAddon-openAddonPrefPane", openAddonPrefPane],
      ['testTableClass', testTableClass],
    ];



    const menuitemGroupArr = paraArrs.map(e => [menuitemObj(e)]);

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

  function menuitemObj(argsArr: any[]) {
    return arrToObj(["label", "func", "args", "accesskey"], argsArr);
    //"acceltext" 可显示，无功能
  }
}
