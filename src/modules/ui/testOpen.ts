import { config } from "../../../package.json";
import { readImage, showInfo } from "../../utils/tools";
export function openWindow() {
  const url = `chrome://${config.addonRef}/content/test.xhtml`;
  window.openDialog(url, "", "chrome,centerscreen");
  百度翻译();

  //const BaiDu_FanYi_KaiFangPingTai = 'https://api.fanyi.baidu.com/manage/developer';
  //const 百度翻译开放平台 = 'https://api.fanyi.baidu.com/manage/developer';
  //ZoteroPane.loadURI('https://fanyi.baidu.com/');
}
export function 百度翻译() {
  //const url = `chrome://${config.addonRef}/content/test.xhtml`;
  //window.openDialog(url, '', 'chrome,centerscreen');

  //const BaiDu_FanYi_KaiFangPingTai = 'https://api.fanyi.baidu.com/manage/developer';
  const 百度翻译开放平台 = "https://api.fanyi.baidu.com/manage/developer";
  ZoteroPane.loadURI("https://fanyi.baidu.com/");
  //不知道如何选中元素
  Zotero.openInViewer("https://api.fanyi.baidu.com/");
}
export function 腾讯翻译() {
  //const url = `chrome://${config.addonRef}/content/test.xhtml`;
  //window.openDialog(url, '', 'chrome,centerscreen');

  //const BaiDu_FanYi_KaiFangPingTai = 'https://api.fanyi.baidu.com/manage/developer';
  const txfy = "https://fanyi.qq.com/";
  ZoteroPane.loadURI(txfy);
}
const firefoxPath = "C:\\Program Files\\Mozilla Firefox\\firefox.exe";
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const tencentfy = "https://fanyi.qq.com/";


export function openSite(browserPath: string, url: string) {
  // 有问题
  Zotero.Utilities.Internal.exec(browserPath, [url]);
}

export function openDir() {
  const path: string = "E:\\随时同步\\2024 北戴河 培训 课件 呼吸机";
  //Zotero.Utilities.Internal.exec("start", [path]);
  Zotero.File.reveal(path);
  const path2 = PathUtils.join(path, "zfCreateTest");
  Zotero.File.createDirectoryIfMissing(path2);
  const gClipboardHelper = Components.classes[
    "@mozilla.org/widget/clipboardhelper;1"
  ].getService(Components.interfaces.nsIClipboardHelper);
  gClipboardHelper.copyString("剪贴板字符串设置。");
}

export function copyImage() {
  const win = ztoolkit.getGlobal("window");
  win.addEventListener("contextmenu", async (e: Event) => {
    const target = e.target as Element;
    if (!["html:img", "img"].includes(target.tagName.toLocaleLowerCase()))
      return;
    let imgSrc = (target as HTMLImageElement).src;
    if (!imgSrc) return;
    if (imgSrc.startsWith("file:///")) {
      const imgPath = imgSrc.replace("file:///", "");
      readImage(imgPath).then((imgData) => {
        imgSrc = imgData?.base64 as string;
        if (!imgSrc.startsWith("data:")) return;
        const clip = new ztoolkit.Clipboard();
        //仅支持添加一张图
        clip.addImage(imgSrc);
        clip.copy();
      });
    }
    if (imgSrc.startsWith("zotero://")) {
      const key = imgSrc.split("/").slice(-2, -1)[0];
      if (!key) return;
      let imgPath = Zotero.Attachments.getStorageDirectoryByLibraryAndKey(
        1,
        key,
      ).path;
      imgPath = PathUtils.join(imgPath, "image.png");
      let imgbyte;
      const imgData = (await readImage(imgPath))?.base64 as string;
      if (!imgData || !imgData?.startsWith("data:")) return;
      const parts = imgData.split(",");
      if (!parts) return;
      const match = parts[0].match(/:(.*?);/);
      const mime = match ? match[1] : "image/png";

      //const clip = new ztoolkit.Clipboard();
      //仅支持添加一张图
      //clip.addImage(imgData);
      //clip.copy();

      const res = await IOUtils.read(imgPath);
      imageToclip(res, mime);
      const result = res;
    }
    if (imgSrc.startsWith("data:")) {
      //const clip = new ztoolkit.Clipboard();
      //仅支持添加一张图
      //clip.addImage(imgSrc);
      //clip.copy();
    }
  });

  function imageToclip(u8arr: Uint8Array, mime: string) {
    const imgTools = Components.classes[
      "@mozilla.org/image/tools;1"
    ].getService(Components.interfaces.imgITools);
    let mimeType;
    let img;
    if (ztoolkit.getGlobal("Zotero").platformMajorVersion >= 102) {
      img = imgTools.decodeImageFromArrayBuffer(u8arr.buffer, mime);
      mimeType = "application/x-moz-nativeimage";
    } else {
      mimeType = `image/png`;
      img = Components.classes[
        "@mozilla.org/supports-interface-pointer;1"
      ].createInstance(Components.interfaces.nsISupportsInterfacePointer);
      img.data = imgTools.decodeImageFromArrayBuffer(u8arr.buffer, mimeType);
    }
    const clipboardService = Components.classes[
      "@mozilla.org/widget/clipboard;1"
    ].getService(Components.interfaces.nsIClipboard);
    const transferable = Components.classes[
      "@mozilla.org/widget/transferable;1"
    ].createInstance(Components.interfaces.nsITransferable);
    transferable.init(null);
    transferable.addDataFlavor(mimeType);
    transferable.setTransferData(mimeType, img, 0);

    const transferable2 = Components.classes[
      "@mozilla.org/widget/transferable;1"
    ].createInstance(Components.interfaces.nsITransferable);
    transferable2.init(null);
    transferable2.addDataFlavor(mimeType);
    transferable2.setTransferData(mimeType, img, 0);
    //transferable.addDataFlavor(mimeType);
    //transferable.setTransferData(mimeType, img, 0);
    clipboardService.setData(
      transferable,
      null,
      Components.interfaces.nsIClipboard.kGlobalClipboard,
    );
    clipboardService.setData(
      transferable2,
      null,
      Components.interfaces.nsIClipboard.kGlobalClipboard,
    );
  }
}
