import { config } from "../../../package.json";
import { showInfo } from "../../utils/tools";

export class Translator {
    [key: string]: any;
    constructor() {
        this.name = "todo";
    }

    doTranslate(contentType: string) {
        showInfo("开始翻译：" + contentType);
        throw ("todo");
    }

}




export async function translate(option: any) {

    const translator = new Translator();
    try {
        translator.doTranslate(option);
    } catch (e: any) {
        showInfo(e.message);
        throw e;
    }
    const OptionsPDFTranslate: OptionsPDFTranslate = {
        service: "baidu",
        pluginID: config.addonID,
        langfrom: "en",
        langto: "zh"
    };
    const result = await Zotero.PDFTranslate.api.translate(rowText, OptionsPDFTranslate);
    showInfo(result.result);
}

function getTranslator() {
    return translator;
}