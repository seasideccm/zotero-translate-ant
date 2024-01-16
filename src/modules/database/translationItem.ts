import { franc } from "franc-min";
import { initDB } from "../database";


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
        const DB = await initDB();
        if (!DB) return;
        await DB.executeTransaction(async () => {
            async function insert(tableName: string, sqlColumns: string[], sqlValues: any[]) {
                const sql = `INSERT OR IGNORE INTO ${tableName} (${sqlColumns.join(',')}) VALUES (${sqlValues.map(() => "?").join()})`;
                try {
                    await DB.queryAsync(sql, sqlValues);
                }
                catch (e: any) {
                    if (e.message && e.message.includes("UNIQUE constraint")) {
                        //如果错误是唯一性约束，则继续
                        ztoolkit.log("Item already exists");
                    } else {
                        throw (e);
                    }
                }
            }

            function querySQL(tableName: string, valueField: string, queryField: string, queryValue: any) {
                return `SELECT ${valueField} FROM ${tableName} WHERE ${queryField}=?`;
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
            //insert sourceText
            let sqlValues: any[] = [this.sourceLangCode, this.sourceText];
            await insert("sourceText", ["langCode", "sourceText"], sqlValues);
            this.sourceTextID = await valueQuery("sourceText", "sourceTextID", "sourceText", this.sourceText);
            //insert targetText
            sqlValues = [this.targetlangCode as string, this.targetText];
            await insert("targetText", ["langCode", "targetText"], sqlValues);
            this.targetTextID = await valueQuery("targetText", "targetTextID", "targetText", this.targetText);
            // insert translation
            sqlValues = [this.sourceTextID, this.targetTextID];
            await insert("translation", ["sourceTextID", "targetTextID"], sqlValues);
            this.translateID = await valueQuery("translation", "translateID", "targetTextID", this.targetTextID);

            const valueSQL = `SELECT translateID FROM translation WHERE targetTextID=${this.targetTextID} AND sourceTextID=${this.sourceTextID}`;
            try {
                this.translateID = await DB.valueQueryAsync(valueSQL);
            }
            catch (e: any) {
                ztoolkit.log(e);
            }

            //最后一条记录
            //this.translateID = await DB.valueQueryAsync("SELECT translateID FROM translation ORDER BY translateID DESC LIMIT 1");
            // insert translationOrigin
            sqlValues = [this.translateID, this.originID, this.originKey, this.originLibraryID];
            await insert("translationOrigin", ["translateID", "originID", "originKey", "originLibraryID"], sqlValues);


        }
        );
        await DB.closeDatabase();
    }

}

export async function testClass() {
    const firstTranslation = new Translation({
        sourceText: "Franc has been ported to several other programming languages.",
        targetText: "Franc 库已移植到多种编程语言上。",
        originID: 1423,
        originKey: "HHKKLL",
        originLibraryID: 1


    });
    ztoolkit.log("firstTranslation",
        firstTranslation
    );
    const DB = await initDB();
    //await firstTranslation.save();
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