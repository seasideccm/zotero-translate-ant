import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  appendFileSync,
} from "fs";
import * as os from "os";
import path from "path";
import { Logger } from "./utils.mjs";

//files: [`addon/**/*.xhtml`, `addon/**/*.html`],

//input.matchAll(/^([^ =]+)\s?=/gim) files: [`addon/locale/**/*.ftl`]
const ftlReg = /^([^ =\n]+)\s?=/gm;
const ftlDir = "addon/locale";
const htmlReg = /(data-l10n-id)="(\S*)"/g;
const tsReg = /getString\([ '"]+([^ \n'"]+)[ '"]+\)/g;
const htmlDir = "addon/chrome";
const doubleLine = `================================================\n`;
const singleLine = `-------------------------------------------------\n`;
const infoDate = `${new Date()}\n`;
const infoDateDoubleLine = `${new Date()}\n${doubleLine}`;
const logPath = "l10nDifflog.txt";

const infoInitiate = [
  `\n\n${doubleLine}${infoDateDoubleLine}Begin Check l10n Phrase In XHTML, FTL Or Src Files.\n`,
];
Logger.info(`${infoInitiate}`);

const phraseInHTML = findInXHTML();
phraseInHTML.forEach((value, filePath) => {
  const infos = [infoInitiate];
  infos.push(`\n[xHTML Path: ${filePath}]\n`);
  const names = value.ftlFiles.map((name) => name.split(".")[0]); // xHTML 文件使用的 FTL 文件名
  const ftlPhrase = findInFiles(ftlDir, ftlReg, 1, names, "ftl"); // 根据文件名查找 FTL 文件中的短语
  const infosss = compareFTLPhrase(ftlPhrase); // FTL 文件两两比较
  infosss && infos.push(...infosss);
  let infoss = [`XHTML 文件中的短语是否存在于 FLT 文件中`];
  const xtmlName = path.basename(filePath).split(".")[0];
  if (value.ftlFiles.some((name) => name.startsWith(xtmlName))) {
    value.phrase.forEach((phrase) => {
      const sets = [...ftlPhrase.values()];
      sets.forEach((set) => {
        if (!set.has(phrase)) {
          const ftlLangDir = langDir(ftlPhrase, set);
          infoss.push(
            `The phrase "${phrase}" in the XHTML file is not in the  ${ftlLangDir.lang} FTL file`,
          );
          infoss.push(`XHTML: ${filePath}`);
          infoss.push(`FTL  : ${ftlLangDir.dir}`);
        }
      });
    });
    if (infoss.length > 1) {
      infoss.push(infoDateDoubleLine);
      infos.push(...infoss);
    }
  }
  // FLT 文件中的短语是否存在于 XHTML 文件中
  infoss = [`FLT 文件中的短语是否存在于 XHTML 文件中`];
  ftlPhrase.forEach((set, filePath) => {
    let phrases = [];
    set.forEach((phrase) => {
      if (!value.phrase.has(phrase)) {
        phrases.push(phrase);
      }
    });
    if (phrases.length) {
      const ftlLangDir = langDir(ftlPhrase, set);
      infoss.push(
        `The phrase "${phrases}" in the  ${ftlLangDir.lang} FTL file is not in the XHTML file`,
      );
      infoss.push(`FTL  : ${ftlLangDir.filePath}`);
      infoss.push(infoDateDoubleLine);
      infos.push(...infoss);
    }
  });
  infos.push(infoDateDoubleLine);
  logInfo(infos);
});

const phraseInTS = findInSRC();
phraseInTS.forEach((value, filePath) => {
  const infos = [];
  infos.push(`\n[Src Path: ${filePath}]\n`);
  const ftlPhrase = findInFiles(ftlDir, ftlReg, 1, "addon", "ftl");
  const infosss = compareFTLPhrase(ftlPhrase); // FTL 文件两两比较
  infosss && infos.push(...infosss);
  let infoss = isPhraseInFTL(value, filePath, ftlPhrase);
  infoss && infos.push(...infoss);
  infoss = isFTLPhraseInSource(value, filePath, ftlPhrase);
  infoss && infos.push(...infoss);
  infos.push(infoDateDoubleLine);
  logInfo(infos);
});

function logInfo(infos) {
  if (infos.length > 2) {
    appendFileSync(logPath, infos.join("\n") + os.EOL);
    infos.shift(); //移除已在屏幕打印的开始提示
    Logger.info(infos.join("\n"));
  }
}

