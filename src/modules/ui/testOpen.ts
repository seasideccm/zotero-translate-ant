import { config } from "../../../package.json";
export function openWindow() {
       window.openDialog('chrome://${config.addonRef}/content/test.xhtml', '', 'chrome,centerscreen');
};


{
       window.openDialog('chrome://zotero/content/about.xhtml', 'about', 'chrome,centerscreen');
}
D: \devZnote\zotero - batch - translate\build\addon\chrome\content\test.xhtml;
/D:/devZnote / zotero - batch - translate / build / addon / chrome / content / test.xhtm;