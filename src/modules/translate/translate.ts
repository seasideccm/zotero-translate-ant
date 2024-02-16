import { config } from "../../../package.json";
import { showInfo } from "../../utils/tools";

export class translate {
    constructor() {

    }

}


export async function tran(rowText: string) {
    const optionsZPT: OptionsZPT = {
        service: "baidu",
        pluginID: config.addonID,
        langfrom: "en",
        langto: "zh"
    };
    const result = await Zotero.PDFTranslate.api.translate(rowText, optionsZPT);
    showInfo(result.result);
}