import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { getPref } from "../utils/prefs";
import { arrToObj } from "../utils/tools";
import { clearAllTable } from './database/database';
import { openAddonPrefPane, openAddonShortcut } from "./preferenceScript";
import { makeClickButton, makeId, makeTagElementProps } from "./ui/uiTools";
import { decryptFileSelected, encryptFileByAESKey } from './crypto';
import { readTextFiles } from "./ui/tableSecretKeys";




function getParasArrs() {
  const text = "Mechanical ventilation is frequently needed in patients with cardiogenic shock. The aim of this review is to summarize and discuss the current evidence and the pathophysiological mechanism that a clinician should consider while setting the ventilator.";
  const parasArrs = [
    [
      ["clearTable", clearAllTable,],
      ["menuAddon-openAddonShortcut", openAddonShortcut],
      ["menuAddon-openAddonPrefPane", openAddonPrefPane],
    ],
    [
      ["加密文件", encryptFileByAESKey],
      ["解密文件", decryptFileSelected],
    ],
    [
      ["读取文件内容", readTextFiles],


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
    const menuitemGroupArr = parasArrs.map(parasArr => parasArr.map(paras => menuitemObj(paras as any[])));

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


export function rightClickMenuItem() {
  const menuIcon = `chrome://${config.addonRef}/content/icons/favicon@0.5x.png`;
  ztoolkit.Menu.register("item", {
    tag: "menuseparator",
  });
  // item menuitem with icon
  ztoolkit.Menu.register("item", {
    tag: "menuitem",
    label: getString("menuitem-note") + " ALT+N",
    commandListener: ((ev) => {
      //Translator.translateFT("note");
    }),
    icon: menuIcon,
  });
  ztoolkit.Menu.register("item", {
    tag: "menuitem",
    label: getString("menuitem-pdf") + " ALT+P",
    commandListener: ((ev) => {
      // Translator.translateFT("pdf");
    }),
    icon: menuIcon,
  });
  ztoolkit.Menu.register("item", {
    tag: "menuitem",
    label: getString("menuitem-pdf2Note"),
    commandListener: (async (ev) => {
      // await this.pdf2Note();       //Translator.pdf2Note();
    }),
    icon: menuIcon,
  });

  ztoolkit.Menu.register("item", {
    tag: "menuitem",
    label: "添加图片注释",
    commandListener: (async (ev) => {
      //await imageToAnnotation();       //Translator.pdf2Note();
    }),
    icon: menuIcon,
  });
  ztoolkit.Menu.register("item", {
    tag: "menuitem",
    label: "测试保存图片",
    commandListener: (async (ev) => {
      //await testSaveImg();
    }),
    icon: menuIcon,
  });



  ztoolkit.Shortcut.register("event", {
    id: `${config.addonRef}-key-translate-note`,
    key: "N",
    // 似乎只支持单个修饰键
    //modifiers="accel,shift,alt"
    modifiers: "alt",
    callback: (keyOptions) => {
      addon.hooks.onShortcuts("translateNote");
    },
  });
  ztoolkit.Shortcut.register("event", {
    id: `${config.addonRef}-key-translate-pdf`,
    key: "P",
    modifiers: "alt",
    callback: (keyOptions) => {
      addon.hooks.onShortcuts("translatePDF");
    },
  });
}






