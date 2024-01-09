import { franc } from "franc-min";
import { getDB } from "../database";

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
    async save() {
        const DB = await getDB();
        if (!DB) return;
        await DB.executeTransaction(async () => {
            let sqlColumns = ["langCode", "sourceText"];
            let sqlValues = [this.sourceLangCode as string, this.sourceText];
            let tableName = "sourceText";
            let sql = `INSERT INTO ${tableName} (${sqlColumns.join(',')}) VALUES (${sqlValues.map(() => "?").join()})`;

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

            let fieldName = "sourceText";
            let valueSQL = `SELECT ${fieldName} FROM ${tableName} WHERE value=?`;
            let value = await DB.valueQueryAsync(valueSQL, [this.sourceText], { debug: true });
            this[fieldName as keyof typeof this] = value;

            sqlColumns = ["langCode", "targetText"];
            sqlValues = [this.targetlangCode as string, this.targetText];
            tableName = "targetText";
            sql = `INSERT INTO ${tableName}  (${sqlColumns.join(',')}) VALUES (${sqlValues.map(() => "?").join()})`;
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


            fieldName = "targetText";
            valueSQL = `SELECT ${fieldName} FROM ${tableName} WHERE value=?`;
            value = await DB.valueQueryAsync(valueSQL, [this.targetText], { debug: true });
            this[fieldName as keyof typeof this] = value;

        }
        );
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