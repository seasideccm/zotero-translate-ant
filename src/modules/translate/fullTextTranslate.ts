import { config } from "../../../package.json";
import { getPref } from "../../utils/prefs";
import { getString } from "../../utils/locale";
import { frequency, pdf2document } from "../pdf/pdfFullText";
import { deleteCacheOrFile, readJsonFromDisk, saveJsonToDisk, showInfo, timer } from "../../utils/tools";
import {
  getAvilabelService,
  getLang,
  getSingleServiceUnderUse,
  serviceManage,
} from "./serviceManage";

import { html2md, md2html } from "../../utils/mdHtmlConvert";
import { getCharasLimit, getServices } from "./translateServices";
import {
  langCodeNameSpeakers,
  langCode_francVsZotero,
} from "../../utils/constant";
import { franc } from "franc-min";
import { translateFunc } from "./translate";
import { TranslateService, TranslateServiceAccount } from "./translateService";
import { setCurrentService } from "../addonSetting";
import { getDB } from "../database/database";
import { showTargeCombine } from "../ui/dataDialog";
import { json } from "stream/consumers";



const charConsumRecoder = 0;

/* export async function onOpenPdf(id: number) {
  await Zotero.Reader.open(id);
  ztoolkit.log("open pdf");
} */
export class fullTextTranslate {
  /**
   *
   * @param pdfItem
   * @param isSavePDTtoNote
   * @returns
   */
  static async getPdfContent(pdfItem: Zotero.Item, isSavePDTtoNote?: boolean) {
    if (!pdfItem.isPDFAttachment()) {
      showInfo(getString("info-notPdf"));
      return;
    }
    const doc = await pdf2document(pdfItem.id);
    if (!doc) {
      return;
    }
    const noteTxt = doc;
    //保存笔记
    if (isSavePDTtoNote) {
      const note = new Zotero.Item("note");
      note.libraryID = pdfItem.libraryID;
      const zp = Zotero.getActiveZoteroPane();

      if (pdfItem.parentKey) {
        note.parentKey = pdfItem.parentKey;
      } else if (pdfItem.getCollections().length) {
        if (zp.collectionsView)
          note.addToCollection(zp.collectionsView.selectedTreeRow.ref.id);
      }

      note.setNote(noteTxt);
      await note.saveTx();
    }
    return noteTxt;
  }

  /**
   *
   * @returns
   */
  static getPDFs() {
    const items = Zotero.getActiveZoteroPane().getSelectedItems();
    if (!items.length) {
      return [];
    }
    let pdfIDs: number[] = [];

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
    pdfIDs = [...new Set(pdfIDs)];
    return pdfIDs;
  }
  static async translatePDFs() {
    const pdfIDs = this.getPDFs();
    for (const id of pdfIDs) {
      this.contentPrepare(id);
    }
  }

  static async pdf2Note() {
    const pdfIDs = this.getPDFs();
    for (const id of pdfIDs) {
      const item = Zotero.Items.get(id);
      await this.getPdfContent(item, true);
    }
  }

  static async onePdf2Note() {
    const reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
    if (!reader) {
      return;
    }
    const item = reader._item;
    await this.getPdfContent(item, true);
  }

  static async translateOnePdf() {
    const reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
    if (!reader) return;
    const itemID = reader._item.id;
    const contentObj = await fullTextTranslate.contentPrepare(itemID);
    if (!contentObj) return;
    const docItem = await fullTextTranslate.translateDoc(contentObj);
    if (!docItem) return;
    await fullTextTranslate.makeTranslation(docItem);

  }

  /**
   * 更新引擎账号的字符消耗量
   * @param characters
   * @param service
   * @returns
   */
  static async updateCharConsum(
    characters: number,
    account: TranslateServiceAccount | TranslateService,
  ) {
    if (!account.charConsum) {
      account.charConsum = characters;
    } else {
      account.charConsum += characters;
    }
    if (!account.changedData) {
      account.changedData = {};
    }
    account.changedData.charConsum = account.charConsum;
    await account.saveChange();
  }

  /**
   *
   */
  static getTxtCallback() {
    new ztoolkit.ProgressWindow(config.addonName)
      .createLine({
        text: "getTxt",
        type: "default",
      })
      .show();
    const noteIDs = fullTextTranslate.getNoteIDs();
    window.alert("成功获取笔记ID" + noteIDs);
  }

  static async getNoteIDs(itemIDs?: number[] | number) {
    let items;
    if (!itemIDs) {
      items = Zotero.getActiveZoteroPane().getSelectedItems();
    } else {
      if (typeof itemIDs == "number") {
        itemIDs = [itemIDs];
      }
      items = await Zotero.Items.getAsync(itemIDs);
    }

    if (!items.length) {
      return [];
    }
    let noteIDs: number[] = [];
    for (const item of items) {
      if (item.isNote()) {
        noteIDs.push(item.id);
      }
      if (item.isRegularItem()) {
        //拼接笔记ID数组
        noteIDs = noteIDs.concat(item.getNotes());
      }
      // 独立笔记
      else if (item.isNote() && !item.parentItem) {
        noteIDs.push(item.id);
      }
      // 条目的子项(子笔记, pdf 等)
      else if (!item.isNote()) {
        const parentItem = item.parentItem!;
        noteIDs = noteIDs.concat(parentItem.getNotes());
      }
    }
    noteIDs = [...new Set(noteIDs)];
    return noteIDs;
  }

  /**
   * 语种识别
   * @param sourceText
   * @returns
   */
  static async languageIdentify(sourceText: string) {
    //todo 指定排除的语言
    sourceText = Zotero.Utilities.unescapeHTML(sourceText);
    const isSkipLocal = getPref("isSkipLocal");
    let untranslatedLanguage =
      (getPref("untranslatedLanguage") as string) || "";
    if (isSkipLocal) {
      untranslatedLanguage += Zotero.locale as string;
    }

    const arr = sourceText.split("\n");
    const plainText = arr.slice(0, arr.length > 15 ? 15 : arr.length);
    const languageArr = [];
    const langRecognize: string[] = [];
    let langCodeNameSpeakersString = getString("info-francRecognize");
    for (const text of plainText) {
      //franc库识别语种，注意有识别错误的情况
      const francLang: string = franc(text);
      if (francLang !== undefined && francLang != "" && francLang !== "und") {
        //三码到两码未定义的语言被忽略
        const lang =
          langCode_francVsZotero[
          francLang as keyof typeof langCode_francVsZotero
          ];
        const langCodeNameSpeakersObj =
          langCodeNameSpeakers[
          francLang as keyof typeof langCode_francVsZotero
          ];
        if (lang !== undefined && lang != "") {
          languageArr.push(lang);
        }
        langRecognize.push(francLang);
      }
    }
    if (langRecognize.length) {
      //[...new Set(langRecognize)]
      frequency(langRecognize).itemOrderByFrequency.filter((e) => {
        langCodeNameSpeakersString =
          langCodeNameSpeakersString +
          ("\n" +
            e +
            "=" +
            langCodeNameSpeakers[e as keyof typeof langCode_francVsZotero]
              .name +
            ", speakers=" +
            langCodeNameSpeakers[e as keyof typeof langCode_francVsZotero]
              .speakers +
            ";\n");
      });
    }
    //对元素合并计数
    const languageObj = languageArr.reduce(
      (acc: { [key: string]: number; }, el) => {
        acc[el] = acc[el] + 1 || 1;
        return acc;
      },
      {},
    );
    //多键值对象转换为一键一值的对象数组
    const languageObjArr = Object.keys(languageObj).map((key: string) => ({
      [key]: languageObj[key],
    }));
    //对对象数组按降序排序
    languageObjArr.sort((a, b) => b[Object.keys(b)[0]] - a[Object.keys(a)[0]]);
    const langArr = [];
    for (const lang of languageObjArr) {
      for (const langKey in lang) {
        langArr.push(langKey);
      }
    }

    showInfo(
      langCodeNameSpeakersString +
      "\n\n" +
      "三码到两码未定义的语言被忽略，然后保留识别次数最多的前两种语言",
    );
    if (langArr.length > 2) {
      langArr.splice(2);
    }
    let isTran;
    const forbiddenLang = langArr.filter((item) =>
      untranslatedLanguage.includes(item),
    );
    if (!forbiddenLang.length) {
      isTran = true;
      /* noteTodoIDs.push(aNOteID); */
    } else {
      isTran = false;
      showInfo(
        getString("info-filteredByLanguageForbidden") +
        ": " +
        forbiddenLang.toString(),
      );
    }
    /*     }
      } */
    const fullTextTranslateInfoTxt = langArr.toString();
    showInfo(fullTextTranslateInfoTxt);
    return isTran;
  }

