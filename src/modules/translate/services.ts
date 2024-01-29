/**
 * 翻译引擎
 */
export class TranslateService {
    id: string;
    charasPerTime: number;
    QPS: number;
    limitMode: string;
    charasLimit: number;
    isMultiParas: boolean;
    hasSecretKey: boolean;
    secretKey?: {
        key: string,
        usable: boolean,
        charConsum: number,
        dateMarker?: string,
    }[];
    forbidden?: boolean;
    /**
     * 
     * @param id 
     * @param charasPerTime 
     * @param QPS 
     * @param limitMode 
     * @param charasLimit 
     * @param isMultiParas 
     * @param hasSecretKey 
     * @param secretKey 
     */
    constructor(id: string, charasPerTime: number, QPS: number, limitMode: string, charasLimit: number,
        isMultiParas: boolean, hasSecretKey: boolean, secretKey?:
            {
                key: string,
                usable: boolean,
                charConsum: number,
            }[],
        forbidden?: boolean) {
        this.id = id,
            this.charasPerTime = charasPerTime,
            this.QPS = QPS,
            this.limitMode = limitMode,
            this.charasLimit = charasLimit,
            this.isMultiParas = isMultiParas,
            this.hasSecretKey = hasSecretKey,
            this.secretKey = secretKey;
        this.forbidden = forbidden;
    }

    //个人数据保存至 database，公共数据保存至 github（共享）和 database
    initSave = Zotero.Promise.coroutine(function* (env) {

    });
    saveData() {

    }

    finalizeSave = Zotero.Promise.coroutine(function* (env) { });

}

const baidu = new TranslateService("baidu", 5000, 10, "month", 1000000, false, true);
const baidufield = new TranslateService("baidufield", 5000, 10, "month", 500000, false, true);
const tencent = new TranslateService("tencent", 5000, 5, "month", 5000000, true, true);
const niutranspro = new TranslateService("niutranspro", 5000, 50, "daily", 200000, true, true);
const caiyun = new TranslateService("caiyun", 5000, 50, "month", 1000000, false, true);
const youdaozhiyun = new TranslateService("youdaozhiyun", 5000, 200, "total", 500000, false, true);
const cnki = new TranslateService("cnki", 1000, 5, 'noLimit', 0, false, false);
const googleapi = new TranslateService("googleapi", 5000, 5, 'noLimit', 0, true, false);
const google = new TranslateService("google", 5000, 5, 'noLimit', 0, true, false);
const deeplfree = new TranslateService("deeplfree", 3000, 3, "month", 500000, true, true);
const deeplx = new TranslateService("deeplx", 3000, 3, "month", 500000, true, false);
const microsoft = new TranslateService("microsoft", 50000, 10, "month", 2000000, false, true);
const gpt = new TranslateService("gpt", 800, 2, "money", 0, false, true);
const baiduModify = new TranslateService("baiduModify", 5000, 10, "month", 1000000, true, true);
const baidufieldModify = new TranslateService("baidufieldModify", 5000, 10, "month", 500000, true, true);
const tencentTransmart = new TranslateService("tencentTransmart", 5000, 20, "noLimit", 0, false, false);
const haici = new TranslateService("haici", 600, 10, "noLimit", 0, false, false);
const youdao = new TranslateService("youdao", 2000, 5, "noLimit", 0, false, false);




export interface ServiceMap {
    [serviceID: string]: TranslateService;
}


const servicesDefault: ServiceMap =
{
    baidu,
    baidufield,
    tencent,
    niutranspro,
    caiyun,
    youdaozhiyun,
    cnki,
    googleapi,
    google,
    deeplfree,
    deeplx,
    microsoft,
    gpt,
    baiduModify,
    baidufieldModify,
    tencentTransmart,
    haici,
    youdao,
};


const services = servicesDefault;
export { services }


