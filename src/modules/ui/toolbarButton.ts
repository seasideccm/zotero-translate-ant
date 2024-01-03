import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
import { arrToObj } from "../../utils/tools";
//import { getDB } from "../database/addonDatabase";
import { makeTagElementProps } from "./uiTools";


export async function zoteroMenubarEndButton() {
    if (document.querySelector("#" + config.addonRef + "_imgTableTool")) { return; }
    const parent = document.querySelector("#toolbar-menubar")!;
    ztoolkit.UI.appendElement(
        makeTagElementProps({ tag: "toolbarspring" }), parent
    );
    ztoolkit.UI.appendElement(
        makeTagElementProps({ tag: "toolbarseparator" }), parent
    );
    const menupopupID = "_menupopupImgTableTool2";

    const keysForButtonMenu = ["label", "func", "args"];
    //getDB
    const menuitemGroupArr = [
        [arrToObj(keysForButtonMenu, ["开始测试", () => { }, []])],
    ];

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
        //classList: ["tool-group", "annotation-tools"],
        attributes: {
            align: "right",
        },
        styles: {
            //width: "200px",
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
        enableElementDOMLog: false,
        ignoreIfExists: true,
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

export const makeClickButton = (idPostfix: string, menuitemGroupArr: any[][], thisButton: HTMLButtonElement) => {
    const menupopup: any = makeMenupopup(idPostfix);
    menuitemGroupArr.filter((menuitemGroup: any[], i: number) => {
        menuitemGroup.map((e: any) => makeMenuitem(e, menupopup));
        //首个菜单组之后，每组均添加分割条，最后一组之后不添加
        if (i < menuitemGroupArr.length - 1) {
            menuseparator(menupopup);
        }
    });
    menupopup.openPopup(thisButton, 'after_start', 0, 0, false, false);
};
export const menuseparator = (menupopup: any) => {
    ztoolkit.UI.appendElement({
        tag: "menuseparator",
        namespace: "xul",
    }, menupopup);
};

export const makeMenupopup = (idPostfix: string) => {
    const menupopup = ztoolkit.UI.appendElement({
        tag: "menupopup",
        id: config.addonRef + idPostfix,
        namespace: "xul",
        children: [
        ]
    }, document.querySelector("#browser")!) as XUL.MenuPopup;
    return menupopup;
};


export const makeMenuitem = (option: { label: string, func: (...args: any[]) => any | void, args: any[]; }, menupopup: any,) => {
    let label = getString(option.label);
    label = label.includes("batchTranslate-") ? option.label : label;
    const makeMenuitem = ztoolkit.UI.appendElement({
        tag: "menuitem",
        namespace: "xul",
        attributes: {
            label: label,
        }
    }, menupopup);
    /* makeMenuitem.addEventListener("command", () => {
        option.func(...option.args);
    }); */
    const func = option.func;
    if (judgeAsync(func)) {
        makeMenuitem.addEventListener("command", async () => {
            await func(...option.args);
        });
    } else {
        makeMenuitem.addEventListener("command", () => {
            option.func(...option.args);
        });
    }
};

export const judgeAsync = (fun: any) => {
    const AsyncFunction = (async () => { }).constructor;
    return fun instanceof AsyncFunction;
}




