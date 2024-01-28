import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
import { arrToObj } from "../../utils/tools";
import { saveDBLangCode } from "../database/language";
import { testClass } from "../database/translationItem";
import { openWindow } from "./testOpen";
import { makeClickButton, makeId, makeTagElementProps } from "./uiTools";

const keysForButtonMenu = ["label", "func", "args"];
const paras = ["测试类", testClass, []];
const paras2 = ["openWindow", openWindow, []];

//const paras3 = ["zotero js 模块", zmodules, []];
function menuitemObj(argsArr: any[]) {
    return arrToObj(keysForButtonMenu, argsArr);
}

const menuitemGroupArr = [
    [menuitemObj(paras)],
    [menuitemObj(paras2)],
];


export function mountMenu() {
    if (document.querySelector("#" + config.addonRef + "_imgTableTool")) { return; }
    const parent = document.querySelector("#main-menubar");
    const titlebarButtonbox = document.querySelector(".titlebar-buttonbox");
    const toolbarMenubar = document.querySelector("#toolbar-menubar");
    if (!parent) return;
    let widthSpace = toolbarMenubar!.clientWidth - (titlebarButtonbox!.clientWidth + parent.clientWidth + (parent as any).screenX + 8);
    const toolbarspacer = ztoolkit.UI.appendElement(
        makeTagElementProps({
            tag: "toolbarspacer",
        }), parent
    );
    const menupopupID = "_menupopupImgTableTool2";
    const menuProps = makeTagElementProps({
        tag: "menu",
        id: makeId("menu"),
        attributes: {
            align: "right",
        },
        styles: {
            padding: "4px 2px 4px 28px",
            backgroundImage: `url(chrome://${config.addonRef}/content/icons/favicon.png)`,
            backgroundSize: "24px 24px",
            backgroundPosition: "10% center",
            backgroundRepeat: "no-repeat",

        },
        properties: {
            "label": getString("menu-label"),
            "accesskey": "A",
            "crop": "right",
            "tooltiptext": getString("menu-label"),
            //"oncommand": "Zotero_Tools.imgTableTool.toggle();"
        }

    });
    const menu = ztoolkit.UI.appendElement(
        menuProps,
        parent
    );
    widthSpace = widthSpace - menu.clientWidth;
    toolbarspacer.style.width = String(widthSpace) + 'px';
    const menuPopup = makeClickButton(menupopupID, menuitemGroupArr) as Element;
    menu.append(menuPopup);
}






