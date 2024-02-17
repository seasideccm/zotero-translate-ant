import { config } from "../../../package.json";

export class ContextMenu {
    menupopup: XUL.MenuPopup;
    methodMap: Map<any, any>;
    constructor(option: any) {
        this.methodMap = new Map();
        this.menupopup = this.createContextMenu(option.menuPropsGroupsArr, option.idPostfix);
        this.observeMenuitem();
    }

    observeMenuitem() {
        this.menupopup.addEventListener("command", async e => {
            const tagName = (e.target as any).tagName.toLowerCase();
            if (tagName === 'menuitem') {
                // anchorNode 为操作的目标元素
                //@ts-ignore has anchorNode
                await this.handleMenuItem(this.menupopup.anchorNode, e);
            }
        });
    }

    async handleMenuItem(target: Element, menuPopupEvent: Event) {
        if (!menuPopupEvent || !((menuPopupEvent.target as any).label)) return;
        const labe = (menuPopupEvent.target as any).label;
        const obj = this.methodMap.get(labe);
        if (obj) {
            const fn = obj.fn;
            const args = [...obj.args];
            args.push(target, menuPopupEvent);
            if (this.judgeAsync(fn)) {
                fn.apply(this, args);
            } else {
                await fn.apply(this, args);
            }
        }

        /* switch ((menuPopupEvent.target as any).label) {
            case `${getString("info-copyImage")}`: this.copyImage(target);
                break;
            case `${getString("info-saveImage")}`: this.saveImage(target);
                break;
            case `${getString("info-editImage")}`: this.editImage(target as HTMLImageElement);
                break;
            //case `${getString("info-convertImage")}`: this.convertImage();
            //break;
            case `${getString("info-ocrImage")}`: await this.ocrImage(target);
                break;
            case `${getString("info-shareImage")}`: this.shareImage();
                break;
            case `${getString("info-sendToPPT")}`: this.sendToPPT();
                break;
            case `${getString("info-printImage")}`: this.printImage(target);
                break;
            case `${getString("info-showFolder")}`: this.showFolder(target);
                break;
            case `${getString("info-showLibraryItem")}`: await this.showLibraryItem(target);
                break;
            case `${getString("info-showArticleLocation")}`: await this.showArticleLocation(target);
                break;
        } */
    }

    batchAddEventListener(args: [element: Element, [eventName: string, callBack: any][]][]) {
        for (const arg of args) {
            for (const paras of arg[1]) {
                arg[0].addEventListener(paras[0], paras[1]);
            }
        }
    }
    /* creatPropsMeun( menuProps: MenuProps) {          
        
        return {
            label: menuProps[0],
            func: menuProps[1] || undefined,
            args: menuProps[2] || undefined,
        };
    }; */

    createContextMenu(menuPropsGroups: MenuProps[][], idPostfix: string) {
        const menupopup = this.makeMenupopup(idPostfix);
        if (menupopup.childElementCount) return menupopup;
        menuPropsGroups.filter((menuPropsGroup: MenuProps[]) => {
            menuPropsGroup.filter((menuProps: MenuProps) => {
                this.methodMap.set(menuProps[0], { fn: menuProps[1], args: menuProps[2] });
                this.makeMenuitem(menuProps[0], menupopup);
            });
            if (menuPropsGroups.indexOf(menuPropsGroup) !== menuPropsGroups.length - 1) {
                this.menuseparator(menupopup);
            }
        }
        );
        return menupopup;
    }

    menuseparator(menupopup: any) {
        ztoolkit.UI.appendElement({
            tag: "menuseparator",
            namespace: "xul",
        }, menupopup);
    };
    makeMenupopup(idPostfix: string) {
        const menupopupOld = document.querySelector(`[id$="${idPostfix}"]`) as XUL.MenuPopup | null;
        if (menupopupOld) return menupopupOld;
        const menupopup = ztoolkit.UI.appendElement({
            tag: "menupopup",
            id: config.addonRef + '-' + idPostfix,
            namespace: "xul",
            children: [],
        }, document.querySelector("#browser")!) as XUL.MenuPopup;

        return menupopup;

    };

    makeMenuitem(
        label: string,
        menupopup: any,
    ) {
        const menuitem = ztoolkit.UI.appendElement({
            tag: "menuitem",
            namespace: "xul",
            attributes: {
                label: label || "undefined",
            }
        }, menupopup);
    };

    judgeAsync(fun: any) {
        const AsyncFunction = (async () => { }).constructor;
        return fun instanceof AsyncFunction;
    };
}