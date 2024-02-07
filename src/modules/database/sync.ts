import { addonDir } from "../../utils/constant";
import { saveJsonToDisk, zipFile } from "../../utils/tools";

class Datasync {
    constructor() {

    }

    getUnsyncObj() {
        const obj = {
            test: "zip"
        };
        return obj;




    }

    jsonForZFS() {
        //控制大小
        const obj = this.getUnsyncObj();
    }
    async zipForWebDav() {
        //根据同步时间获取未同步对象
        const obj = this.getUnsyncObj();
        const dir = PathUtils.join(addonDir, "sync");
        const fileName = String(new Date().getTime());
        const path = await saveJsonToDisk(obj, fileName, dir);
        const zipPath = PathUtils.join(dir, fileName + ".zip");

        const zipUnsync = zipFile(path, zipPath);
    }

    upload(option: any) {
        this.syncWebDav();
        this.syncZFS();
    }
    download(option: any) {

    }

    syncWebDav() {

    }
    syncZFS() {

    }
    jsonFromZip(zipFile: string) {

        return JSON.stringify({
            test: "zip"
        });
    }
    jsonDownload() {

    }

    saveData() {

    }

}

export const DBsync = new Datasync();
