//@ts-ignore xxx
let require = ztoolkit.getGlobal("window").require;
if (typeof require == "undefined") {
    require = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
        .getService(Components.interfaces.mozIJSSubScriptLoader)
        .loadSubScript("resource://zotero/require.js");
}

const pdfUrl = "resource://zotero/reader/pdf/build/pdf.js";
const workerSrcUrl = "resource://zotero/reader/pdf/build/pdf.worker.js";
const pdfjsLib = require(pdfUrl);
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrcUrl;

const WORKER_URL = 'chrome://zotero/content/xpcom/pdfWorker/worker.js';
const CMAPS_URL = 'resource://zotero/reader/pdf/web/cmaps/';
const STANDARD_FONTS_URL = 'resource://zotero/reader/pdf/web/standard_fonts/';
const RENDERER_URL = 'resource://zotero/pdf-renderer/renderer.html';

