import { showInfo } from "../../utils/tools";
import { getPDFs } from "./pdfUtilities";


export async function getPDF() {



    //await Zotero.PDFWorker.getFullText(this.id)

    //@ts-ignore xxx
    let require = ztoolkit.getGlobal("window").require;
    if (typeof require == "undefined") {
        require = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
            .getService(Components.interfaces.mozIJSSubScriptLoader)
            .loadSubScript("resource://zotero/require.js");
    }

    const URL = require('url').URL;
    const pdfUrl = "resource://zotero/reader/pdf/build/pdf.js";
    const workerSrcUrl = "resource://zotero/reader/pdf/build/pdf.worker.js";
    const pdfjsLib = require(pdfUrl);
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrcUrl;

    const WORKER_URL = 'chrome://zotero/content/xpcom/pdfWorker/worker.js';
    const CMAPS_URL = 'resource://zotero/reader/pdf/web/cmaps/';
    const STANDARD_FONTS_URL = 'resource://zotero/reader/pdf/web/standard_fonts/';
    const RENDERER_URL = 'resource://zotero/pdf-renderer/renderer.html';

    const pdfIDs = getPDFs({ itemsAllPDFs: true });
    /* const items = Zotero.getActiveZoteroPane().getSelectedItems();
    if (!item.isPDFAttachment()) {
        showInfo("请选中一篇 pdf，然后重试");
        return;
    } */

    /* while (pdfIDs?.length) {
        const id = pdfIDs.shift();
        if (!id) break;
        await Zotero.Reader.open(id, undefined, { openInBackground: true });
        const tabID = Zotero_Tabs.getTabIDByItemID(id);
        showInfo(tabID);
        await Zotero.Promise.delay(3000);
        Zotero_Tabs.close(tabID);
    } */


    //itemID, location, { title, tabIndex, tabID, openInBackground, openInWindow, allowDuplicate, secondViewState, preventJumpback } = {}
    const id = pdfIDs!.shift();
    const item = Zotero.Items.get(id!);
    const path = await item.getFilePathAsync();
    //const get = pdfjsLib.getDocument.bind(this);

    try {

        const loadingTask = pdfjsLib.getDocument(path);

        const pdf = await loadingTask.promise;

        const pdfPage = await pdf.getPage(1);

        const textContent = await pdfPage.getTextContent();

        const items = textContent.items;

        showInfo("文本数组长度：" + items.length);
    } catch (e: any) {
        ztoolkit.log(e);
    }


}


