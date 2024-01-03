import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
const dropmarker =
{
    tag: "span",
    id: config.addonRef + "_dropmarker",
    namespace: "html",
    classList: ["dropmarker"],
    styles: {
        background: "url(assets/icons/searchbar-dropmarker@2x.4ebeb64c.png) no-repeat 0 0/100%",
        display: "inline-block",
        height: "4px",
        margin: "6px 0",
        marginInlineStart: "2px",
        marginInlineEnd: "2px",
        position: "relative",
        verticalAlign: "top",
        width: "7px",
        zIndex: "1"
    }
};
const buttonBackground =
{
    tag: "span",
    id: config.addonRef + "_buttonBackground",
    namespace: "html",
    classList: ["button-background"],
};


export async function zoteroMenubarButton() {

    if (document.querySelector("#" + config.addonRef + "_imgTableTool")) { return; }
    const parent = document.querySelector("#toolbar-menubar")!;
    ztoolkit.UI.appendElement(
        makeTagElementProps({ tag: "toolbarspring" }), parent
    );
    ztoolkit.UI.appendElement(
        makeTagElementProps({ tag: "toolbarseparator" }), parent
    );
    const menupopupID = "_menupopupImgTableTool2";
    const imgTableSingleObjMenuitemArr = [
        {
            label: "menuitem-showSelectedAnnotations",
            func: clearAnnotations,
            args: ["show", "selected"]
        },
        {
            label: "menuitem-deleteSelectedAnnotations",
            func: clearAnnotations,
            args: ["delete", "selected"]
        },
        {
            label: "menuitem-hiddenSelectedAnnotations",
            func: clearAnnotations,
            args: ["hidden", "selected"]
        },
    ];
    const imgTableAllObjMenuitemArr = [
        {
            label: "menuitem-hiddenAllAnnotations",
            func: clearAnnotations,
            args: ["hidden", "all"]
        },
        {
            label: "menuitem-showAllAnnotations",
            func: clearAnnotations,
            args: ["show", "all"]
        },
        {
            label: "menuitem-deleteAllAnnotations",
            func: clearAnnotations,
            args: ["delete", "all"]
        },
    ];
    const pdf2NoteMenuitemArr = [
        {
            label: "menuitem-pdf2Note",
            func: fullTextTranslate.onePdf2Note,
            args: []
        },
    ];
    const translateOnePdfMenuitemArr = [
        {
            label: "menuitem-pdf",
            func: fullTextTranslate.translateOnePdf,
            args: []
        },
    ];
    const fontMenuitemArr = [
        {
            label: "info-checkFont",
            func: fontStyleCheck,
            args: []
        },
    ];
    const syncFontInfoMenuitemArr = [
        {
            label: "info-syncFontInfo",
            func: syncFontInfo,
            args: []
        },
    ];
    const insertImgMenuitemArr = [
        {
            label: "info-insertImg",
            func: insertImg,
            args: []
        },
    ];
    const menuitemGroupArr = [
        imgTableSingleObjMenuitemArr,
        imgTableAllObjMenuitemArr,
        pdf2NoteMenuitemArr,
        translateOnePdfMenuitemArr,
        fontMenuitemArr,
        syncFontInfoMenuitemArr,
        insertImgMenuitemArr,
        viewImgMenuArr,
        testArr,
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
            //float: "right",
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
        /*         {
                namespace: "html",
                tag: "button",
                id: config.addonRef + "_imgTableTool2",
                classList: ["zotero-tb-button"],
                styles: {
                    backgroundImage: `url(chrome://${config.addonRef}/content/icons/favicon.png)`,
                    backgroundSize: "18px 18px",
                    backgroundPosition: "10% center",
                    backgroundRepeat: "no-repeat",
                    //float: "right",
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
        
            } */
        buttonProps,
        topTool
    ) as HTMLButtonElement;
    ztoolkit.UI.appendElement(
        makeTagElementProps({ tag: "toolbarseparator" }), parent
    );
}



export function makeTagElementProps(option: TagElementProps): TagElementProps {
    const preDefinedObj = {
        enableElementDOMLog: false,
        ignoreIfExists: true,
        namespace: "xul",
    };
    const tempObj = Object.assign(preDefinedObj, option);
    return tempObj;
}

export function ssmakeElementProps(option: ElementProps): ElementProps {
    const preDefinedObj = {
        enableElementDOMLog: false,
        ignoreIfExists: true,
        namespace: "xul",
    };
    const tempObj = Object.assign(preDefinedObj, option);
    return tempObj;
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
    const makeMenuitem = ztoolkit.UI.appendElement({
        tag: "menuitem",
        namespace: "xul",
        attributes: {
            label: option.label,
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