function isFTLPhraseInSource(value, filePath, ftlPhrase) {
  // FLT 文件中的短语是否存在于 XHTML 文件中
  const extname = path.extname(filePath).toUpperCase();
  const infoss = [`FLT 文件中的短语是否存在于 XHTML 文件中`];
  ftlPhrase.forEach((set, filePath) => {
    let phrases = [];
    set.forEach((phrase) => {
      if (!value.has(phrase)) {
        phrases.push(phrase);
      }
    });
    if (phrases.length) {
      const ftlLangDir = langDir(ftlPhrase, set);
      infoss.push(
        `The phrase "${phrases}" in the  ${ftlLangDir.lang} FTL file is not in the ${extname} file`,
      );
      infoss.push(`FTL  : ${ftlLangDir.filePath}`);
      infoss.push(infoDateDoubleLine);
      return infoss;
    }
  });
}

function isPhraseInFTL(value, filePath, ftlPhrase) {
  let infoss = [`Src 文件中的短语是否存在于 FLT 文件中`];
  const extname = path.extname(filePath);
  value.forEach((phrase) => {
    const sets = [...ftlPhrase.values()];
    sets.forEach((set) => {
      if (!set.has(phrase)) {
        const ftlLangDir = langDir(ftlPhrase, set);
        infoss.push(
          `The phrase "${phrase}" in the ${extname} file is not in the  ${ftlLangDir.lang} FTL file`,
        );
        infoss.push(`${extname}: ${filePath}`);
        infoss.push(`FTL  : ${ftlLangDir.dir}`);
      }
    });
  });
  if (infoss.length > 1) {
    infoss.push(infoDateDoubleLine);
    return infoss;
  }
}

function findInSRC() {
  const files = findPaths("src")()("ts");
  const phrases = new Map();
  files.forEach((filePath) => {
    findInOneFile(filePath, tsReg, 1, phrases);
  });
  return phrases;
}

function langDir(phraseMap, mapValue) {
  let filePath;
  phraseMap.forEach((v, k) => {
    if (v === mapValue) filePath = k;
  });
  const dir = path.dirname(path.dirname(filePath));
  const lang = path.dirname(filePath).split(path.sep).pop();
  return { dir, lang, filePath };
}

/**
 * 不同语言短语比较
 * @param { Map<string, any>} ftlPhrase
 */
function compareFTLPhrase(ftlPhrase) {
  const sets = [...ftlPhrase.values()];
  const infos = [`Compare Phrase Difference Between FTL Files\n`];
  Logger.info(infos.join(""));
  sets.forEach((set) => {
    set.forEach((value) => {
      sets.forEach((set2) => {
        if (set2 !== set) {
          if (!set2.has(value)) {
            let setPath, set2Path;
            ftlPhrase.forEach((v, k) => {
              if (v === set2) set2Path = k;
              if (v === set) setPath = k;
            });
            const dir = path.dirname(path.dirname(setPath));
            const localeLang1 = path.dirname(setPath).split(path.sep).pop();
            const localeLang2 = path.dirname(set2Path).split(path.sep).pop();
            const info = `[dir: ${dir}]\n
            "${value}" in ${localeLang1} not find in ${localeLang2}\n${singleLine}`;
            infos.push(info);
          }
        }
      });
    });
  });
  if (infos.length > 1) {
    infos.push(infoDateDoubleLine);
    Logger.info(infos.slice(1).join(""));
    return infos;
  }
}

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

function findInXHTML() {
  const filesHTML = findPaths(htmlDir)()("xhtml");
  const phraseInHTML = new Map();
  filesHTML.forEach((htmlFilePath) => {
    const html = readFileSync(htmlFilePath, "utf-8");
    const ftlFiles = [...html.matchAll(/(\w+\.ftl)"\s?\/>/g)].map((m) => m[1]);
    const matchs = [...html.matchAll(htmlReg)];
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
    .map((dirent) => dirent.path + "/" + dirent.name);
  for (const path of dirs) {
    const files = readdirSync(path, { withFileTypes: true })
      .filter((dirent) =>
        dirent.isFile() && names
          ? names.some((name) => dirent.name.startsWith(name))
          : true && exts
            ? exts.some((ext) => dirent.name.endsWith(ext))
            : true,
      )
      .map((dirent) => dirent.path + "/" + dirent.name);
    files.forEach((filePath) => {
      allfiles.add(filePath);
    });
  }
  return allfiles;
}

/**
 * - 柯里化函数，不传参数返回结果，参数没有值时传入 undefined
 * - 例：const res = findPaths(ftlDir)(undefined)()
 * @param {string} dir 目录
 * @param {string|string[]|undefined} names 文件名，可选
 * @param {string|string[]|undefined} exts 扩展名，可选
 * @returns
 */
function findPaths(dir) {
  const dirs = readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.path + "/" + dirent.name);

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
        .map((dirent) => dirent.path + "/" + dirent.name);
      files.forEach((filePath) => {
        allfiles.add(filePath);
      });
    }
    return allfiles;
  }
}
