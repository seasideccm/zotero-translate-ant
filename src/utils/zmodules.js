/* import ReactDOM = require("react-dom");
import { IntlProvider } from "react-intl";
Components.utils.import("resource://gre/modules/osfile.jsm");
import FilePicker = require('zotero/modules/filePicker').default; */

Components.utils.import("resource://zotero/config.js"); //成功
//const createElement = Components.utils.import("resource://zotero/react-dom.js").createElement;//失败
//const { HiddenBrowser } = ChromeUtils.import('chrome://zotero/content/HiddenBrowser.jsm');//失败
//Components.utils.import("resource://zotero/react.js");//失败
//Components.utils.import("resource://zotero/react-intl.js");//失败

const CollectionTree = require("zotero/collectionTree");
var collectionsTree = document.getElementById("zotero-collections-tree");
/* let React;
失败
try {
    React = require("react");
}
catch (e) {
    ztoolkit.log(e);
} */
//@ts-ignore has
const getInfo = ZOTERO_CONFIG.DOMAIN_NAME;
function zmodules() {
  Zotero.debug(collectionsTree.id);
  Zotero.debug("collectionsTree.id");
}
