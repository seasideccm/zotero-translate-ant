import { config } from "../../../package.json";
export function openWindow() {
       const url = `chrome://${config.addonRef}/content/test.xhtml`;
       window.openDialog(url, '', 'chrome,centerscreen');

       //const BaiDu_FanYi_KaiFangPingTai = 'https://api.fanyi.baidu.com/manage/developer';
       //const 百度翻译开放平台 = 'https://api.fanyi.baidu.com/manage/developer';
       //ZoteroPane.loadURI('https://fanyi.baidu.com/');

};
export function 百度翻译() {
       //const url = `chrome://${config.addonRef}/content/test.xhtml`;
       //window.openDialog(url, '', 'chrome,centerscreen');

       //const BaiDu_FanYi_KaiFangPingTai = 'https://api.fanyi.baidu.com/manage/developer';
       const 百度翻译开放平台 = 'https://api.fanyi.baidu.com/manage/developer';
       ZoteroPane.loadURI('https://fanyi.baidu.com/');
       //不知道如何选中元素
       Zotero.openInViewer('https://api.fanyi.baidu.com/');

};
export function 腾讯翻译() {
       //const url = `chrome://${config.addonRef}/content/test.xhtml`;
       //window.openDialog(url, '', 'chrome,centerscreen');

       //const BaiDu_FanYi_KaiFangPingTai = 'https://api.fanyi.baidu.com/manage/developer';
       const txfy = 'https://fanyi.qq.com/';
       ZoteroPane.loadURI(txfy);

};

export function openSite() {
       const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
       const txfy = 'https://fanyi.qq.com/';
       Zotero.Utilities.Internal.exec(chromePath, [txfy]);
}
