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
function findInXHTML() {
  const MessagesInHTML = new Set();
  const localesPath = "addon/chrome";
  const exts = ["xhtml", "html"];
  const filesHTML = getFilePaths(localesPath, exts);

  filesHTML.forEach((htmlFilePath) => {
    const html = readFileSync(htmlFilePath, "utf-8"); //不指定 "utf-8" 则返回 buffer
    const matchs = [...html.matchAll(/(data-l10n-id)="(\S*)"/g)];
    matchs.map((match) => {
      MessagesInHTML.add(match[2]);
    });
  });
  Logger.info(`MessagesInHTML length: ${MessagesInHTML.size} `);
  return MessagesInHTML; //Logger.info 可以显示 buffer 内容
}

function findInFTL(MessagesInHTML) {
  const MessagesInFTL = new Set();
  const localesPath = `addon/locale`;
  const exts = ["ftl"];
  const filesFTL = getFilePaths(localesPath, exts);
  Logger.info(`filesFTL length: ${filesFTL.size}`);

  filesFTL.forEach((FilePath) => {
    const localeName = path.dirname(FilePath).split(path.sep).pop();
    const basename = path.basename(FilePath);
    const localeMessagesInFTL = new Set();
    const content = readFileSync(FilePath, "utf-8"); //不指定 "utf-8" 则返回 buffer
    const matchs = [...content.matchAll(/^([^ =]+)\s?=/gim)];
    matchs.map((match) => {
      MessagesInFTL.add(match[1]);
      if (!MessagesInHTML.has(match[1])) {
        Logger.info(
          `[checkFTL] ${match[1]} in ${localeName} of ${basename} don't exist in xhtml file`,
        );
      }
    });
    MessagesInHTML.forEach((message) => {
      if (!localeMessagesInFTL.has(message)) {
        Logger.info(`[checkFTL] ${message} don't exist in ${localeName}`);
      }
    });
  });
  Logger.info(`MessagesInFTL length: ${MessagesInFTL.size} `); //Logger.info 可以显示 buffer 内容
}

function getFilePaths(localesPath, exts) {
  const files = new Set();
  const localeNames = readdirSync(localesPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
  for (const localeName of localeNames) {
    const localePath = path.join(localesPath, localeName);
    const xhtmlFiles = readdirSync(localePath, {
      withFileTypes: true,
    })
      .filter(
        (dirent) =>
          dirent.isFile() && exts.some((ext) => dirent.name.endsWith(ext)),
      )
      .map((dirent) => dirent.path + "/" + dirent.name);
    xhtmlFiles.forEach((filePath) => {
      files.add(filePath);
    });
  }
  return files;
}
const MessagesInHTML = findInXHTML();
findInFTL(MessagesInHTML);
