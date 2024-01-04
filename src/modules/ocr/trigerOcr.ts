import { arrToObj } from "../../utils/tools";
import { makeClickButton } from "../ui/toolbarButton";
import { ocrImage } from "./runOcr";

export function rightClick() {
    window.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        ztoolkit.log("右键点击");
    });
    window.addEventListener("mouseover", function (e) {
        Zotero.Utilities.throttle(trigerByImage, 300)(e);
    });

}

function trigerByImage(e: MouseEvent) {
    const tagName = (e.target as any).tagName;
    //ztoolkit.log("tagName", tagName);
    if (e.target && tagName === 'IMG') {
        let ocrIcon = addon.data.globalState?.ocrIcon;
        if (!ocrIcon) {
            const menuitemGroupArr = [
                [arrToObj(["label", "func", "args"], ["OCR", ocrImage, [tagName.src, undefined]])]
            ];
            ocrIcon = makeClickButton("ocrIcon", menuitemGroupArr);
            addon.data["globalState"] ? addon.data["globalState"].ocrIcon = ocrIcon : addon.data["globalState"] = { ocrIcon: ocrIcon };
        }

        if (ocrIcon.state == "closed") {
            ocrIcon.openPopup(e.target, 'before_end', 0, 0, false, false, e);
            /*  (e.target as HTMLImageElement).addEventListener("mouseout", async function hide(e) {
                 await Zotero.Promise.delay(300);
                 ocrIcon.hidePopup();
                 (e.target as HTMLImageElement).removeEventListener("mouseout", hide);
             }); */
        }
        if (ocrIcon.state == "open") {
            if (ocrIcon.anchorNode !== e.target) {
                ocrIcon.hidePopup();
                ocrIcon.openPopup(e.target, 'before_end', 0, 0, false, false, e);
                /* (e.target as HTMLImageElement).addEventListener("mouseout", async function hide(e) {
                    await Zotero.Promise.delay(300);
                    ocrIcon.hidePopup();
                    (e.target as HTMLImageElement).removeEventListener("mouseout", hide);
                });*/
            }
        }
        //@ts-ignore has screenX
        //imgCtxObj.contextMenu.moveTo(e.screenX, e.screenY);
        ztoolkit.log("发现图片");


    }
}

const getDom = (e: any) => {

    ztoolkit.log(mousePosition(e.nativeEvent));

    const element = document.elementFromPoint(mousePosition(e.nativeEvent).x, mousePosition(e.nativeEvent).y);

    console.log(element);

};

//获取绝对位置

const mousePosition = (ev: any) => {

    let evs;

    if (!ev) evs = window.event;

    if (ev.pageX || ev.pageY) {

        return { x: ev.pageX, y: ev.pageY };

    }

    return {

        x: ev.clientX + document.documentElement.scrollLeft - document.body.clientLeft,

        y: ev.clientY + document.documentElement.scrollTop - document.body.clientTop

    };

}


