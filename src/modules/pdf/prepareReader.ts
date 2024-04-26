export async function prepareReader(
  result:
    | "beforReaderInit"
    | "waitForReader"
    | "initializedReader"
    | "initializedPDFView"
    | "initializedPDFViewerApplication"
    | "pdfLoaded"
    | "firstPageLoaded"
    | "pagesLoaded",
) {
  let tabID;
  let n = 0;
  while (!Zotero_Tabs.selectedID && n++ < 50) {
    await Zotero.Promise.delay(50);
  }
  //参数itemID未传递
  //如果页面不是 pdf reader，则打开选中的 pdf 或条目下的首个 pdf
  let itemID;
  if (
    !tabID &&
    Zotero_Tabs._getTab(Zotero_Tabs.selectedID).tab.type === "reader"
  ) {
    //所选标签即为pdf
    tabID = Zotero_Tabs.selectedID;
    itemID = Zotero_Tabs._getTab(tabID).tab.data.itemID;
  } else {
    const item = Zotero.getActiveZoteroPane().getSelectedItems()[0];
    if (item) {
      if (!item.isPDFAttachment()) {
        itemID = item
          .getAttachments()
          .filter((id) => Zotero.Items.get(id).isPDFAttachment())[0];
      } else {
        itemID = item.id;
      }
    }
    //选中的条目没有pdf，查看打开的标签是否有reader，如果有则选择最后激活的reader
    if (!itemID) {
      itemID = getLatestReader();
    }
    /* if (!itemID) {
      fullTextTranslate.showInfo("info-noItemSelectedNoReaderOpened", 3000);
      return;
    } */
  }
  if (itemID) {
    await Zotero.Reader.open(itemID);
    tabID = Zotero_Tabs.getTabIDByItemID(itemID);
  }
  //if (Zotero_Tabs.selectedID == "zotero-pane")

  /* if (!tabID && Zotero_Tabs._getTab(Zotero_Tabs.selectedID).tab.type != 'reader') {
    tabID = getLatestTab(true);
    itemID=Zotero_Tabs._getTab(tabID).tab.data.itemID
    await Zotero.Reader.open(itemID);
  } */
  //if (!tabID) return getObj;

  /*   else {
      //查找pdf标签，找不到则退出      
      const tab = getLatestTab(true);
      //Zotero_Tabs._tabs.find(x => x.type === 'reader');
      if (tab) {
        tabID = tab.id;
      } else {
        const item = Zotero.getActiveZoteroPane().getSelectedItems()[0];
        itemID = item.getAttachments().filter(id => Zotero.Items.get(id).isPDFAttachment())[0];
        await Zotero.Reader.open(itemID);
        tabID = Zotero_Tabs.getTabIDByItemID(itemID);
      }
    } */

  /* if(itemID) {
    //传递了参数itemID，如果 pdf 尚未打开    
    if (!Zotero_Tabs.getTabIDByItemID(itemID)) {
      //判断是否是 pdf ，不是则获取第一个 pdf 的itemID
      if (!Zotero.Items.get(itemID).isPDFAttachment()) {
        const item = Zotero.Items.get(itemID);
        itemID = item.getAttachments().filter(id => Zotero.Items.get(id).isPDFAttachment())[0];
        if (!Zotero_Tabs.getTabIDByItemID(itemID)) {
          //打开 pdf
          await Zotero.Reader.open(itemID);
        }
      }
    }
    tabID = Zotero_Tabs.getTabIDByItemID(itemID);
  } */

  let reader: any;
  n = 0;
  let time;
  if (result == "pagesLoaded") {
    time = 500;
  } else {
    time = 50;
  }
  //Zotero_Tabs.select(tabID as string);
  while (!(reader = Zotero.Reader.getByTabID(tabID as string)) && n < 200) {
    await Zotero.Promise.delay(time);
    if (!reader && ++n % 20 == 0) {
      const sec = ((n * time) / 1000).toFixed(2);
      ztoolkit.log(`prepare reader... ${sec} seconds past.`);
    }
    if (reader) {
      const sec = ((n * time) / 1000).toFixed(2);
      ztoolkit.log(`Spend ${sec} seconds reader loaded.`);
    }
  }

  if (result == "beforReaderInit") {
    return getObj;
  }
  await reader._waitForReader();
  if (result == "waitForReader") {
    return getObj;
  }
  await reader._initPromise;
  if (result == "initializedReader") {
    return getObj;
  }
  const internalReader = reader._internalReader;
  const primaryView = internalReader._primaryView;
  const pdfPages = primaryView._pdfPages;
  await primaryView.initializedPromise;
  if (result == "initializedPDFView") {
    return getObj;
  }
  const PDFViewerApplication = (reader._iframeWindow as any).wrappedJSObject
    .PDFViewerApplication;
  await PDFViewerApplication.initializedPromise;
  const pdfViewer = PDFViewerApplication.pdfViewer;
  if (result == "initializedPDFViewerApplication") {
    return getObj;
  }
  await PDFViewerApplication.pdfLoadingTask.promise;
  const pdfDocument = PDFViewerApplication.pdfDocument;
  const document = (reader._iframeWindow as any).wrappedJSObject.document;
  const pages = pdfViewer._pages;
  if (result == "pdfLoaded") {
    return getObj;
  }
  await PDFViewerApplication.pdfViewer.firstPagePromise;
  if (result == "firstPageLoaded") {
    return getObj;
  }
  await PDFViewerApplication.pdfViewer.pagesPromise;
  if (result == "pagesLoaded") {
    return getObj;
  } else {
    return (e: string) => {};
  }
  function getObj(
    obj:
      | "reader"
      | "internalReader"
      | "primaryView"
      | "PDFViewerApplication"
      | "pdfViewer"
      | "pages"
      | "pdfPages"
      | "pdfDocument"
      | "pdfItemID"
      | "document"
      | "documentPDFView",
  ) {
    switch (obj) {
      case "reader":
        return reader;
      case "internalReader":
        return internalReader;
      case "primaryView":
        return primaryView;
      case "pdfViewer":
        return pdfViewer;
      case "pages":
        return pages;
      case "pdfPages":
        return pdfPages;
      case "pdfDocument":
        return pdfDocument;
      case "PDFViewerApplication":
        return PDFViewerApplication;
      case "pdfItemID":
        return reader._item.id;
      case "document":
        return document;
      case "documentPDFView":
        return primaryView._iframeWindow.document;
      default:
        return reader;
    }
  }
  function getLatestReader() {
    const tabs = Zotero_Tabs._tabs
      .map((x: any) => {
        if (
          (x.type == "reader" || x.type == "reader-unloaded") &&
          Zotero.Items.exists(x.data.itemID)
        ) {
          return x;
        }
      })
      .filter((e) => e);
    if (!tabs.length) return;
    if (tabs.length == 1) return tabs[0].data.itemID;
    return tabs.sort((a, b) => a.timeUnselected - b.timeUnselected).slice(-1)[0]
      .data.itemID;
    /* return Zotero_Tabs._tabs
      .map((x: any) => {
        if ((x.type == 'reader' || x.type == 'reader-unloaded')
          && Zotero.Items.exists(x.data.itemID)) {
          return x;
        }
      })
      .filter(e => e)
      .sort((a, b) => a.timeUnselected - b.timeUnselected)
      .slice(-1)[0].data.itemID; */
  }
  function getLatestTab(onlyReaderTab?: boolean) {
    let condition: any;
    onlyReaderTab
      ? (condition = (x: any) =>
          x.type == "reader" || x.type == "reader-unloaded")
      : 1;
    return Zotero_Tabs._tabs
      .map((x: any) => {
        if (condition() && Zotero.Items.exists(x.data.itemID)) {
          return x;
        }
      })
      .filter((e) => e)
      .sort((a, b) => a.timeUnselected - b.timeUnselected)
      .slice(-1)[0];
  }
  //Zotero.Session.state.windows.map((x: any) => { if (x.type == 'reader' && Zotero.Items.exists(x.itemID)) { return x.itemID; } });
}
