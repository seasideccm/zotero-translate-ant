


export async function tencentTransmart(sourceText: string, sourceLang?: string, targetLang?: string) {
    if (sourceLang === undefined || sourceLang == "" || sourceLang == null) {
        sourceLang = "en";
    }
    if (targetLang === undefined || targetLang == "" || targetLang == null) {
        targetLang = "zh";
    }
    const client_key = "browser-chrome-114.0.0-Windows 10-6c02f83c-d2d9-4a75-bed4-51e2ccb12be3-1689464307304";



    let textList;
    if (sourceText.includes('\n')) {
        textList = sourceText.split("\n");

    } else {
        textList = [sourceText];
    }

    const payload = {
        "header": {
            "fn": "auto_translation",
            "client_key": client_key
        },
        "type": "plain",
        "model_category": "normal",
        "text_domain": "general",
        "source": {
            "lang": sourceLang,
            "text_list": textList,
        },
        "target": {
            "lang": targetLang
        }
    };



    const xhr = await Zotero.HTTP.request(
        "POST",
        `https://yi.qq.com/api/imt`,
        {
            headers: {
                "referer": "https://yi.qq.com/zh-CN/index",
                "content-type": "application/json",
            },
            body: JSON.stringify(payload),
            responseType: "json",
        });

    if (xhr?.status !== 200) {
        throw `Request error: ${xhr?.status}`;
    }
    // Parse
    if (xhr.response.header.ret_code.includes("Error")) {
        throw `Service error: ${xhr.response.header.ret_code}:${xhr.response.message}`;
    }
    let transResult = xhr.response.auto_translation;
    if (transResult.length > 1) {
        transResult = transResult.join("\n");
    } else {
        transResult = transResult[0];
    }

    const data = {
        "result": transResult,
        "error": `${xhr.response.header.ret_code}`
    };
    return data;
}


export async function queryLanguage(sourceText: string) {
    const client_key = "browser-chrome-114.0.0-Windows 10-6c02f83c-d2d9-4a75-bed4-51e2ccb12be3-1689464307304";
    let queryLanguageTxt = '';
    if (sourceText.length > 500) {
        queryLanguageTxt = sourceText.substring(0, 500);
    } else {
        queryLanguageTxt = sourceText;
    }
    const payload = {
        "header": {
            "fn": "text_analysis",
            "client_key": client_key
        },

        "text": queryLanguageTxt,
        "type": "plain",
        "normalize": { "merge_broken_line": false, },
    };
    const xhr = await Zotero.HTTP.request(
        "POST",
        `https://yi.qq.com/api/imt`, {
        headers: {
            "referer": "https://yi.qq.com/zh-CN/index",
            "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        responseType: "json",
    });
    if (xhr?.status !== 200) {
        throw `Request error: ${xhr?.status}`;
    }
    if (xhr.response.header.ret_code.includes("Error")) {
        throw `Service error: ${xhr.response.header.ret_code}:${xhr.response.message}`;
    }
    const sourceLang = xhr.response.language as string;
    return sourceLang;
}