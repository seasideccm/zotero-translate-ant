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

export function openSite() {
  const chromePath =
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const txfy = "https://fanyi.qq.com/";
  Zotero.Utilities.Internal.exec(chromePath, [txfy]);
}


export function openDir() {
  const path: string = "E:\\随时同步\\2024 北戴河 培训 课件 呼吸机";
  //Zotero.Utilities.Internal.exec("start", [path]);
  Zotero.File.reveal(path);
  const path2 = PathUtils.join(path, "zfCreateTest");
  Zotero.File.createDirectoryIfMissing(path2);
  const gClipboardHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
    .getService(Components.interfaces.nsIClipboardHelper);
  gClipboardHelper.copyString("剪贴板字符串设置。");
}

export function copyImage() {
  const win = ztoolkit.getGlobal("window");
  win.addEventListener("contextmenu", async (e: Event) => {
    const target = e.target as Element;
    if (!["html:img", "img"].includes(target.tagName.toLocaleLowerCase())) return;
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
      let imgPath = Zotero.Attachments.getStorageDirectoryByLibraryAndKey(1, key).path;
      imgPath = PathUtils.join(imgPath, "image.png");
      let imgbyte;
      const imgData = (await readImage(imgPath))?.base64 as string;
      if (!imgData?.startsWith("data:")) return;
      const clip = new ztoolkit.Clipboard();
      //仅支持添加一张图
      //clip.addImage(imgData);
      //clip.copy();



      const res = await IOUtils.read(imgPath);
      const result = res;

    }
    if (imgSrc.startsWith("data:")) {
      const clip = new ztoolkit.Clipboard();
      //仅支持添加一张图
      clip.addImage(imgSrc);
      clip.copy();
    }



  });

  function imageToclip(u8arr: Uint8Array, mime: string) {
    const imgTools = Components.classes["@mozilla.org/image/tools;1"].getService(Components.interfaces.imgITools);
    let mimeType;
    let img;
    if (ztoolkit.getGlobal("Zotero").platformMajorVersion >= 102) {
      img = imgTools.decodeImageFromArrayBuffer(u8arr.buffer, mime);
      mimeType = "application/x-moz-nativeimage";
    }
    else {
      mimeType = `image/png`;
      img = Components.classes["@mozilla.org/supports-interface-pointer;1"].createInstance(Components.interfaces.nsISupportsInterfacePointer);
      img.data = imgTools.decodeImageFromArrayBuffer(u8arr.buffer, mimeType);
    }
    const transferable = Components.classes["@mozilla.org/widget/transferable;1"].createInstance(Components.interfaces.nsITransferable);
    transferable.addDataFlavor(mimeType);
    transferable.setTransferData(mimeType, img, 0);
  }
}


