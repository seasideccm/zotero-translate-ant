import { franc } from "franc-min";
import { getDB } from "../database";
import { config } from "../../../package.json";

export class Translation {
    // 定义翻译的字段
    translateID: number | null;
    sourceTextID: number | null;
    sourceText: string;
    targetText: string;
    targetTextID: number | null;
    originID: number | null;
    originKey: string | null;
    originLibraryID: number | null;
    dateAdded: string | null;
    dateModified: string | null;
    translateMode: string | null;
    score: number | null;
    targetlangCode: string | null;
    sourceLangCode: string | null;
    writeTable: any | null;

    constructor(options: any) {
        this.translateID = options.translateID || null;
        this.sourceTextID = options.sourceTextID || null;
        this.sourceText = options.sourceText;
        this.targetText = options.targetText;
        this.targetTextID = options.targetTextID || null;
        this.originID = options.originID || null;
        this.originKey = options.originKey || null;
        this.originLibraryID = options.originLibraryID || null;
        this.dateAdded = options.dateAdded || null;
        this.dateModified = options.dateModified || null;
        this.translateMode = options.translateMode || null;
        this.score = options.score || null;
        this.targetlangCode = options.langCode || franc(this.targetText) || '';
        this.sourceLangCode = options.langCode || franc(this.sourceText) || '';

    }


    makeQuerySQL() {

    }
    async save() {
        const DB = await getDB();
        if (!DB) return;
        await DB.executeTransaction(async () => {
            async function insert(tableName: string, sqlColumns: string[], sqlValues: any[]) {
                const sql = `INSERT INTO ${tableName} (${sqlColumns.join(',')}) VALUES (${sqlValues.map(() => "?").join()})`;
                try {
                    await DB.queryAsync(sql, sqlValues);
                }
                catch (e: any) {
                    if (e.message && e.message.includes("UNIQUE constraint")) {
                        //如果错误是唯一性约束，则继续
                        ztoolkit.log(e);
                    } else {
                        throw (e);
                    }
                }
            }

            async function valueQuery(tableName: string, valueField: string, queryField: string, queryValue: any) {
                const valueSQL = `SELECT ${valueField} FROM ${tableName} WHERE ${queryField}=?`;
                let value;
                try {
                    value = await DB.valueQueryAsync(valueSQL, [queryValue], { debug: true });
                }
                catch (e: any) {
                    ztoolkit.log(e);
                }
                return value;
            }

            let sqlValues = [this.sourceLangCode as string, this.sourceText];
            await insert("sourceText", ["langCode", "sourceText"], sqlValues);





            /* let queryField = "sourceText";
            let valueField = "sourceTextID";
            let valueSQL = `SELECT ${valueField} FROM ${tableName} WHERE ${queryField}=?`;
            let value = await DB.valueQueryAsync(valueSQL, [this.sourceText], { debug: true }); */
            this.sourceTextID = await valueQuery("sourceText", "sourceTextID", "sourceText", this.sourceText);


            sqlValues = [this.targetlangCode as string, this.targetText];
            await insert("targetText", ["langCode", "targetText"], sqlValues);


            /* queryField = "targetText";
            valueField = "targetTextID";
            valueSQL = `SELECT ${valueField} FROM ${tableName} WHERE ${queryField}=?`;
            value = await DB.valueQueryAsync(valueSQL, [this.targetText], { debug: true }); */
            this.targetTextID = await valueQuery("targetText", "targetTextID", "targetText", this.targetText);

        }
        );
        const testConn = DB;
    }

}

export async function testClass() {
    const firstTranslation = new Translation({
        sourceText: "Franc has been ported to several other programming languages.",
        targetText: "Franc 库已移植到多种编程语言上。",
    });
    ztoolkit.log("firstTranslation",
        firstTranslation
    );
    await firstTranslation.save();
}



//Zotero.DB.transactionDateTime 		//let insertValueSQL = "INSERT INTO itemDataValues VALUES (?,?)";
//let replaceSQL = "REPLACE INTO itemData VALUES (?,?,?)";

/* 
async function writeTableTest(tableName: string, sqlColumns: string[], sqlValues: any[], attrQuery: string, attrGet: string) {
    try {

        const sql = `INSERT INTO ${tableName} (${sqlColumns.join(',')}) VALUES (${sqlValues.map(() => "?").join()})`;
        await DB.queryAsync(sql, sqlValues);
    }
    catch (e: any) {
        if (e.message && e.message.includes("UNIQUE constraint")) {
            //如果错误是唯一性约束，则继续
            ztoolkit.log(e);
        } else {
            throw (e);
        }
    }
    const valueSQL = `SELECT ${attrGet} FROM ${tableName} WHERE value=?`;
    const value = await DB.valueQueryAsync(valueSQL, [attrQuery], { debug: true });
    this[attrGet] = value;
    if (!this[attrGet]) throw (`error: query ${attrQuery} didn't get value of ${attrGet}`);

}
const writeTable = writeTableTest.bind(this);

await writeTable("sourceText", ["langCode", "sourceText"], [this.sourceLangCode as string, this.sourceText], this.sourceText, "sourceTextID");

await writeTable("targetText", ["langCode", "targetText"], [this.targetlangCode as string, this.targetText], this.targetText, "targetTextID"); */