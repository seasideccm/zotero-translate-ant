import {
    existsSync,
    lstatSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from "fs";
import path from "path";
import { Logger } from "./utils.mjs";

//files: [`addon/**/*.xhtml`, `addon/**/*.html`],

//input.matchAll(/^([^ =]+)\s?=/gim) files: [`addon/locale/**/*.ftl`]
const ftlReg = /^([^ =]+)\s?=/gim
const ftlDir = "addon/locale"
const htmlReg = /(data-l10n-id)="(\S*)"/g
const htmlDir = "addon/chrome"


/**
 * 
 * @param {string|string[]} dir 
 * @param {RegExp} reg 
 * @param {number} index 正则表达式匹配结果数组的序号，即要获取的结果
 * @param {string|string[]|undefined} names 可选
 * @param {string|string[]|undefined} exts 可选
 * @returns 
 */
function findInFiles(dir, reg, index, names, exts) {
    const phrases = new Map()
    if (!Array.isArray(dir)) dir = [dir]
    const files = new Set()
    dir.forEach(d => {
        getFilePaths(d, names, exts).forEach(file => { files.add(file) })
    })
    files.forEach((filePath) => {
        findInOneFile(filePath, reg, index, phrases)
    });
    return phrases;
}

function findInOneFile(filePath, reg, index, map) {
    const content = readFileSync(filePath, "utf-8");
    const matchs = [...content.matchAll(reg)];
    const phrase = matchs.map((match) => match[index]);
    if (!map) return new Map([
        [filePath, new Set(phrase)]
    ])
    if (!phrase.length) return
    map.set(filePath, new Set(phrase))
}

/**
 * 
 * @param {string} dir 
 * @param {string[]} exts option
 * @param {string[]} names option
 * @returns 
 */
function getFilePaths(dir, names, exts) {
    if (exts && !Array.isArray(exts)) exts = [exts]
    if (names && !Array.isArray(names)) names = [names]
    Logger.info("names:", names, "exts", exts)
    const allfiles = new Set();
    const dirs = readdirSync(dir, { withFileTypes: true, recursive: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.path + "\\" + dirent.name);
    for (const path of dirs) {
        const files = readdirSync(path, { withFileTypes: true, })
            .filter((dirent) => dirent.isFile() &&
                names ? names.some((name) => dirent.name.startsWith(name)) : true &&
                exts ? exts.some((ext) => dirent.name.endsWith(ext)) : true)
            .map((dirent) => dirent.path + "\\" + dirent.name);
        files.forEach((filePath) => {
            allfiles.add(filePath);
        });
    }
    Logger.info("allfiles:", allfiles.size)
    return allfiles;
}
const phraseInHTML = findInFiles(htmlDir, htmlReg, 2, undefined, 'xhtml');
//const phraseInFTL = findInFTL();
//const phraseInTS = findInFiles("src", ["ts"], /getString\(["'](\S*)["']\)/g, 1)
/* for (let item of phraseInTS.entries()) {
    Logger.info(item[0], item[1])
} */
//phraseInTS.forEach((v, k) => { Logger.info(k, v.size) }) //注意，回调函数第一个参数是value

//const addonPhrase = findInFiles('addon/locale', ftlReg, 1)
Logger.info(phraseInHTML)
writeFileSync("logXXXXXX.txt", JSON.stringify(phraseInHTML))


function findInXHTML() {
    const MessagesInHTML = new Set();
    const localesPath = "addon/chrome";
    const exts = ["xhtml", "html"];
    const filesHTML = getFilePaths(localesPath, exts);
    const phraseInHTML = new Map()
    filesHTML.forEach((htmlFilePath) => {
        const html = readFileSync(htmlFilePath, "utf-8");
        const ftlFiles = [...html.matchAll(/(\w+\.ftl)"\s?\/>/g)].map(m => m[1]) //不指定 "utf-8" 则返回 buffer
        const matchs = [...html.matchAll(/(data-l10n-id)="(\S*)"/g)];
        const phrase = matchs.map((match) => match[2]);
        /* {
            MessagesInHTML.add(match[2]);
            return match[2]
        } */
        const temp = { ftlFiles: ftlFiles, phrase: new Set(phrase) }
        phraseInHTML.set(htmlFilePath, temp)
    });
    //Logger.info(`MessagesInHTML length: ${MessagesInHTML.size} `);
    return phraseInHTML; //Logger.info 可以显示 buffer 内容
}

function findInFTL() {
    const MessagesInFTL = new Set();
    const localesPath = `addon/locale`;
    const exts = ["ftl"];
    const filesFTL = getFilePaths(localesPath, exts);
    const phraseInFTL = new Map()

    filesFTL.forEach((FilePath) => {
        const localeName = path.dirname(FilePath).split(path.sep).pop();
        const basename = path.basename(FilePath);
        const localeMessagesInFTL = new Set();
        const content = readFileSync(FilePath, "utf-8"); //不指定 "utf-8" 则返回 buffer
        const matchs = [...content.matchAll(/^([^ =]+)\s?=/gim)];
        const phrase = matchs.map((match) => match[1]);
        //{
        //MessagesInFTL.add(match[1]);
        /* if (!MessagesInHTML.has(match[1])) {
            Logger.info(
                `[checkFTL] ${match[1]} in ${localeName} of ${basename} don't exist in xhtml file`,
            );
        } */
        // return match[1]
        // }

        /* MessagesInHTML.forEach((message) => {
            if (!localeMessagesInFTL.has(message)) {
                Logger.info(`[checkFTL] ${message} don't exist in ${localeName}`);
            }
        }); */
        const temp = { phrase: new Set(phrase) }
        phraseInFTL.set(FilePath, temp)
    });
    //Logger.info(`MessagesInFTL length: ${MessagesInFTL.size} `); //Logger.info 可以显示 buffer 内容
    return phraseInFTL
}