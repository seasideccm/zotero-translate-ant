import { ocrImage } from "./runOcr";
import { config } from "../../../package.json";
import { ocrIconSvg } from "../../utils/const";
import { makeTagElementProps } from "../ui/uiTools";



export function listenImageCallback(e: MouseEvent) {
    Zotero.Utilities.throttle(trigerByImage, 300)(e);
}

function trigerByImage(e: MouseEvent) {
    const tagName = (e.target as any).tagName;
    if (e.target && tagName === 'IMG') {
        const container = (e.target as HTMLElement).parentNode! as HTMLElement;
        container.style.display = "flex";
        container.style.position = "relative";
        const src = (e.target as HTMLImageElement).src;
        const ocrIconProps = makeTagElementProps({
            tag: "img",
            id: `${config.addonRef}-ocrIcon`,
            namespace: "html",
            styles: {
                width: `${20 + 8}px`,
                height: "20px",
            },
            attributes: {
                src: ocrIconSvg,
                alt: "",
            },
        });
        const ocrIcon = ztoolkit.UI.appendElement(
            makeTagElementProps({
                tag: "div",
                id: `${config.addonRef}-ocrIconBox`,
                namespace: "html",
                ignoreIfExists: false,
                styles: {
                    zIndex: "255",
                    display: "folat",
                    position: "absolute",
                    right: "0px",
                    top: "0px",

                },
                children: [ocrIconProps],
                listeners: [
                    {
                        type: "click",
                        listener: function fn() {
                            if (src) {
                                ocrImage(src);
                            }
                        },
                    },
                ],
            }), container);
    }
}

