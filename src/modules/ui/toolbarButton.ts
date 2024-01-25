import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
import { arrToObj } from "../../utils/tools";
import { testClass } from "../database/translationItem";
import { openWindow } from "./testOpen";
import { makeClickButton, makeTagElementProps } from "./uiTools";

const keysForButtonMenu = ["label", "func", "args"];
const paras = ["测试类", testClass, []];
const paras2 = ["测试类", openWindow, []];

//const paras3 = ["zotero js 模块", zmodules, []];
function menuitemObj(argsArr: any[]) {
    return arrToObj(keysForButtonMenu, argsArr);
}

const menuitemGroupArr = [
    [menuitemObj(paras)],
    [menuitemObj(paras2)]
];


export function mountButtonEndMenubar() {
    if (document.querySelector("#" + config.addonRef + "_imgTableTool")) { return; }
    //const parent = document.querySelector("#toolbar-menubar")!;
    const parent = document.querySelector("#menubar-items");
    if (!parent) {
        ztoolkit.log('get null: document.querySelector("#menubar-items")');
        return;
    }

    /* ztoolkit.UI.appendElement(
        makeTagElementProps({ tag: "toolbarspring" }), parent
    ); */
    ztoolkit.UI.appendElement(
        makeTagElementProps({ tag: "toolbarseparator" }), parent
    );
    const menupopupID = "_menupopupImgTableTool2";
    const toolbaritemProps = makeTagElementProps({
        tag: "toolbaritem",
        id: config.addonRef + "_toolbaritem",
        attributes: {
            align: "right",
        },

    });
    const menubarProps = makeTagElementProps({
        tag: "menubar",
        id: config.addonRef + "_topTools",
        attributes: {
            align: "right",
        },
        styles: {
            padding: "4px 4px"
        },
    });
    const dropmarker = {
        tag: "dropmarker",
        namespace: "xul",
        type: "menu",
        classList: ["toolbarbutton-menu-dropmarker"],
    };
    const buttonProps = makeTagElementProps({
        namespace: "html",
        tag: "button",
        id: config.addonRef + "_imgTableTool2",
        classList: ["zotero-tb-button"],
        styles: {
            backgroundImage: `url(chrome://${config.addonRef}/content/icons/favicon.png)`,
            backgroundSize: "18px 18px",
            backgroundPosition: "10% center",
            backgroundRepeat: "no-repeat",
            display: "flex",
            justifyContent: "flex-end",
            width: "48px",
            padding: "4px 3px 4px 22px",
            //backgroundColor: "rgb(234, 234, 234)",
        },
        attributes: {
            title: getString("info-imgTableTool"),
            tabindex: "-1",
        },
        listeners: [
            {
                type: "click",
                listener: () => { makeClickButton(menupopupID, menuitemGroupArr, button); },
            },
        ],
        children: [dropmarker]
    });
    const toolbaritem = ztoolkit.UI.appendElement(
        toolbaritemProps,
        parent
    );
    const topTool = ztoolkit.UI.appendElement(
        menubarProps,
        toolbaritem
    );
    const button = ztoolkit.UI.appendElement(
        buttonProps,
        topTool
    ) as HTMLButtonElement;
    ztoolkit.UI.appendElement(
        makeTagElementProps({ tag: "toolbarseparator" }), parent
    );
}