  /**
   *
   * @param mdtxt
   * @returns
   */
  static cleanMd(mdtxt: string) {
    /* eslint-disable no-useless-escape */
    //删除markdown转义“\”
    //const reg0 = /\\([.\[\]~\(\)>*\\\-`{}_!#+&])/gi;
    // 处理引文序号
    //const reg111 = /<a[^>]*>(?!-) *([\[\d\]\-\(\), ]*) *<\/a>/gi;
    //mdtxt = mdtxt.replace(reg0, '$1').replace(reg111, '[$1]');
    // 处理其他 a 标签
    const reg1 = /<a[^>]*>([^>]?.*?)<\/a>/gi;
    const reg2 = /\xA0/g;
    const reg3 = /(^(?!!\[).+?)[\[\(]+https.+?[\]\)]+/gim;
    const reg4 = /(<span[^>]*>)+(.+?)(<\/span>)+/gi;
    const reg41 = /\*\*([^\*\n]+)\*\*/g;
    const reg5 = /\]\]([, ]*)\[\[/g;
    const reg6 = /^(\W*Download\W*)+$\n?/gim;
    const reg7 = /\[\[/g;
    const reg8 = /\]\]/g;
    const reg9 = /\]\)([, ]*)\(\[/g;
    const reg10 = /\)\]([, ]*)\[\(/g;
    const reg11 = /\)\)([, ]*)\(\(/g;
    const reg12 = /\(\[/g;
    const reg13 = /\]\)/g;
    const reg14 = /\[\(/g;
    const reg15 = /\)\]/g;
    const reg16 = /\(\(/g;
    const reg17 = /\)\)/g;
    const reg18 = /<span[^>]*><\/span>/gi;
    const reg19 = /(\[[^\[\]]+?\])\([^()]+?\)/g;
    const reg22 = /^\W*Full size image\W*$\n?/gim;
    //强调短语合并到下一行
    //var reg19 = /(\*\*$)\n+/gim
    //			 .replace(reg19,'$1 ')
    const reg20 = /\n{2,}/g;
    const reg21 = /^#+ *$/gm;

    mdtxt = mdtxt
      .replace(reg1, "[$1]")
      .replace(reg2, " ")
      .replace(reg3, "$1")
      .replace(reg4, "$2")
      .replace(reg41, "$1")
      .replace(reg5, ",")
      .replace(reg6, "")
      .replace(reg22, "")
      .replace(reg7, "[")
      .replace(reg8, "]")
      .replace(reg9, ",")
      .replace(reg10, ",")
      .replace(reg11, ",")
      .replace(reg12, "[")
      .replace(reg13, "]")
      .replace(reg14, "[")
      .replace(reg15, "]")
      .replace(reg16, "[")
      .replace(reg17, "]")
      .replace(reg18, "")
      .replace(reg19, "$1")
      .replace(reg20, "\n")
      .replace(reg21, "");
    return mdtxt;
  }

  /**
   *
   * @returns
   */
  static async translateFT(type: "note" | "pdf") {
    let ids: number[] = [];
    if (type == "pdf") {
      ids = this.getPDFs();
    } else if (type == "note") {
      ids = await fullTextTranslate.getNoteIDs();
    }

    if (!ids?.length) {
      return;
    }

    const cacheError = await readJsonFromDisk("translatedCache");
    const splitOK = await readJsonFromDisk("translatedCache-splitOK");
    const splitError = await readJsonFromDisk("translatedCache-splitError");
    if (cacheError || splitOK || splitError) {
      const docItemCache = cacheError?.docItem || splitOK?.docItem || splitError?.docItem as DocItem;
      const itemID = docItemCache.itemID;
      if (ids.includes(itemID)) {

        const docItem = await fullTextTranslate.translateDoc(docItemCache);
        if (docItem) {
          const res = await fullTextTranslate.makeTranslation(docItem);
          if (res) {
            ids.splice(ids.indexOf(itemID), 1);
            for (const type of ["translatedCache", "translatedCache-splitError", "translatedCache-splitOK"]) {
              await deleteCacheOrFile(type);
            }


          }
        }
      }
    }


    for (const id of ids) {
      const contentObj = await fullTextTranslate.contentPrepare(id);
      if (!contentObj) {
        continue;
      }
      const start = timer();
      const docItem = await fullTextTranslate.translateDoc(contentObj);
      if (!docItem) return;
      const time = start();
      showInfo(
        getString("info-translationTIme") +
        (time / 1000).toString() +
        " seconds",
      );
      await fullTextTranslate.makeTranslation(docItem);
    }
    await serviceManage.allkeyUsableCheck();
  }

  /**
   * split zotero note by paragraph or table or img
   * @param sourceTxt
   * @param emptyLine  whether to preserve empty lines
   * @returns
   */
  static splitContent = (sourceTxt: string, emptyLine: boolean) => {
    let regex;
    if (emptyLine) {
      //(<([^<>]+?>)<\/\2)用于分割空行会导致\2也起到了分割的作用
      //正则表达式标志gs可以运行，但在zotero run JavaScript中不能有s，估计其支持不完整
      //改为/(<[^<>]+?><\/[^<>]+>\n)/ 后出错 "</strong></p>\n"
      //(<([^<>]+?>)<\/\2),然后过滤掉 p> h>，需要写在正则表达式后面，否则元素可能未定义

      regex =
        /(<([^<>]+?>)<\/\2\n)|(<table>.+?<\/table>\n?)|(<ol>.+?<\/ol>\n?)|(<ul>.+?<\/ul>\n?)|(<p><img.+?<\/p>\n?)|(^<p><span class="highlight" data-annotation="[^>]+?>“.+?”<\/span> <span class="citation" data-citation=".+?<\/span>\)<\/span><\/p>\n?)|(^<[^<>]+?>“.+” ?<span class="citation" data-citation=".+?<\/span>\)<\/span><\/[^><]+?>\n?)/gms;
    } else {
      regex =
        /(^<table>.+?<\/table>\n?)|(<ol>.+?<\/ol>\n?)|(<ul>.+?<\/ul>\n?)|(^<p><img.+?<\/p>\n?)|(^<p><span class="highlight" data-annotation="[^>]+?>“.+?”<\/span> <span class="citation" data-citation=".+?<\/span>\)<\/span><\/p>\n?)/gms;
    }
    const splitArr = sourceTxt.split(regex);
    const filteredArr = splitArr.filter(
      (item) =>
        item !== undefined && item !== "" && item.match(/^[a-z]>$/g) === null,
    );
    return filteredArr;
  };

  /**
   * split table or image at the end of the article
   * @param sourceTxt
   * @returns
   */
  static splitContentEnd = (sourceTxt: string) => {
    const regex = /(<table>.+?<\/table>\n?)|(<p><img.+?<\/p>\n?)/gs;
    const splitArr = sourceTxt.split(regex);
    const filteredArr = splitArr.filter(
      (item) => item !== undefined && item !== "",
    );
    return filteredArr;
  };

