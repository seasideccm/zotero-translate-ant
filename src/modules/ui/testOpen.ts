import { config } from "../../../package.json";
export function openWindow() {
       const url = `chrome://${config.addonRef}/content/test.xhtml`;
       window.openDialog(url, '', 'chrome,centerscreen');

       const BaiDu_FanYi_KaiFangPingTai = 'https://api.fanyi.baidu.com/manage/developer';
       const 百度翻译开放平台 = 'https://api.fanyi.baidu.com/manage/developer';
       ZoteroPane.loadURI(百度翻译开放平台);

};
