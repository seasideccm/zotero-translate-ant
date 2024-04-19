import { getString } from "../../utils/locale";
import { arrayUtils, arrsToObjs } from "../../utils/tools";
import { getDB } from "../database/database";
import { connectivityCheck } from "../largeLanguageModels/oneApi";
import { dbRowsToArray, dbRowsToObjs } from "../translate/translateServices";
import { getDom, makeId } from "./uiTools";

export async function llmSettings() {
    const doc = addon.data.prefs?.window?.document;
    const win = addon.data.prefs?.window;
    if (!doc || !win) {
        return;
    }

    const llms = await getLLMs();
    const providers: string[] = llms.map((llm: any) => llm.provider);
    //LLM
    const providersArr = providers.map((e) => ({
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

    fillModel();
    getDom("providers")?.addEventListener("command", (e) => {
        const test = "test";
        fillModel();

    });

    getDom("providerCustom")!.addEventListener("change", (e) => {
        //@ts-ignore xxx
        const custom = e.target?.value as string;
        const provider = (getDom("providers") as XUL.MenuList).value;
        if (custom != "" && custom != provider) {
            const provider = getDom("providers");
            provider?.setAttribute('value', custom);
            provider?.setAttribute('label', custom);
            clearInput();
        }
    });
    getDom("connectivityCheck")!.addEventListener("command", async (e: Event) => {
        const llm = await getCurrenLLM();
        if (await connectivityCheck(llm)) {
            ztoolkit.UI.insertElementBefore({
                tag: "button",
                namespace: "html",
                id: "pass",
                properties: {
                    innerHeight: getString("info-pass"),
                }
            }, e.target as HTMLElement);
        }
    });

    win.addEventListener("click", async (e: Event) => {

        const idsufixs = ["providers", "providerCustom", "apikey", "baseurl", "models", "defaultModel"];
        //@ts-ignore has
        const id = e.target?.id;
        if (id) {
            const condition = idsufixs.some((sufix: string) => id.endsWith(sufix));
            if (condition) return;
        }
        if (isAllInputFilled()) {
            await saveLLMData();
        }
    });
    win.addEventListener("beforeunload", (e: Event) => {
        if (isAllInputFilled()) {
            saveLLMData();
        }
    });


}
async function saveLLMData() {
    const values = [];
    for (const id of ["providers", "apikey", "baseurl", "models", "defaultModel"]) {
        const elem = getDom(id) as HTMLInputElement;
        values.push(elem.value);
    }
    await llmToDatabase(values);
}

function isAllInputFilled() {

    for (const id of ["providerCustom", "apikey", "baseurl", "models", "defaultModel"]) {
        const elem = getDom(id) as HTMLInputElement;
        if (!elem.value || elem.value == '') return false;
    }
    return true;
}


function clearInput() {
    ["apikey", "baseurl", "models", "defaultModel"].forEach((key) => {
        inputFill(key, '');
    });
}

export async function getLLMs() {
    const DB = await getDB();
    const sqlColumns = ["provider", "apikey", "baseurl", "models", "defaultModel"];
    const tableName = "largeLanguageModels";

    const sql = `SELECT ${sqlColumns.join(", ")} FROM ${tableName}`;
    const rows = await DB!.queryAsync(sql);
    if (!rows.length) {
        const llmArr = await openAIAndOllamIntoDB();
        return llmArr;
    }
    const llms = dbRowsToObjs(rows, sqlColumns) as any[];
    return llms;
}

async function llmToDatabase(sqlValues: string[]) {
    const DB = await getDB();
    if (!DB) return;
    const tableName = "largeLanguageModels";
    const sqlColumns = ["provider", "apikey", "baseurl", "models", "defaultModel"];
    let sql = `SELECT * FROM ${tableName} WHERE provider='${sqlValues[0]}'`;
    const result: any[] = await DB.queryAsync(sql);
    if (result.length === 0) {
        const serialNumber = await DB.getNextID(tableName, "serialNumber");
        sqlColumns.unshift('serialNumber');
        sqlValues.unshift(serialNumber);
        sql = `INSERT INTO ${tableName} (${sqlColumns.join(",")}) VALUES (${sqlValues.map(() => "?").join()})`;
        await DB.executeTransaction(async () => {
            await DB.queryAsync(sql, sqlValues);
        });
    } else {
        //假设每个厂家一个秘钥
        const resultArr = dbRowsToArray(result, sqlColumns)[0];
        if (!arrayUtils.isDiffer(resultArr, sqlValues)) return;//数据均相同则返回，否则更新变化的数据
        sql = `UPDATE ${tableName} SET `;
        const tempArr: string[] = [];
        for (let i = 1; i < sqlColumns.length; i++) {
            if (result[i] == sqlValues[i]) continue;
            tempArr.push(`${sqlColumns[i]} = '${sqlValues[i]}'`);
        }
        sql = sql + tempArr.join(', ') + ` WHERE provider='${sqlValues[0]}'`;
        await DB.executeTransaction(async () => {
            await DB.queryAsync(sql);
        });
    }



}

async function fillModel() {
    const llm = await getCurrenLLM();
    Object.keys(llm).forEach((key) => {
        inputFill(key, llm[key]);
    });
}

async function getCurrenLLM() {
    const llms = await getLLMs();
    const provider = (getDom("providers") as XUL.MenuList).value;
    const llm = llms.filter((llm: any) => llm.provider === provider)[0];
    return llm;
}

function inputFill(id: string, value: string) {
    if (id == "serialNumber") return;
    if (id == "provider") id = "providerCustom";
    if (id == "models") {
        const reg = /[# \t,;@，；]+/;
        value = value.split(reg).join("; ");
    }
    const elem = getDom(id) as HTMLInputElement;
    elem.value = value;
}

async function openAIAndOllamIntoDB() {
    const openAIModels = ["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo"];
    const modelsStr = openAIModels.join("; ");
    let values = ["openAI", "sk-", "https://api.openai.com/v1", modelsStr, "gpt-3.5-turbo"];
    await llmToDatabase(values);
    const tempArr = [[...values]];
    const tempFunc = arrsToObjs(["provider", "apikey", "baseurl", "models", "defaultModel"]);
    values = ["ollama", "", "https://127.0.0.1:11434", "", ""];
    await llmToDatabase(values);
    tempArr.push([...values]);
    return tempFunc(tempArr);

}






