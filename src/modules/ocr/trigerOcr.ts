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
    ztoolkit.log("tagName", tagName);
    if (tagName === 'IMG') {

        const menuitemGroupArr = [
            [arrToObj(["label", "func", "args"], ["OCR", ocrImage, [tagName.src, undefined]])]
        ];
        const ocrIcon = makeClickButton("ocrIcon", menuitemGroupArr);
        if (ocrIcon.state == "closed") {

            ocrIcon.openPopupAtScreen(e.screenX, e.screenY, false);
        }
        //@ts-ignore has screenX
        //imgCtxObj.contextMenu.moveTo(e.screenX, e.screenY);
        ztoolkit.log("发现图片");


    }
}


