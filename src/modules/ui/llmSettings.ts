import { arrsToObjs } from "../../utils/tools";
import { getDB } from "../database/database";
import { dbRowsToObjs } from "../translate/translateServices";
import { getDom, makeId } from "./uiTools";

export async function llmSettings() {
    const doc = addon.data.prefs?.window?.document;
    if (!doc) {
        return;
    }


    const llms = await getLLMs();
    let providers: string[] = [];
    if (!llms.length) {
        //providers = ["openAI", "ollama"];
        fillModel();
        return;
    } {
        providers = llms.map((llm: any) => llm.provider);
    }

    //LLM

    const providersArr = providers
        .map((e) => ({
            tag: "menuitem",
            attributes: {
                label: e,
                value: e,
            },
        }));

    ztoolkit.UI.replaceElement(
        {
            // 下拉列表
            tag: "menulist",
            id: makeId("providers"),
            attributes: {
                native: "true",
            },
            listeners: [
                {
                    type: "command",
                    listener: (e: Event) => {

                    },
                },
            ],
            children: [
                {
                    tag: "menupopup",
                    //map出的对象数组赋值给键 children
                    children: providersArr,
                },
            ],
        },
        // 将要被替换掉的元素
        doc.querySelector(`#${makeId("LLMProvider-placeholder")}`)!,
    );
    const values: string[] = [];

    fillModel(values);

}


export async function getLLMs() {
    let llms: any[] = addon.mountPoint.llms;
    if (llms) return llms;
    const DB = await getDB();
    const sqlColumns = ["provider", "apikey", "baseurl", "models", "defaultModel"];
    const tableName = "largeLanguageModels";
    const sql = `SELECT ${sqlColumns.join(", ")} FROM ${tableName}`;
    const rows = await DB!.queryAsync(sql);
    if (!rows.length) return [];
    llms = dbRowsToObjs(rows, sqlColumns) as any[];
    addon.mountPoint.llms = llms;
    return llms;
}

async function addMolesToDatabase() {
    const openAIModels = ["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo"];
    const modelsStr = JSON.stringify(openAIModels);
    const DB = await getDB();
    if (!DB) return;
    const tableName = "largeLanguageModels";
    const serialNumber = await DB.getNextID(tableName, "serialNumber");
    const sqlValues = [serialNumber, "openAI", "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", "https://api.openai.com/v1", modelsStr, "gpt-3.5-turbo"];
    const sqlColumns = ["serialNumber", "provider", "apikey", "baseurl", "models", "defaultModel"];
    //const  openAI=arrsToObjs(sqlColumns)(openAIArr)
    const sql = `INSERT OR IGNORE INTO ${tableName} (${sqlColumns.join(",")}) VALUES (${sqlValues.map(() => "?").join()})`;
    await DB.executeTransaction(async () => {
        await DB.queryAsync(sql, sqlValues);
    });
}

async function fillModel(values: string[]) {
    const openAIModels = ["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo"];
    const modelsStr = openAIModels.join(",");
    if (!values.length) values = ["openAI", "", "https://api.openai.com/v1", modelsStr, "gpt-3.5-turbo"];
    const ids = ["providerCustom", "APIKey", "baseURL", "modelsList", "defaultModel"];
    for (let i = 0; i < ids.length; i++) {
        inputFill(ids[i], values[i]);
    }
    function inputFill(id: string, value: string) {
        const elem = getDom(id) as HTMLInputElement;
        elem.value = value;
    }
}






