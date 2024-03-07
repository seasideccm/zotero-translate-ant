import { franc } from "franc-min";
import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
import { getPref } from "../../utils/prefs";
import { showInfo } from "../../utils/tools";
import { pdf2document } from "../pdf/pdfFullText";






function getCollections() {
    const zp = Zotero.getActiveZoteroPane();
    const cs = zp.getSelectedCollection();
    if (!cs) return;
    return doRecursive([cs]);
    function doRecursive(cs: Zotero.Collection[]): Zotero.Collection[] {
        const ccs = [];
        for (const c of cs) {
            if (!c.hasChildCollections) continue;
            ccs.push(...c.getChildCollections());
        }
        if (!ccs.length) return cs;
        return doRecursive(ccs).concat(cs);
    }
}

function getItemsAllPDFs(items: Zotero.Item[]) {
    const pdfIDs: number[] = [];
    for (let item of items) {
        //如果是常规条目，不做处理
        //如果是子条目，获取其父条目，即常规条目
        //如果是无父条目的pdf，直接获取其id
        if (!item.isRegularItem() && item.parentItem) {
            item = item.parentItem;
        } else if (!item.isRegularItem() && item.isPDFAttachment() && !item.parentItem) {
            pdfIDs.push(item.id);
            continue;
        }
        //通过常规条目获取子条目，筛选出 pdf，然后获取其id
        const attachmentIDs = item.getAttachments();
        for (const id of attachmentIDs) {
            //筛选pdf
            if (Zotero.Items.get(id).isPDFAttachment()) {
                pdfIDs.push(id);
            }
        }
    }
    return [...new Set(pdfIDs)];
}



export class Translator {

    constructor() {

    }
    /**
     * 
     * @param pdfItem 
     * @param isSavePDTtoNote 
     * @returns 
     */
    async getPdfContent(pdfItem: Zotero.Item) {
        if (!pdfItem.isPDFAttachment()) {
            showInfo(getString("info-notPdf"));
            return;
        }
        return await pdf2document(pdfItem.id);
    }


    async pdfs2Notes(pdfIDs?: number[]) {
        if (!pdfIDs) pdfIDs = this.getPDFs() || [];
        const notes = [];
        for (const id of pdfIDs) {
            const note = await this.pdf2Note(id);
            if (!note) continue;
            notes.push(note);
        }
        return notes;
    }

    async pdf2Note(pdfID: number) {
        const item = Zotero.Items.get(pdfID);
        if (!item) return;
        const noteTxt = await this.getPdfContent(item);
        if (!noteTxt) return;
        const note = new Zotero.Item('note');
        note.libraryID = item.libraryID;
        const zp = Zotero.getActiveZoteroPane();
        if (item.parentKey) {
            note.parentKey = item.parentKey;
        }
        else if (item.getCollections().length) {
            note.addToCollection(zp.collectionsView.selectedTreeRow.ref.id);
        } else {
            //新建独立笔记
        }
        note.setNote(noteTxt);
        await note.saveTx();
        return note;
    }

    getPdfID() {
        return Zotero_Tabs._tabs.filter(e => e.id == Zotero_Tabs.selectedID)[0].data.itemID || Zotero.getActiveZoteroPane().getSelectedItems()[0].id;
    }
    /**
     * 1 从选中条目中筛选出所有 pdf 文件的 id
     * 2 
     * @returns 
     */
    getPDFs() {
        const itemsAllPDFs = false;
        const onlySelectedPDFs = false;
        const collectionSelected = true;
        const collectionSelectedWithChilds = true;


        const zp = Zotero.getActiveZoteroPane();
        const items = zp.getSelectedItems() || [];
        const itemsSelected: number[] = [];
        if (onlySelectedPDFs) {
            itemsSelected.push(...items.filter(item => item.isPDFAttachment()).map(item => item.id));
        } else if (itemsAllPDFs) {
            itemsSelected.push(...getItemsAllPDFs(items));
        } else {
            const cAll = [];
            if (collectionSelected) {
                const zp = Zotero.getActiveZoteroPane();
                const cs = zp.getSelectedCollection();
                if (!cs) return;
                cAll.push(cs);

            } else if (collectionSelectedWithChilds) {
                const ccs = getCollections();
                if (!ccs) return;
                cAll.push(...ccs);
            }
            const items = [];
            for (const c of cAll) {
                items.push(...c.getChildItems());
            }
            itemsSelected.push(...getItemsAllPDFs(items));

        }
        return itemsSelected;


    }
    async translatePDFs() {
        const pdfIDs = this.getPDFs() || [];
        for (const id of pdfIDs) {
            //this.contentPrepare(id);
        }
    }



}



export async function translate(option: any) {
    //笔记

    const translator = new Translator();
    try {
        // translator.doTranslate(option);
    } catch (e: any) {
        showInfo(e.message);
        throw e;
    }
    const OptionsPDFTranslate: OptionsPDFTranslate = {
        service: "baidu",
        pluginID: config.addonID,
        langfrom: "en",
        langto: "zh"
    };
    // const result = await Zotero.PDFTranslate.api.translate(rowText, OptionsPDFTranslate);
    //showInfo(result.result);
}