  /**
   * 整句拆分
   * 如果未经判断的字串传入，且小于字符限制，则以数组的形式返回
   * @param sourceTxt
   * @param charasPerTime
   * @returns
   */
  static wholeSentenceSplit(sourceTxt: string, charasPerTime: number) {
    /* eslint-disable no-useless-escape */
    const regexTxt = `\}\(?<!^\[A-Z\]\)\(?<! \[A-Z\]\)\(?<!e\\\.g\)\(?<![Nn]o\)\(?<!i\\\.e\)\(?<![Ff]\(ig|igure\)\)\(?<!\([Tt]able \\\d+\)\)\(?<!\\\d+\)`;
    const regexTxt2 = `\[\.!?\]\(?![A-Za-z,]+\)\(\["”\]?\)\(\[\\\[\\\(\\\d\]\{0,3\}\[\\\d\]*\[\\\d\\\-,\\\[\\\]\]*\[\\\]\\\)\\\d\]{0,3}\)* ?`;

    // consider characters count after a period "."
    const charaLength = charasPerTime - 20;
    if (sourceTxt.length <= charaLength) {
      return [sourceTxt];
    }
    //烧脑正则表达式，只有通过new RegExp 构建regex，才能利用变量达到长度为动态的要求
    const regex = new RegExp(
      "(" + ".{1," + charaLength + regexTxt + regexTxt2 + ")",
      "gm",
    );
    const splitArr = sourceTxt.split(regex);
    let filteredArr = splitArr.filter(
      (item) => item !== undefined && item !== "" && item !== "\n",
    );
    //分割失败怎么办？
    if (filteredArr.length == 0) {
      const regex2 = /(.+?[.:?!'"] (?=[A-z]))/g;
      const splitArr1 = sourceTxt.split(regex2);
      const filteredArr1 = splitArr1.filter(
        (item) => item !== undefined && item !== "",
      );
      filteredArr = fullTextTranslate.combineByLimit(
        filteredArr1,
        charasPerTime,
      );
    }
    return filteredArr;
  }

  /**
   * 数组元素中不能有"\n"
   * 传入数组，合并成符合字数限制的数组，原有数组字符串末尾加 '\n'
   * 最终返回字符串数组，有"\n"的字符串是合并过的
   * @param filteredArr
   * @param charasPerTime
   * @returns
   */
  static combineByLimit(filteredArr: string[], charasPerTime: number) {
    const resultArr = [];
    let tempStr = "";
    for (let i = 0; i < filteredArr.length; i++) {
      if (tempStr.length + filteredArr[i].length <= charasPerTime) {
        tempStr = tempStr + filteredArr[i] + "\n";
      } else {
        resultArr.push(tempStr.replace(/\n$/, ""));
        tempStr = filteredArr[i] + "\n";
      }
      if (i === filteredArr.length - 1) {
        resultArr.push(tempStr);
      }
    }
    return resultArr;
  }

  /**
   *
   * @param sourceArr
   * @param charasPerTime
   * @returns
   */
  static combineByLimitOneRequest(
    leftArr: string[],
    charasPerTime: number,
  ) {

    const length = 0;
    const tempArr = [];
    const sourceArr = leftArr.map((e) => e);
    for (let i = 0; i < sourceArr.length; i++) {
      if (length + sourceArr[i].length < charasPerTime) {
        tempArr.push(sourceArr[i]);
        leftArr.shift();//传入函数内，并不断变化，函数外也会改变
      } else {
        return {
          str: tempArr.join("\n"),
          arr: tempArr,
          leftArr: leftArr,
        };
      }
    }
    return {
      str: tempArr.join("\n"),
      arr: tempArr,
      leftArr: leftArr,
    };
  }

  /**
   *
   * @param noteID
   * @returns
   */
  static async contentPrepare(itemID: number) {
    if (itemID === undefined) {
      return;
    }
    const item = Zotero.Items.get(itemID);
    const Library = Zotero.Libraries.get(item.libraryID);
    if (!(Library && Library.filesEditable)) {
      showInfo(getString("info-filesUnEditable"));
      return;
    }
    let noteHtml = "";
    if (item.isNote()) {
      noteHtml = item.getNote();
    } else if (item.isPDFAttachment()) {
      noteHtml = (await this.getPdfContent(item)) as string;
    }
    const docCellArr: DocCell[] = [];
    function getID() {
      return String(itemID) + "#" + docCellArr.length;
    }
    const docItem: DocItem = {
      itemID: itemID,
      key: item.key,
      content: docCellArr,
    };
    if (!noteHtml.length || noteHtml === undefined) {
      return;
    }
    //split paragraph
    //replace begin <div data-schema-version="8"> with ''
    //replace end </div> with ''
    //extract table and img after reference
    const regBegin = /<div.+?>/gs;
    const regEnd = /<\/div>$/g;
    const headMarkerMatch = noteHtml.match(regBegin);
    const tailMarkerMatch = noteHtml.match(regEnd);
    let headMarker = "";
    let tailMarker = "";
    if (headMarkerMatch != null && headMarkerMatch.length) {
      headMarker = headMarkerMatch[0];
      const obj: DocCell = {
        id: getID(),
        type: "headMarker" as DocCell["type"],
        rawContent: headMarker,
      };
      docCellArr.push(obj);
    }
    //extract title
    const noteTitle: string = item.getNoteTitle();
    const obj: DocCell = {
      id: getID(),
      type: "title" as DocCell["type"],
      rawContent: noteTitle,
      rawToTranslate: noteTitle,
    };
    docCellArr.push(obj);

    const noteHtmlTrimHeadTail = noteHtml
      .replace(regEnd, "")
      .replace(headMarker, "");
    //split noteHtml by image table paragraph
    //const noteHtmlArr1 = fullTextTranslate.splitContent(noteHtml);
    // split contentEndExceptImgTablefrom last element of noteHtmlArr1
    //匹配到文末，故如有文末的表格图片则予以提取
    //let noteHtmlEnd = noteHtmlArr1.slice(-1)[0];
    //|\bAuthor Affiliations\b
    let noteHtmlTrimHeadEndTail;
    let contentEndExceptImgTable;
    const contentEndExceptImgTableArr = [];
    const tableImgAfter: string[] = [];
    let contentEnd;
    //文末内容正则表达式，排除表格内的关键字，^ 很关键
    //const regContentEnd = /(?<!<th>\n)(<[^>\n]+?>)(<[^>\n]+?>)*\W*(\bReferences?\b|\bAcknowledgments?\b|\bAppendix\b)[^A-Za-z\n]*(<\/[^>]+?>)[\s\S]*/gi;
    //const regContentEnd = /(?<!<\/?th[^<>]+>\n?)^(<[^>\n]+?>)(<[^>\n]+?>)*\W*(\bReferences?\b|\bAcknowledgments?\b|\bAppendix\b)[^A-Za-z\n]*(<\/[^>]+?>)[\s\S]*/mgi;
    //整篇没有换行？除外表格标题或单元格内的关键字：可有一次换行，无论多少<*>标签，后面的关键字都是除外的
    const regContentEnd =
      /(?<!<\/?t[hd][^<>]*>\n?(<\/?[^>\n]+?>)*)(<[^>\n]+?>)+\W*(\bReferences?\b|\bAcknowledgments?\b|\bAppendix\b)(&nbsp)*[^A-Za-z\n]*(<\/[^>]+?>)[\s\S]*/gi;
    const contentEndMatch = noteHtmlTrimHeadTail.match(regContentEnd);
    if (contentEndMatch != null && contentEndMatch[0] != "") {
      contentEnd = contentEndMatch[0];
      noteHtmlTrimHeadEndTail = noteHtmlTrimHeadTail.replace(contentEnd, "");
      //split table and img.How todo when contentEndExceptImgTableis table？
      if (contentEnd.includes("<table>" || "<p><img")) {
        const contentEndArrTemp = fullTextTranslate.splitContentEnd(contentEnd);
        for (const e of contentEndArrTemp) {
          if (e.startsWith("<p><img") || e.startsWith("<table>")) {
            tableImgAfter.push(e);
          } else {
            contentEndExceptImgTableArr.push(e);
          }
        }
        //如果数组为空，字符串即为""
        contentEndExceptImgTable = contentEndExceptImgTableArr.join("\n");
      } else {
        contentEndExceptImgTable = contentEnd;
      }
      const obj: DocCell = {
        id: getID(),
        type: "contentEnd" as DocCell["type"],
        rawContent: contentEndExceptImgTable,
      };
      docCellArr.push(obj);
    } else {
      noteHtmlTrimHeadEndTail = noteHtmlTrimHeadTail;
    }
    //语种识别
    const isTran = await this.languageIdentify(noteHtmlTrimHeadEndTail);
    if (isTran == false) {
      return;
    }

    //tailMarker
    if (tailMarkerMatch != null && tailMarkerMatch.length) {
      tailMarker = tailMarkerMatch[0];
      const obj: DocCell = {
        id: getID(),
        type: "tailMarker" as DocCell["type"],
        rawContent: tailMarker,
      };
      docCellArr.push(obj);
    }

    //正文
    const noteHtmlTrimHeadEndTailArr = fullTextTranslate.splitContent(
      noteHtmlTrimHeadEndTail,
      true,
    );
    let noteHtmlArr = [];
    if (tableImgAfter.length) {
      noteHtmlArr = noteHtmlTrimHeadEndTailArr.concat(tableImgAfter);
    } else {
      noteHtmlArr = noteHtmlTrimHeadEndTailArr;
    }

    /*     const htmlTransArr: string[] = []; */
    //skip img, table trans, txtHtml trans
    for (let html of noteHtmlArr) {
      //图片不翻译
      if (html.startsWith("<p><img")) {
        const obj: DocCell = {
          id: getID(),
          type: "img" as DocCell["type"],
          rawContent: html,
        };
        docCellArr.push(obj);
        continue;
        //空行
      } else if (html.match(/^<([^<>]+?>)<\/\1\n?$/g) !== null) {
        const obj: DocCell = {
          id: getID(),
          type: "emptyLine",
          rawContent: html,
        };
        docCellArr.push(obj);
        continue;
      }
      //提取表格中需要翻译的文字，转为数组，去重
      else if (html.startsWith("<table>")) {
        //删除表格的标签
        const reg = /<[^>]+?>/g;
        const tableTxt = html.replace(reg, "");
        const reg2 = /\n+/g;
        const tempTabletxtArr = tableTxt.split(reg2);
        const tableTxtArr = tempTabletxtArr.filter(
          (item) => item !== undefined && item !== "",
        );
        const tableTxtArrUnrepeated = [...new Set(tableTxtArr)];
        //过滤掉非单词内容
        const tableTxtArrClean = tableTxtArrUnrepeated.filter((item) =>
          /\b[A-Za-z]{3,}\b/.test(item),
        );
        if (!tableTxtArrClean.length) {
          const obj: DocCell = {
            id: getID(),
            type: "table",
            rawContent: html,
          };
          docCellArr.push(obj);
        } else {
          const obj: DocCell = {
            id: getID(),
            type: "table",
            rawContent: html,
            rawToTranslate: tableTxtArrClean,
          };
          docCellArr.push(obj);
        }
        continue;
        // 保留引用格式，仅翻译其中的正文内容
      } else if (
        html.startsWith('<p><span class="highlight" data-annotation=') ||
        html.startsWith('<[^<>]+?>“.+” ?<span class="citation" data-citation=')
      ) {
        //引文的正文被 >“ ”<\/span>包裹，引文提取后可能为数组
        //const reg = /(?<=>“)(.+?)(?=”<\/span>)/;
        const reg =
          /^<p><span class="highlight" data-annotation="[^>]+?>“(.+)”<\/span> <span class="citation" data-citation=".+?<\/span>\)<\/span><\/p>\n?|^<[^<>]+?>“(.+)” ?<span class="citation" data-citation=".+?<\/span>\)<\/span><\/[^><]+?>\n?/m;
        //const citationTotran = html.match(reg)?.filter((item) => item.length)||[];
        const citationTotran = html.match(reg);
        if (citationTotran == null || citationTotran[0] == "") {
          const obj: DocCell = {
            id: getID(),
            type: "citation",
            rawContent: html,
          };
          docCellArr.push(obj);
        } else {
          let ctx;
          if (citationTotran[1] != undefined) {
            ctx = citationTotran[1];
          } else {
            ctx = citationTotran[2];
          }
          if (
            (citationTotran[1] != undefined &&
              citationTotran[1].includes('class="citation"')) ||
            (citationTotran[2] != undefined &&
              citationTotran[2].includes('class="citation"'))
          ) {
            const reg =
              /”?<[^>]+?>“?|\(<span class="citation-item">.+?<\/span>\)/g;
            const tempArr = ctx
              .split(reg)
              .filter(
                (e) => e !== undefined && e != "" && e != "\n" && e != " ",
              );
            const obj: DocCell = {
              id: getID(),
              type: "citation",
              rawContent: html,
              rawToTranslate: tempArr,
            };
            docCellArr.push(obj);
          } else {
            const obj: DocCell = {
              id: getID(),
              type: "citation",
              rawContent: html,
              rawToTranslate: [ctx],
            };
            docCellArr.push(obj);
          }
        }
        continue;
      } else if (html.startsWith("<ol>") || html.startsWith("<ul>")) {
        const reg = /<[^>]+?>/g;
        let olUlTxtArr = html.split(reg);
        olUlTxtArr = olUlTxtArr.filter(
          (item) => item !== undefined && item !== "" && item !== "\n",
        );
        const olUlTxtArrUnrepeated = [...new Set(olUlTxtArr)];
        //过滤掉非单词内容
        const olUlTxtArrClean = olUlTxtArrUnrepeated.filter((item) =>
          /\b[A-Za-z]{3,}\b/.test(item),
        );
        if (!olUlTxtArrClean.length) {
          const obj: DocCell = {
            id: getID(),
            //先归类到表格
            type: "table",
            rawContent: html,
          };
          docCellArr.push(obj);
        } else {
          const obj: DocCell = {
            id: getID(),
            type: "table",
            rawContent: html,
            rawToTranslate: olUlTxtArrClean,
          };
          docCellArr.push(obj);
        }
        continue;
      }
      // translate paragraph
      else {
        //多段分段, 分有没有 \n 两种情况,不能够用||
        const htmlSource = html;
        const regTaga = /<a[^>]+?>(\d+)<\/a>/g;
        html = html.replace(regTaga, "[$1]");
        let tempArr;
        /* const regSplit = /'\n'|(<([ph][1-6]?>).+?<\/\2)/g;
        tempArr = html.split(regSplit);
        tempArr = tempArr.filter(e => e != "" && e.match(/^[hp][1-6]?>$/g) === null && e !== undefined && e.match(/^ +$/g) === null);
 */
        if (html.includes(">\n<")) {
          tempArr = html
            .split("\n")
            .filter(
              (e) => e != "" && e !== undefined && e.match(/^ +$/g) === null,
            );
        } else {
          const reg = /(<([ph][1-6]?>).+?<\/\2)/g;
          tempArr = html
            .split(reg)
            .filter((e) => e != "" && e.match(/^[hp][1-6]?>$/g) === null);
        }
        for (const item of tempArr) {
          //匹配行内图片
          const reg = /<img[^<>]+?>/g;
          const regMatch = item.match(reg);
          //不替换行内图片，转为markdown ![](), 译后替换

          let mdTxt = (await html2md(item)) as string;
          mdTxt = mdTxt.replace("\n", "");
          mdTxt = fullTextTranslate.cleanMd(mdTxt);
          //再拆分，为句子？
          /* const regPara = /\n+/gs;
          const mdArr = mdTxt.split(regPara);
          const mdParas = mdArr.filter((item) => item !== undefined && item !== ""); */
          /* const obj: DocCell = {
            type: "paragraph",
            rawContent: item,
            rawToTranslate: mdParas,            
          }; */



          const obj: DocCell = {
            id: getID(),
            type: "paragraph",
            rawContent: item,
            rawToTranslate: mdTxt,
          };
          if (regMatch != null && regMatch[0] != "") {
            obj["imgsInLine"] = regMatch;
          }
          docCellArr.push(obj);
        }
      }
    }


    for (const cell of docCellArr) {
      if (cell.translation) continue;
      cleanRawToTranslate(cell);

    }


    return docItem;
    function cleanRawToTranslate(cell: DocCell) {
      let str = cell.rawToTranslate;
      if (!str || Array.isArray(str)) return;
      const regs = [
        /[a-zA-z]+:\/\/[^\s"]*/g,//网址
        /<sup>[^>]+?<\/sup>/g,
        /<sub>[^>]+?<\/sub>/g,
        /[^\s\w]+/g,
        /\d+/g,
      ];

      for (const reg of regs) {
        if (!str) break;
        while (reg.test(str)) {
          str = str.replace(reg, '');
        }
      }

      if (str && str.length) {
        const wordReg = /\w+/g;
        const match = str.match(wordReg);
        if (match && (match.join("").length >= 6)) return;
      }
      cell.rawToTranslate = void 0;

    }

  }

  /**
 * 合成译文，写入笔记
 * @param docCellArr
 * @returns
 */
  static async makeTranslation(docItem: DocItem) {
    if (docItem.status == "error") {
      const failureReason = "";
      showInfo(
        getString("info-translateFailure") +
        ": " +
        docItem.itemID?.toString() +
        ":" +
        failureReason,
      );
      return false;
    }
    const docCellArr = docItem.content;
    const bilingualContrast = getPref("bilingualContrast");
    const isSourceFirst = getPref("isSourceFirst");
    let head: string, tail: string, contentEnd: string, title: string;
    head = tail = contentEnd = title = "";
    const contentBody: string[] = [];
    docCellArr.map((e) => {
      if (e.type == "title" && e.result) {
        //如果双语并且原文在前，需要把译文标题作为标题
        //否则留空，软件将自动提取第一段为标题
        if (bilingualContrast) {
          if (isSourceFirst) {
            title = e.translation as string;
          }
        }
      }
      if (e.type == "tailMarker" && e.rawContent) {
        tail = e.rawContent;
      }
      if (e.type == "contentEnd" && e.rawContent) {
        contentEnd = e.rawContent;
      }
      if (e.type == "headMarker" && e.rawContent) {
        head = e.rawContent;
      }
      if (
        e.type == "img" ||
        e.type == "table" ||
        e.type == "paragraph" ||
        e.type == "citation"
      ) {
        if (e.result) {
          if (e.type == "paragraph") {
            if (bilingualContrast) {
              if (isSourceFirst) {
                contentBody.push(e.rawContent);
                contentBody.push(e.result);
              } else {
                contentBody.push(e.result);
                contentBody.push(e.rawContent);
              }
            } else {
              contentBody.push(e.result);
            }
          } else {
            //除了段落，如有译文，已经过双语处理
            contentBody.push(e.result);
          }
        } else {
          contentBody.push(e.rawContent);
        }
      }
    });
    //如果双语原文在前，标题没有截断的话，标题译文是重复的，只需删除数组第二个元素即可纠正
    if (bilingualContrast) {
      if (isSourceFirst) {
        if (title == contentBody[1].replace(/(<\/?[^<>]+?>)/g, "")) {
          contentBody.splice(1, 1);
        }
      }
    }
    const body = contentBody.join("\n");
    //双语对照，则将标题设为目标语言
    if (bilingualContrast && title.length) {
      title = "<h1>" + title + "</h1>";
    } else {
      title = "";
    }


    //合成最终翻译结果
    //const transresult = begin + noteTitleTrans + htmlTransArr.join('') + contentEndExceptImgTable + tail;
    const contentTranslation = head + title + body + contentEnd + tail;
    const itemID = docItem.itemID!;
    //克隆笔记，替换译文，写入，复制图片
    //不要改变原笔记信息
    const zp = Zotero.getActiveZoteroPane();
    const item = Zotero.Items.get(itemID);
    if (item.isNote()) {
      const newItem = item.clone(item.libraryID);
      newItem.setNote(contentTranslation);
      if (
        zp.getCollectionTreeRow()!.isCollection() &&
        newItem.isTopLevelItem()
      ) {
        newItem.setCollections([zp.getCollectionTreeRow()!.ref.id]);
      }
      const newItemID = await newItem.saveTx({ skipSelect: true });
      if (typeof newItemID == "number") {
        docItem.newItemID = newItemID;
      }

      // 复制图片,必须通过 executeTransaction 完成
      if (
        !(
          !(await Zotero.Notes.ensureEmbeddedImagesAreAvailable(item)) &&
          !Zotero.Notes.promptToIgnoreMissingImage()
        )
      ) {
        Zotero.DB.executeTransaction(async function () {
          if (
            newItem.isNote() &&
            (Zotero.Libraries.get(newItem.libraryID) as any).filesEditable
          ) {
            await Zotero.Notes.copyEmbeddedImages(item, newItem);
          }
        });
      }
    }

    if (item.isPDFAttachment()) {
      const note = new Zotero.Item("note");
      note.libraryID = item.libraryID;
      note.parentKey = item.parentKey;
      note.setNote(contentTranslation);
      await note.saveTx();
    }
    await fullTextTranslate.saveDocItem(docItem);

    return true;
  }


  static async saveDocItem(docItem: DocItem) {
    const docJson = JSON.stringify(docItem);
    const item = Zotero.Items.get(docItem.itemID!);
    const parent = item.parentItem;
    const parentItemID = item.parentItemID;
    let doi = '';
    const itemID = item.id;
    if (item && item.isRegularItem()) {
      doi = item.getField("DOI");
    } else if (parent && parent.isRegularItem()) {
      doi = parent.getField("DOI");
    }
    //  if (doi == "") {
    //    await item.loadDataType('primaryData');
    //    doi = item.getField("DOI");
    //  }
    //  if (!doi || doi == "") {
    //    await item.loadDataType("itemData");
    //    doi = item.getField("DOI");
    //  }
    //const itemDataLoaded=item._loaded["itemData"]
    //const primaryDataLoaded=item._loaded["primaryData"]
    const DB = await getDB();
    const sql = `INSERT INTO documents(itemID, parentItemID, doi, docItem) VALUES (?,?,?,?) ON CONFLICT (itemID) DO UPDATE SET parentItemID =?, doi = ?, docItem = ? `;
    const values: any = [itemID, parentItemID, doi, docJson, parentItemID, doi, docJson];
    return await DB.executeTransaction(async () => {
      await DB.queryAsync(sql, values);
    });
  }

  /**
   * 筛选出余额够用的翻译引擎
   * @param num
   * @returns
   */
  static async checkQuotaSwitch(num?: number) {
    let onSwitchResult;
    /* eslint-disable no-constant-condition */
    while (true) {
      const service = await getSingleServiceUnderUse();
      if (!service) return;
      if (service instanceof TranslateServiceAccount) {
        // 如果有秘钥，则检查该秘钥的余额情况
        const key = service.secretKey || service.token;
        if (key) {
          const res = await judgeAndSwith(service);
          if (res) break;//可用退出循环
          if (res === false) return;
          // 成功更换，重新校验          
        } else {
          //如果引擎需要秘钥，但没有秘钥，则更换引擎
          onSwitchResult = await serviceManage.onSwitch(true);
          if (!onSwitchResult) return;//无可用，退出函数
          // 成功更换，重新校验 
        }
      } else {
        //无需秘钥
        const res = await judgeAndSwith(service);
        if (res) break;//可用退出循环
        if (res === false) return;//无可用，退出函数
        // 成功更换，重新校验
      }
    }

    return true;// 校验成功

    async function judgeAndSwith(service: TranslateService | TranslateServiceAccount) {
      const services = await getServices();
      let parentService;
      if (service instanceof TranslateService) {
        parentService = service;
      } else {
        parentService = services[service.serviceID];
      }
      if (!service.charConsum) return true;
      const charasLimit = getCharasLimit(parentService);
      const availableChars = charasLimit - service.charConsum;
      if (num && availableChars < num - 10) {
        onSwitchResult = await serviceManage.onSwitch(true);
        //失败后退出，成功则循环检查
        if (!onSwitchResult) {
          return false;
        }
      } else if (availableChars < parentService.charasPerTime) {
        //剩余额度小于每次请求限制数，直接更换引擎
        onSwitchResult = await serviceManage.onSwitch(true);
        if (!onSwitchResult) {
          return false;
        }
      } else {
        return true;
      }
    }
  }


  //段落生成html，考虑行内图片
  static async paraPostTran(docCell: DocCell) {
    //如果没有译文，则result属性缺失
    if (!docCell.translation || docCell.translation == "") {
      return;
    }
    let tranedStr = docCell.translation as string;
    const rawToTranslate = docCell.rawToTranslate as string;
    if (tranedStr == rawToTranslate) return;

    //替换图片，然后修复上下标错误，转为html
    if (docCell.imgsInLine) {
      //有可能翻译成了中文符号
      const reg = /[!！][\[【][^\[\]【】]*?[】\]][（\(][^\(\)（）]*?[\)）]/;
      for (const item of docCell.imgsInLine) {
        tranedStr = tranedStr.replace(reg, item);
      }
    }
    tranedStr = fullTextTranslate.modifySubSupHeading(tranedStr);
    const result = await md2html(tranedStr);
    if (result !== undefined) {
      docCell.result = result;
    } else {
      return;
    }
  }

  //表格引用替换原文html内容为译文html
  static tableCitationPostTran(docCell: DocCell) {
    const bilingualContrast = getPref("bilingualContrast");
    const isSourceFirst = getPref("isSourceFirst");
    if (!docCell.translation) return;
    let tranedStr = "";
    const tranedStrArr = docCell.translation;
    const rawToTranslate = docCell.rawToTranslate!;
    let result = docCell.rawContent;
    for (let i = 0; i < tranedStrArr.length; i++) {
      if (bilingualContrast) {
        if (isSourceFirst) {
          tranedStr = rawToTranslate[i] + "<br>" + tranedStrArr[i];
        } else {
          tranedStr = tranedStrArr[i] + "<br>" + rawToTranslate[i];
        }
      } else {
        tranedStr = tranedStrArr[i];
      }
      const temp = fullTextTranslate.escapeString(rawToTranslate[i]);
      const reg = new RegExp(temp, "g");
      result = result.replace(reg, tranedStr);
    }
    if (result != docCell.rawContent) {
      docCell.result = result;
    }
  }



  static async delError(docItem: DocItem) {
    const splitOK = await readJsonFromDisk("translatedCache-splitOK");
    const splitError = await readJsonFromDisk("translatedCache-splitError");
    if (!splitOK && !splitError) return;
    const id = splitError?.docItem.itemID || splitOK?.docItem.itemID;
    if (id != docItem.itemID) return;
    const docCellArr = docItem.content;
    let objArrToTranArr: DocCell[] = [];
    objArrToTranArr = docCellArr.filter(
      (e: DocCell) => e.rawToTranslate && e.rawToTranslate != " " && e.rawToTranslate.length && !e.translation);
    const paragraph = objArrToTranArr.filter((e) => (e.type == "paragraph" || e.type == "title"));
    const splitArr: string[] = [];
    const sourceArr: string[] = [];

    if (splitError) {
      let manual = 0;
      const sourceStrs: string[] = [...splitError.toTrans];
      splitArr.push(...splitError.splitArr);
      let differNumber = splitArr.length - sourceStrs.length;
      const targets = [...splitArr];
      if (sourceStrs.length > targets.length) {
        manual = 1;
      } else {
        const reconstructed = [];
        const wordReg = /\b\w+\b/g;
        for (let i = 0; i < sourceStrs.length; i++) {
          const source = sourceStrs[i];
          let target = targets.splice(0, 1)[0];
          while (differNumber) {
            const words = source.match(wordReg)?.length || 0;
            const c1 = target.match(/[\u4e00-\u9fa5]/g)?.length || 0;
            const c2 = target.match(/[A-Za-z\d_*]+/g)?.length || 0;
            const chineses = c1 + c2;
            let condition;
            if (words && chineses) {
              if (c1 == 0) {
                //没有汉字大概率不会断开原文
                condition = false;
              } else {
                condition = (words - chineses) / chineses > 0.2;
              }
            }
            if (condition) {
              target += targets.splice(0, 1);
              differNumber--;
            } else {
              reconstructed.push(target);
              break;
            }
          }
          if (!differNumber) {
            reconstructed.push(...targets);
            break;
          }
        }
        if (reconstructed.length == sourceStrs.length) {
          splitArr.length = 0;
          splitArr.push(...reconstructed);
        } else {
          //手动合并
          manual = 1;
        }
      }
      if (manual) {
        const res = await fullTextTranslate.manualRevision(sourceStrs, splitArr, docItem, splitError.serviceID);
        if (res) throw res;
        /*  const temp = showTargeCombine([...sourceStrs], [...splitArr]);
         if (sourceStrs.length == temp.targetArr.length) {
           sourceArr.length = 0;
           sourceArr.push(temp.soureArr);
           splitArr.length = 0;
           splitArr.push(...temp.targetArr);
           await saveJsonToDisk({
             docItem: docItem,
             sourceArr: sourceArr,
             splitArr: splitArr,
             serviceID: splitError.serviceID,
           },
             "translatedCache-splitOK");
           await deleteCacheOrFile("translatedCache-splitError");
         } */
      }

    }

    if (splitOK) {
      sourceArr.length = 0;
      sourceArr.push(...splitOK.sourceArr);
      splitArr.length == 0;
      splitArr.push(...splitOK.splitArr);
    }


    if (splitArr.length == sourceArr.length) {
      const serviceID = splitError.serviceID || splitOK.serviceID;
      for (let i = 0; i < sourceArr.length; i++) {
        for (const para of paragraph) {
          if (!para.rawToTranslate || para.rawToTranslate != sourceArr[i]) continue;
          para.translation = splitArr[i];
          para.serviceID = serviceID;
          await fullTextTranslate.paraPostTran(para);
        }
      }
    }

    await deleteCacheOrFile("translatedCache-splitOK");
  }

  /**
   * 译后处理，生成译文
   * @param docCellArr
   * @returns
   */
  static async translateDoc(docItem: DocItem) {
    await fullTextTranslate.delError(docItem);
    if (docItem?.status == "cache") {
      showInfo("从错误中恢复");
    }

    const docCellArr = docItem.content;
    let objArrToTranArr: DocCell[] = [];
    let result: TransResult[] | undefined | string;
    objArrToTranArr = docCellArr.filter(
      (e: DocCell) => e.rawToTranslate && e.rawToTranslate != " " && e.rawToTranslate.length && !e.translation);
    const paragraph = objArrToTranArr.filter((e) => (e.type == "paragraph" || e.type == "title"));


    const paragraphs2 = paragraph.filter(e => !e.translation);
    const totranArr = paragraphs2.map(e => e.rawToTranslate) as string[];

    let characterNumber = 0;
    const perTimeArr: string[] = [];
    const perTimeParas: DocCell[] = [];
    const leftParas = [...paragraphs2];
    const leftArr = [...totranArr];
    while (leftArr.length) {
      const service = await serviceWork();
      const services = await getServices();
      const charasPerTime = services[service.serviceID].charasPerTime;
      characterNumber += leftArr[0].length;
      if (characterNumber < charasPerTime) {
        perTimeArr.push(leftArr.shift()!);
        perTimeParas.push(leftParas.shift()!);
        continue;
      } else {
        //翻译
        result = await fullTextTranslate.translateExec([...perTimeArr], docItem);
        result = await recordError(result, perTimeArr, docItem);

        const translation = result.map((e) => e.translation);
        const serviceIDs = result.map((e) => e.serviceID);

        for (let i = 0; i < perTimeArr.length; i++) {
          for (const para of perTimeParas) {
            if (!para.rawToTranslate || para.rawToTranslate != perTimeArr[i] || para.translation) continue;
            para.translation = translation[i];
            para.serviceID = serviceIDs[i];
            await fullTextTranslate.paraPostTran(para);
          }
        }

        perTimeParas.length = 0;
        perTimeArr.length = 0;
        characterNumber = 0;
      }
    }


    async function recordError(result: string | TransResult[] | undefined, perTimeArr: string[], docItem: DocItem) {
      let reason;
      if (!result || !result.length || typeof result == "string") {
        reason = "错误，无译文。";
      } else if (result && result.length !== perTimeArr.length) {
        reason = "译后结果数组不相等。";
      }
      if (reason) {
        docItem.status == "cache";
        await saveJsonToDisk({
          reason: reason,
          result: result,
          docItem: docItem,
          perTimeArr: perTimeArr,
        }, "translatedCache");
        throw new Error("翻译失败," + reason + perTimeArr);
      }
      return result as TransResult[];
    }
    //表格或引用，逐个翻译
    const tableCitations = objArrToTranArr.filter(e => e.type == "table" || e.type == "citation");
    if (tableCitations.length) {
      for (const cell of tableCitations) {
        const perTimeArr = cell.rawToTranslate as string[];
        result = await fullTextTranslate.translateExec([...perTimeArr], docItem);
        result = await recordError(result, perTimeArr, docItem);
        const translation = result.map((e) => e.translation);
        const serviceID = result.map((e) => e.serviceID);
        cell.translation = translation;
        cell.serviceID = serviceID;
        fullTextTranslate.tableCitationPostTran(cell);
      }



    }

    return docItem;


  }

  /**
   *
   * @param docCellArr
   * @param sourceTxt
   * @returns
   */
  static async translateExec(sourceTxt: string | string[], docItem: DocItem) {
    let toTranArr: string[] = [];
    const transResultArr: TransResult[] = [];
    if (typeof sourceTxt == "string") {
      toTranArr = [sourceTxt];
    } else {
      toTranArr = [...sourceTxt];
    }
    let service;

    //准备额度充足的引擎
    const check = await this.checkQuotaSwitch();
    if (!check) { return "Error: " + "check Quota failed"; }
    const indexState: any = {};
    const temp = [];
    const reg = /\n+/;
    for (let i = 0; i < toTranArr.length; i++) {
      const e = toTranArr[i];
      if (e && e.length && !e.match(/^ *$/)) {
        const e2 = e.split(reg).filter(e => e.length); //以‘\n’分割消除 \n ,过滤掉空字符串;
        if (e2.length) {
          temp.push(...e2);
        }
        indexState[i] = e2.length;
      } else {
        indexState[i] = 0;
      }
    }
    if (!temp || !temp.length) return;
    const leftArr = [...temp];
    let toTran;
    let loopTimes = 0;
    let lastServiceID = "";

    const tp = translatingProgress();

    while (leftArr.length) {
      let resultStr;
      service = await serviceWork();
      if (!service) {
        return "Error: " + "no service";
      }
      const services = await getServices();
      const serviceID = service.serviceID;
      const charasPerTime = services[service.serviceID].charasPerTime;
      //翻译引擎支持多段翻译,合并后翻译提高效率 
      if (services[service.serviceID].supportMultiParas && leftArr.length > 1 && leftArr[0].length < charasPerTime) {
        //合并后翻译          
        const lengthOfBefor = leftArr.length; //合并前数组长度
        //leftArr 长度随着合并而改变        
        const combineObj = fullTextTranslate.combineByLimitOneRequest(leftArr, charasPerTime);
        toTran = combineObj.str;
        const toTrans = combineObj.arr;
        if (!toTran.length) continue;//空字符串
        const lengthOfAfter = leftArr.length;//合并后数组长度
        const arrLengthToTran = lengthOfBefor - lengthOfAfter;// 翻译数组长度
        tp(serviceID, loopTimes);
        const resultStr = await fullTextTranslate.translateGo(toTran);
        if (resultStr.startsWith("Error:")) {
          return resultStr;
        }
        const reg = /\n$/g;
        // 译文拆分
        const splitArr = resultStr.replace(reg, "").split("\n");
        if (arrLengthToTran != splitArr.length) {
          // 写入缓存，退出程序，修改错误，下次从缓存读取已经翻译的内容
          await saveJsonToDisk({
            docItem: docItem,
            toTrans: toTrans,// 本次翻译
            toTran: toTran,
            splitArr: splitArr,
            serviceID: serviceID
          }, "translatedCache-splitError");

          // 重构翻译结果，不会出现合并后翻译
          //可以出现一段翻译成多段 或 漏译,
          let manual = 0;
          const sourceStrs = combineObj.arr;
          if (arrLengthToTran > splitArr.length) {
            manual = 1;
          } {

            let differNumber = splitArr.length - sourceStrs.length;
            const targets = [...splitArr];
            const reconstructed = [];
            const wordReg = /\b\w+\b/g;
            for (let i = 0; i < sourceStrs.length; i++) {
              const source = sourceStrs[i];
              let target = targets.splice(0, 1)[0];
              while (differNumber) {
                const words = source.match(wordReg)?.length || 0;
                const c1 = target.match(/[\u4e00-\u9fa5]/g)?.length || 0;
                const c2 = target.match(/[A-Za-z\d_*]+/g)?.length || 0;
                const chineses = c1 + c2;
                let condition;
                if (words && chineses) {
                  if (c1 == 0) {
                    //没有汉字大概率不会断开原文
                    condition = false;
                  } else {
                    condition = (words - chineses) / chineses > 0.2;
                  }

                }
                //const condition = (source.length / 3 - target.length) / target.length > 0.05;
                if (condition) {
                  target += targets.splice(0, 1);
                  differNumber--;
                } else {
                  reconstructed.push(target);
                  break;
                }

              }
              if (!differNumber) {
                reconstructed.push(...targets);
                break;
              }
            }
            if (reconstructed.length == splitArr.length) {
              splitArr.length = 0;
              splitArr.push(...reconstructed);
              await deleteCacheOrFile("translatedCache-splitError");
            } else {
              //重构译文结果失败
              //手动合并
              manual = 1;
            }
          }


          if (manual) {
            const res = await fullTextTranslate.manualRevision(sourceStrs, splitArr, docItem, serviceID);
            if (res) return res;
            /* const temp = showTargeCombine([...sourceStrs], [...splitArr]);
            if (sourceStrs.length == temp.targetArr.length) {

              splitArr.length = 0;
              splitArr.push(...temp.targetArr);
              await saveJsonToDisk({
                docItem: docItem,
                sourceArr: sourceStrs,
                splitArr: splitArr,
                serviceID: serviceID,
              },
                "translatedCache-splitOK");
              await deleteCacheOrFile("translatedCache-splitError");
            } else {
              return "Error: " + "reconstructed.length != splitArr.length, Manual modification failed";
            } */
          }

        }
        // 译文写入结果
        for (const item of splitArr) {
          const obj: TransResult = {
            translation: item,
            serviceID: serviceID,
            status: "success",
          };
          transResultArr.push(obj);
        }
      } else {
        toTran = leftArr.shift();
        if (!toTran) {
          loopTimes++;
          continue;
        }
        // 超限拆分
        if (toTran.length > charasPerTime) {
          toTranArr = this.wholeSentenceSplit(toTran, charasPerTime);
          const tempArr: string[] = [];
          for (const toTran of toTranArr) {
            const resultStr = await fullTextTranslate.translateGo(toTran);
            if (resultStr.startsWith("Error:")) {
              return resultStr;
            }
            tempArr.push(resultStr);
          }
          resultStr = tempArr.join("");

        } else {
          tp(serviceID, loopTimes);
          resultStr = await fullTextTranslate.translateGo(toTran);
          if (resultStr.startsWith("Error:")) {
            return resultStr;
          }
        }
        const obj: TransResult = {
          translation: resultStr,
          serviceID: serviceID,
          status: "success",
        };
        transResultArr.push(obj);
      }



      if (loopTimes != 0 && lastServiceID == serviceID) {
        // 非首次循环，若有秘钥账号的消耗为零，则有误
        if (service instanceof TranslateServiceAccount) {
          if (service.charConsum == 0) {
            showInfo("error: characters record failure");
          }
        }
      }
      lastServiceID = serviceID;
      loopTimes += 1;
    }
    tp('', loopTimes)(true);
    return transResultArr;


    function translatingProgress() {
      const translatingProgress = new ztoolkit.ProgressWindow(config.addonName, {
        closeOnClick: true,
        closeTime: -1,
        closeOtherProgressWindows: true,
      });
      return function (serviceID: string, loopTimes: number) {
        const translatingInfoA = `${serviceID}: ${getString("translating")}...✍️...`;
        const translatingInfoB = `${serviceID}: ✍️...${getString("translating")}...✍️`;
        const translatingInfoC = `${serviceID}: ✍️...✍️...${getString("translating")}`;
        let text = "";
        translatingProgress
          .createLine({
            text:
              getString(`service-${serviceID}`) +
              getString("start-translating"),
            type: "default",
          })
          .show();
        loopTimes % 3 == 0
          ? (text = translatingInfoA)
          : loopTimes % 2
            ? (text = translatingInfoB)
            : (text = translatingInfoC);
        translatingProgress.changeLine({
          text: text,
        });
        return function (isclose: boolean = true) {
          if (isclose) {
            translatingProgress.close();
          }
        };
      };
    }

  }


  static async manualRevision(sourceStrs: string[], splitArr: string[], docItem: DocItem, serviceID?: string) {
    const temp = showTargeCombine([...sourceStrs], [...splitArr]);
    if (sourceStrs.length == temp.targetArr.length) {
      splitArr.length = 0;
      splitArr.push(...temp.targetArr);
      await saveJsonToDisk({
        docItem: docItem,
        sourceArr: sourceStrs,
        splitArr: splitArr,
        serviceID: serviceID,
      },
        "translatedCache-splitOK");
      await deleteCacheOrFile("translatedCache-splitError");
    } else {
      return "Error: " + "reconstructed.length != splitArr.length, Manual modification failed";
    }
  }


  //{sourceSegment: string,   option:{sourceSegment:string|string[],result:string[]}
  static translateGo = async (sourceSegment: string) => {
    if (!Zotero.Streamer._socketOpen()) {
      throw getString("info-networkDisconnected");
    }
    let service = await getSingleServiceUnderUse();
    if (!service) return "Error: " + "no service";
    const services = await getServices();
    let serviceID = service.serviceID;
    let serviceUsing = services[serviceID];
    let sourceTxtArr;

    const availableChars =
      getCharasLimit(serviceUsing) - (service.charConsum || 0);
    if (availableChars < sourceSegment.length) {
      // 可用字符不足，更换引擎或账号
      //如果更换引擎失败，返回特定字符
      if (!(await serviceManage.onSwitch())) return "Error: " + "switch service failed";
      service = await getSingleServiceUnderUse();
      if (!service) return "Error: ";
      serviceID = service.serviceID;
      serviceUsing = services[serviceID];
    }

    // 超过单次请求字符限制时进一步拆分
    if (sourceSegment.length > serviceUsing.charasPerTime - 20) {
      sourceTxtArr = fullTextTranslate.wholeSentenceSplit(
        sourceSegment,
        services[serviceID].charasPerTime,
      );
    }

    if (!sourceTxtArr) sourceTxtArr = [sourceSegment];
    let args: any = [];
    if (service instanceof TranslateServiceAccount) {
      let keyStr = service.secretKey || service.token;
      if (keyStr) {
        keyStr = await serviceManage.secretKeyForPDFTranslate(service);
        args = [keyStr];
        //args = [service.appID + "#" + (await decryptKey(keyStr))];
        const lang = await getLang();
        args.push(lang.sourceLang, lang.targetLang);
      }
    }
    let func = translateFunc[serviceID];
    if (!func) {
      func = Zotero.PDFTranslate.api.translate;
      if (!func) {
        showInfo("请安装 Zotero PDF Translate 插件");
        return "Error: " + "请安装 Zotero PDF Translate 插件";
      }
      await serviceManage.switchPDFTranslate(service);
      args = [];
    }
    if (!func) {
      showInfo("无可用翻译模块");
      return "Error: " + "无可用翻译模块";
    }


    const trans: string[] = [];
    while (sourceTxtArr.length) {
      const string = sourceTxtArr.shift()!;
      try {
        const timerStart = timer();
        // 开始翻译
        const paraResult = await func(string, ...args);
        const condition = ['[Request Error]', '[请求错误]', '[Errore nella richiesta]'].some(e => paraResult.result.includes(e));
        if (condition) {
          showInfo(paraResult.result);
          return "Error: " + paraResult.result;

        }
        trans.push(paraResult.result);
        // 记录字符消耗
        await fullTextTranslate.updateCharConsum(string!.length, service);
        // 等待不超时限
        if (services[serviceID].QPS && sourceTxtArr.length) {
          const timeDiffer = timerStart();
          const sec = 1000 / services[serviceID].QPS - timeDiffer + 100;
          if (sec > 0) {
            await Zotero.Promise.delay(sec);
          }
        }
      } catch (e) {
        ztoolkit.log(e);
        //如果更换引擎失败，退出translateGo后保存翻译原文和译文到缓存
        if (!(await serviceManage.onSwitch(true))) {
          return "Error: " + e + " ::[translated]:: " + trans.join('');
        }
        // 递归

        sourceTxtArr.unshift(string);
        const secondSource = sourceTxtArr.join("");//todo 优化合并方案       

        const resultSecond: any = await fullTextTranslate.translateGo(secondSource);
        if (typeof resultSecond == "string" && resultSecond.startsWith("Error:")) {
          return "Error: " + resultSecond; //退出函数
        }
        trans.push(resultSecond);
        break; // 退出循环，继续函数其他内容
      }
    }

    return trans.join("");

  };
  /**
   * 翻译引擎：支持换行，字数限制，QPS
   * @param sourceTxt
   * @returns
   */
  //删除行首不翻译的字符
  static beginNoTransExtract(sourceTxt: string) {
    const regSS = /^[\W.]+/;
    const regSSMatch = sourceTxt.match(regSS);
    let begingSS = "";
    if (regSSMatch != null) {
      begingSS = regSSMatch[0];
    }
    return begingSS;
  }
  /**
   * 截取的行尾内容不包括最后的标点
   * @param sourceTxt
   * @returns
   */
  static endNoTransExtract(sourceTxt: string) {
    //测试后向断言,通过
    //const regSS = /(?<=[.?!"]) /g
    const regSS =
      /[\[\(][0-9\W]+[^.?!]"?(?=[.?!"]$)|(?<=[.?!]"?)[\[\(][0-9\W]+|(<su[pb]>[^>]+?<\/su[pb]>)+[^A-Za-z.]*(?=[.?!]"?$)/gm;
    const regSSMatch = sourceTxt.match(regSS);
    let endSS = "";
    if (regSSMatch != null) {
      endSS = regSSMatch[0];
    }
    return endSS;
  }

  /**
   * 根据插件id查看插件版本
   * 不传参数返回所有插件
   * @param id
   * @returns
   */
  static async getAddonInfo(id?: string) {
    const { AddonManager } = ChromeUtils.import(
      "resource://gre/modules/AddonManager.jsm",
    );
    if (id !== undefined && id != "") {
      const addon = await AddonManager.getAddonByID(id);
      if (addon) {
        return {
          version: addon.version,
          userDisabled: addon.userDisabled,
        };
      }
    } else {
      const addonAll = await AddonManager.getAllAddons();
      if (addonAll) {
        return addonAll;
      }
    }
  }

  static fullTextTranslateNotifierCallback() {
    new ztoolkit.ProgressWindow(config.addonName)
      .createLine({
        text: "Selected note!",
        type: "success",
        progress: 100,
      })
      .show();
  }
  /**
   * 通过进度条显示信息
   * 关闭其他窗口若为true，则关闭最近一次生成的所有进度条
   * 但不会关闭更早的进度条窗口
   * 不传参数用 undefined 表示
   * @param fullTextTranslateInfo 显示的信息
   * @param window 指定显示在哪个窗口中，如指定 addon.data.prefs.window，否则主窗口
   * @param closeOnClick 默认点击时关闭
   * @param closeTime 默认不自动关闭
   * @param closeOtherProgressWindows 默认 true
   */
  static showInfo(
    fullTextTranslateInfo: string,
    closeTime?: number,
    window?: Window,
    closeOnClick?: boolean,
    closeOtherProgressWindows?: boolean,
  ) {
    /*     if (closeOtherProgressWindows) {
          while (true) {
            if (typeof Zotero.ProgressWindowSet != "undefined") {
              Zotero.ProgressWindowSet.closeAll()
            } else {
              break
            }
          }
        } */
    const popupWin = new ztoolkit.ProgressWindow(config.addonName, {
      window: window ? window : undefined,
      closeOnClick: closeOnClick ? closeOnClick : true,
      closeTime: closeTime ? closeTime : -1,
      closeOtherProgressWindows: closeOtherProgressWindows
        ? closeOtherProgressWindows
        : true,
    }).createLine({
      text: fullTextTranslateInfo,
      type: "default",
      progress: 0,
    });
    popupWin.show();

    return popupWin;
  }

  /**
   * 转义字符串中需要转义的字符
   * @param str
   * @returns
   */
  static escapeString(str: string) {
    const result = str.replace(
      /[\-\/\\\^\$\*\+\?\.\(\)\|\[\]\{\}]/g,
      "\\$&",
    ) as string;
    return result;
  }

  /**
   * 修复翻译引擎错误处理的上下标和标题
   * @param mdTxtTransResult
   * @returns
   */
  static modifySubSupHeading = (mdTxtTransResult: string) => {
    //有时markdown标题标志#翻译为＃，和文字没有空格，需要替换＃为#，添加空格
    //g是全局标志，没有的话仅匹配一项
    //限定匹配6个以内的#或＃
    const regMd = /^ *[#＃]{0,5}[#＃](?![#＃])/gm;
    const ss = mdTxtTransResult.match(regMd);
    if (ss != null) {
      //最长的需要先替换，古先要把最长的放到数组前面
      const sss = [...new Set(ss)];
      sss?.sort((a, b) => b.length - a.length);
      if (sss.length) {
        for (const s of sss) {
          //先把匹配项的空格删除然后替换＃，末尾加空格，这是要替换为的内容
          const t = s.replace(/ /g, "").replace(/＃/g, "#") + " ";
          //按先长后短的顺序全文替换
          const reg = new RegExp("^" + s, "gm");
          mdTxtTransResult = mdTxtTransResult.replace(reg, t);
        }
      }
    }
    if (
      mdTxtTransResult.match(/su[bp]|&#x3C;?|&#x3E;?|&#60;?|&#62;?/g) != null
    ) {
      const regMDSubp1 = /(&#x3C);?|(&#60);?|&lt;/g;
      const regMDSubp2 = /(&#x3E);?|(&#62);?|&gt;/g;
      const regMDSubp3 = /<([^<>＜＞]{1,10}?)(\/su[bp])([^<>＜＞]{1,10}?)>/g;
      const regMDSubp4 = /(<\/su[bp])([^><＜＞]{1,10}?)>/g;
      const regMDSubp5 = /<([^><＜＞]{1,10}?)(\/su[bp]>)/g;
      const regMDSubp6 = /(<su[bp])([^><＜＞]{1,10}?)>/g;
      const regMDSubp7 = /<([^></]{1,10}?)(su[bp]>)/g;
      const regMDSubp8 = /(<\/)[^<>/＜＞]{1,10}?(su[bp]>)/g;
      const regMDSubp9 = /亚([^<>＜＞]{1,10}?)\/亚/g;
      const regMDSubp10 = /(?<!<)(su[bp]) *([^<>＜＞]{1,10}?) *\/\1/g;
      const regMDSubp11 = /<(su[bp]>) *([^<>＜＞]{1,10}?) *<\1/g;
      const regMDSubp12 = /＜su([pb])＞/g;
      const regMDSubp13 = /＜\/su([pb])＞/g;
      const regMDSubp14 = /<su([bp])>([^<>＜＞]{15,})/g;
      const regMDSubp15 = /([^<>＜＞]{15,})<\/su([bp])>/g;

      let temp;
      const match1 = mdTxtTransResult.match(regMDSubp1);
      if (match1 != null) {
        temp = mdTxtTransResult;
        mdTxtTransResult = mdTxtTransResult.replace(regMDSubp1, "<");
      }
      const match2 = mdTxtTransResult.match(regMDSubp2);
      if (match2 != null) {
        temp = mdTxtTransResult;
        mdTxtTransResult = mdTxtTransResult.replace(regMDSubp2, ">");
      }
      const match3 = mdTxtTransResult.match(regMDSubp3);
      if (match3 != null) {
        temp = mdTxtTransResult;

        mdTxtTransResult = mdTxtTransResult.replace(regMDSubp3, "$1<$2>$3");
      }
      const match4 = mdTxtTransResult.match(regMDSubp4);
      if (match4 != null) {
        temp = mdTxtTransResult;
        mdTxtTransResult = mdTxtTransResult.replace(regMDSubp4, "$1>$2");
      }
      const match5 = mdTxtTransResult.match(regMDSubp5);
      if (match5 != null) {
        temp = mdTxtTransResult;
        mdTxtTransResult = mdTxtTransResult.replace(regMDSubp5, "$1<$2");
      }
      const match6 = mdTxtTransResult.match(regMDSubp6);
      if (match6 != null) {
        temp = mdTxtTransResult;
        mdTxtTransResult = mdTxtTransResult.replace(regMDSubp6, "$1>$2");
      }
      const match7 = mdTxtTransResult.match(regMDSubp7);
      if (match7 != null) {
        temp = mdTxtTransResult;
        mdTxtTransResult = mdTxtTransResult.replace(regMDSubp7, "$1<$2");
      }
      const match8 = mdTxtTransResult.match(regMDSubp8);
      if (match8 != null) {
        temp = mdTxtTransResult;
        mdTxtTransResult = mdTxtTransResult.replace(regMDSubp8, "$1$2");
      }
      mdTxtTransResult = mdTxtTransResult.replace(regMDSubp12, "<su$1>");
      mdTxtTransResult = mdTxtTransResult.replace(regMDSubp13, "</su$1>");
      const match9 = mdTxtTransResult.match(regMDSubp9);
      if (match9 != null) {
        temp = mdTxtTransResult;
        mdTxtTransResult = mdTxtTransResult.replace(
          regMDSubp9,
          "<sub>$1</sub>",
        );
      }

      const match10 = mdTxtTransResult.match(regMDSubp10);
      if (match10 != null) {
        temp = mdTxtTransResult;
        mdTxtTransResult = mdTxtTransResult.replace(regMDSubp10, "<$1>$2</$1>");
      }
      const match11 = mdTxtTransResult.match(regMDSubp11);
      if (match11 != null) {
        temp = mdTxtTransResult;
        mdTxtTransResult = mdTxtTransResult.replace(regMDSubp11, "<$1$2</$1");
      }
      mdTxtTransResult = mdTxtTransResult.replace(
        regMDSubp14,
        "<su$1></su$1>$2",
      );
      mdTxtTransResult = mdTxtTransResult.replace(
        regMDSubp15,
        "$1<su$2></su$2>",
      );
    }
    return mdTxtTransResult;
  };
}


async function serviceWork() {
  let service = await getSingleServiceUnderUse();
  if (!service) throw new Error("没有指定翻译引擎或账号");
  const checkResult = await serviceManage.serviceAvailableCheck(service);
  if (!checkResult) {
    service = await getAvilabelService("all");
    if (service) {
      await setCurrentService(service.serviceID, service.serialNumber);
    } else {
      throw "无可用翻译引擎或账号";
    }
  }
  return service;
}