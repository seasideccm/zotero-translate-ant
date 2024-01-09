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
    langCode: string | null;

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
        this.langCode = options.langCode || null;
        this.langCode = options.langCode || null;
    }
    async save() {
        const DB = await getDB();
        if (!DB) return;
        await DB.executeTransaction(async () => {
            try {
                const tableName = "sourceText";
                const sqlColumns = ["langCode", "sourceText"];
                if (!this.langCode) {
                    this.langCode = franc(this.sourceText) || "notKnown";
                }
                const sqlValues = [this.langCode, this.sourceText];
                const sql = `INSERT INTO ${tableName} (${sqlColumns.join(',')}) VALUES (${sqlValues.map(() => "?").join()})`;

                await DB.queryAsync(sql, sqlValues);
            }
            catch (e) {
                ztoolkit.log(e);
            }
        }
        );
    }
}

export async function testClass() {
    const firstTranslation = new Translation({
        sourceText: "test Class Translation",
        targetText: "测试译文类"
    });
    ztoolkit.log("firstTranslation",
        firstTranslation
    );
    await firstTranslation.save();
}



//Zotero.DB.transactionDateTime 