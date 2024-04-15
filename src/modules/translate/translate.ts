import { franc } from "franc-min";
import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
import { getPref } from "../../utils/prefs";
import { showInfo } from "../../utils/tools";
import { pdf2document } from "../pdf/pdfFullText";
import { serviceManage } from "./serviceManage";
import { tencentTransmart } from "../webApi/tencentTransmart";
import { showTrans } from "../ui/dataDialog";


export class Translator {
    worker: any;
    translateConfig: any;
    constructor() {
        this.worker = tencentTransmart;
        this.translateConfig = { sourceLang: "en", targetLang: "zh" };
        this.registerTranslatePromot(this.polo.bind(this));
    }
    async workerRun(sourceText: string) {
        const { sourceLang, targetLang } = this.translateConfig;
        return await this.worker(sourceText, sourceLang, targetLang);
    }

    registerTranslatePromot(fn: any) {
        ztoolkit.Prompt.register([
            {
                name: "trans",
                label: "trans En > Zh",
                // The when function is executed when Prompt UI is woken up by `Shift + P`, and this command does not display when false is returned.
                when: () => {
                    //const items = ZoteroPane.getSelectedItems();
                    // return items.length > 0;
                    return true;
                },
                callback(prompt) {
                    showTrans();
                    //@ts-ignore XXX
                    prompt.exit();
                },
            }
        ]);


    }

    /* async polo(e: Event) {
        //@ts-ignore has
        const content = e.target?.value;
        let result;
        try {
            result = await this.workerRun(content);
            showInfo(result.result);
            return result.result;
        } catch (e: any) {
            showInfo(e.message);
            throw e;

        }

    } */
    async polo(content: string) {
        let result;
        try {
            result = await this.workerRun(content);
            showInfo(result.result);
            return result.result;
        } catch (e: any) {
            showInfo(e.message);
            throw e;
        }
    }
}



const OptionsPDFTranslate: OptionsPDFTranslate = {
    service: "baidu",
    pluginID: config.addonID,
    langfrom: "en",
    langto: "zh"
};
// const result = await Zotero.PDFTranslate.api.translate(rowText, OptionsPDFTranslate);
//showInfo(result.result);

