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
const ftlReg = /^([^ =\n]+)\s?=/gm;
const ftlDir = "addon/locale";
const htmlReg = /(data-l10n-id)="(\S*)"/g;
const htmlDir = "addon/chrome";

const phraseInHTML = findInXHTML();

phraseInHTML.forEach((value, filePath) => {
  Logger.info(["filePath"], filePath);
  const names = value.ftlFiles.map((name) => name.split(".")[0]);
  //Logger.info("names", names);
  const ftlPhrase = findInFiles(ftlDir, ftlReg, 1, names, "ftl");
  //Logger.info("ftlPhrase", ftlPhrase);
  const sets = [...ftlPhrase.values()];
  //Logger.info("sets", sets);
  sets.forEach((set) => {
    set.forEach((value) => {
      sets.forEach((set2) => {
        if (set2 !== set) {
          if (!set2.has(value)) {
            let setPath, set2Path;
            Logger.info(`[set2 not has(value): ${value}]`);
            ftlPhrase.forEach((v, k) => {
              if (v === set2) set2Path = k;
              if (v === set) setPath = k;
            });
            Logger.info(`[setPath: ${setPath}]`);
            Logger.info(`[set2Path: ${set2Path}]`);
            const dir = path.dirname(path.dirname(setPath));
            const localeLang1 = path.dirname(setPath).split(path.sep).pop();
            const localeLang2 = path.dirname(set2Path).split(path.sep).pop();
            Logger.info(`[dir: ${dir}]`);
            Logger.info(
              `'${value}' in ${localeLang1} not find in ${localeLang2}`,
            );
            Logger.info(` =======================`);
          }
        }
      });
    });
  });
  Logger.info(` =======================`);
});

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
  const phrases = new Map();
  if (!Array.isArray(dir)) dir = [dir];
  const files = new Set();
  dir.forEach((d) => {
    getFilePaths(d, names, exts).forEach((file) => {
      files.add(file);
    });
  });
  files.forEach((filePath) => {
    findInOneFile(filePath, reg, index, phrases);
  });
  return phrases;
}

function findInOneFile(filePath, reg, index, map) {
  const content = readFileSync(filePath, "utf-8");
  const matchs = [...content.matchAll(reg)];
  const phrase = matchs.map((match) => match[index]);
  if (!map) return new Map([[filePath, new Set(phrase)]]);
  if (!phrase.length) return;
  map.set(filePath, new Set(phrase));
}

function findInXHTMLOld() {
  const filesHTML = getFilePaths(localesPath, exts);
  const phraseInHTML = new Map();
  filesHTML.forEach((htmlFilePath) => {
    const html = readFileSync(htmlFilePath, "utf-8");
    const ftlFiles = [...html.matchAll(/(\w+\.ftl)"\s?\/>/g)].map((m) => m[1]); //不指定 "utf-8" 则返回 buffer
    const matchs = [...html.matchAll(/(data-l10n-id)="(\S*)"/g)];
    const phrase = matchs.map((match) => match[2]);
    const temp = { ftlFiles, phrase: new Set(phrase) };
    phraseInHTML.set(htmlFilePath, temp);
  });
  return phraseInHTML; //Logger.info 可以显示 buffer 内容
}

function findInXHTML() {
  const filesHTML = findPaths(htmlDir)()("xhtml");
  const phraseInHTML = new Map();
  filesHTML.forEach((htmlFilePath) => {
    const html = readFileSync(htmlFilePath, "utf-8");
    const ftlFiles = [...html.matchAll(/(\w+\.ftl)"\s?\/>/g)].map((m) => m[1]); //不指定 "utf-8" 则返回 buffer
    const matchs = [...html.matchAll(/(data-l10n-id)="(\S*)"/g)];
    const phrase = matchs.map((match) => match[2]);
    const temp = { ftlFiles, phrase: new Set(phrase) };
    phraseInHTML.set(htmlFilePath, temp);
  });
  return phraseInHTML; //Logger.info 可以显示 buffer 内容
}
/**
 *
 * @param {string} dir
 * @param {string[]} exts option
 * @param {string[]} names option
 * @returns
 */
function getFilePaths(dir, names, exts) {
  if (exts && !Array.isArray(exts)) exts = [exts];
  if (names && !Array.isArray(names)) names = [names];
  const allfiles = new Set();
  const dirs = readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.path + "\\" + dirent.name);
  for (const path of dirs) {
    const files = readdirSync(path, { withFileTypes: true })
      .filter((dirent) =>
        dirent.isFile() && names
          ? names.some((name) => dirent.name.startsWith(name))
          : true && exts
            ? exts.some((ext) => dirent.name.endsWith(ext))
            : true,
      )
      .map((dirent) => dirent.path + "\\" + dirent.name);
    files.forEach((filePath) => {
      allfiles.add(filePath);
    });
  }
  return allfiles;
}

/**
 * - 可立 函数，不传参数返回结果，参数没有值时传入 undefined
 * - 例：const res = findPaths(ftlDir)(undefined)()
 * @param {string} dir 目录
 * @param {string|string[]|undefined} names 文件名，可选
 * @param {string|string[]|undefined} exts 扩展名，可选
 * @returns
 */
function findPaths(dir) {
  const dirs = readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.path + "\\" + dirent.name);

  return getNames;
  /**
   *
   * @param {string|string[]|undefined} names 文件名，可选
   * @returns
   */
  function getNames(names) {
    //if (arguments.length === 0) return finalAction(dirs);
    if (names && !Array.isArray(names)) names = [names];
    return getExts;
    /**
     *
     * @param {string|string[]|undefined} exts 扩展名，可选
     * @returns
     */
    function getExts(exts) {
      let condition = () => true;
      if (names != void 0) {
        condition = (dirent) =>
          names.some((name) => dirent.name.startsWith(name));
      }
      if (arguments.length === 0 || exts == void 0) {
        return finalAction(dirs, condition);
      }

      if (!Array.isArray(exts)) exts = [exts];

      const conditionTwo = (dirent) =>
        condition(dirent) && exts.some((ext) => dirent.name.endsWith(ext));

      return finalAction(dirs, conditionTwo);
    }
  }

  /**
   *
   * @param {string} dirs
   * @param {Function} condition
   * @returns
   */
  function finalAction(dirs, condition = () => true) {
    const allfiles = new Set();
    for (const path of dirs) {
      const files = readdirSync(path, { withFileTypes: true })
        .filter((dirent) => dirent.isFile() && condition(dirent))
        .map((dirent) => dirent.path + "\\" + dirent.name);
      files.forEach((filePath) => {
        allfiles.add(filePath);
      });
    }
    return allfiles;
  }
}
