import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { getPref } from "../utils/prefs";
import { arrToObj } from "../utils/tools";
import { openAddonPrefPane } from "./preferenceScript";
import { getDom, makeClickButton, makeId, makeTagElementProps } from "./ui/uiTools";
import { decryptFileSelected, encryptFile } from "./crypto";
import { aITransUI, showTrans } from "./ui/dataDialog";
import { fullTextTranslate } from "./translate/fullTextTranslate";



function getParasArrs() {
  const parasArrs = [
    [
      ["info-AITranslate", aITransUI],
      ["info-translateText", showTrans],
    ],
    [
      ["info-encryptFile", encryptFile],
      ["info-decryptFile", decryptFileSelected],
    ],
    [
      ["menuAddon-openAddonPrefPane", openAddonPrefPane],
    ],
    [
      //["google Test", testgoogle],
    ],

  ];
  return parasArrs;
}
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
    const parasArrs = getParasArrs();
    const menuitemGroupArr = parasArrs.map((parasArr) =>
      parasArr.map((paras) => menuitemObj(paras as any[])),
    );

    const menuPopup = makeClickButton(
      makeId("menu"),
      menuitemGroupArr,
    ) as Element;
    menu.append(menuPopup);
  }

  let ref;
  if (Zotero.isMac) {
    ref = document.querySelector("#zotero-tb-tabs-menu");
    ref?.parentElement?.insertBefore(menu, ref);
    return;
  }
  const RadioGroup = getDom("addonMenuLocation") as XUL.RadioGroup;
  const location = RadioGroup?.value || "right";
  if (location == "right") {
    ref = document.querySelector(".titlebar-button.titlebar-min");
    ref?.parentElement?.insertBefore(menu, ref);
  } else {
    ref = document.querySelector("#helpMenu");
    ref?.insertAdjacentElement("afterend", menu);
  }
}
function menuitemObj(argsArr: any[]) {
  return arrToObj(["label", "func", "args", "accesskey"], argsArr);
  //"acceltext" 可显示，无功能
}

export function rightClickMenuItem() {
  const menuIcon = `chrome://${config.addonRef}/content/icons/favicon@0.5x.png`;
  ztoolkit.Menu.register("item", {
    tag: "menuseparator",
  });
  // item menuitem with icon
  ztoolkit.Menu.register("item", {
    tag: "menuitem",
    label: getString("menuitem-note") + " ALT+N",
    commandListener: (ev) => {
      fullTextTranslate.translateFT("note");
    },
    icon: menuIcon,
  });
  ztoolkit.Menu.register("item", {
    tag: "menuitem",
    label: getString("menuitem-pdf") + " ALT+P",
    commandListener: (ev) => {
      fullTextTranslate.translateFT("pdf");
    },
    icon: menuIcon,
  });
  ztoolkit.Menu.register("item", {
    tag: "menuitem",
    label: getString("menuitem-pdf2Note"),
    commandListener: async (ev) => {
      await fullTextTranslate.pdf2Note(); //fullTextTranslate.pdf2Note();
    },
    icon: menuIcon,
  });
}
