import { getString } from "../../utils/locale";
import { showInfo } from "../../utils/tools";
import { pdf2document } from "./pdfFullText";

/**
 *
 * @param pdfItem
 * @param isSavePDTtoNote
 * @returns
 */
async function getPdfContent(pdfItem: Zotero.Item) {
  if (!pdfItem.isPDFAttachment()) {
    showInfo(getString("info-notPdf"));
    return;
  }
  return await pdf2document(pdfItem.id);
}

async function pdfs2Notes(pdfIDs?: number[]) {
  if (!pdfIDs) pdfIDs = getPDFs() || [];
  const notes = [];
  for (const id of pdfIDs) {
    const note = await pdf2Note(id);
    if (!note) continue;
    notes.push(note);
  }
  return notes;
}

async function pdf2Note(pdfID: number) {
  const item = Zotero.Items.get(pdfID);
  if (!item) return;
  const noteTxt = await getPdfContent(item);
  if (!noteTxt) return;
  const note = new Zotero.Item("note");
  note.libraryID = item.libraryID;
  const zp = Zotero.getActiveZoteroPane();
  if (item.parentKey) {
    note.parentKey = item.parentKey;
  } else if (item.getCollections().length) {
    //@ts-ignore xxx
    note.addToCollection(zp.collectionsView.selectedTreeRow.ref.id);
  } else {
    //新建独立笔记
  }
  note.setNote(noteTxt);
  await note.saveTx();
  return note;
}

function getPdfID() {
  return (
    Zotero_Tabs._tabs.filter((e) => e.id == Zotero_Tabs.selectedID)[0].data
      .itemID || Zotero.getActiveZoteroPane().getSelectedItems()[0].id
  );
}

/**
 * - 仅获取选中的 PDF(默认)
 * - 获取所有选中条目的所有 PDF
 * - 仅获取所选分类下的条目的所有 PDF，不含子分类
 * - 获取所选分类及所有子分类（允许嵌套）下的条目的所有 PDF
 * @param options
 * @returns
 */
function getPDFs(options?: {
  itemsAllPDFs?: boolean;
  onlySelectedPDFs?: boolean;
  collectionSelected?: boolean;
  collectionSelectedWithChilds?: boolean;
}) {
  const {
    itemsAllPDFs,
    onlySelectedPDFs,
    collectionSelected,
    collectionSelectedWithChilds,
  } = options || { onlySelectedPDFs: true };
  const zp = Zotero.getActiveZoteroPane();
  const items = zp.getSelectedItems() || [];
  const itemsSelected: number[] = [];
  if (onlySelectedPDFs) {
    //仅获取选中的 PDF
    itemsSelected.push(
      ...items.filter((item) => item.isPDFAttachment()).map((item) => item.id),
    );
  } else if (itemsAllPDFs) {
    //获取所有选中条目的所有 PDF
    itemsSelected.push(...getItemsAllPDFs(items));
  } else {
    const cAll = [];
    if (collectionSelected) {
      //仅获取所选分类下的条目，不含子分类
      const zp = Zotero.getActiveZoteroPane();
      const cs = zp.getSelectedCollection();
      if (!cs) return;
      cAll.push(cs);
    } else if (collectionSelectedWithChilds) {
      //获取所选分类及所有子分类（允许嵌套）下的条目
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
    } else if (
      !item.isRegularItem() &&
      item.isPDFAttachment() &&
      !item.parentItem
    ) {
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
