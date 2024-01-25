/*
ts 编译后仍然使用 $ 运算符
|| `chrome://${config.addonRef}/content/schema/

编译后替换 js 文件即可
*/

import replaceInFile from "replace-in-file";
import { readdirSync, readFileSync } from "fs";
import details from "../package.json" assert { type: "json" };

const { config } = details;

// database schema sql file directory
const localeDir = "addon/chrome/content/schema";
const buildDir = "build";
const files = [
  // 替换 build 之后的文件
  `${buildDir}/addon/chrome/content/scripts/${config.addonRef}.js`,

  // 替换 build 之前的文件,
  //编译后需要复原改文件，否则sql发生变化，由于模版字符串已被替换导致无法自动更新
  //"src/utils/constant.ts"
];
let replaceFrom = [/__schemaConfig__/g];
const schemaConfig =
  "{\n" + getFileNamesRecursive(localeDir, ".sql").join(",\n") + "\n}";
const replaceTo = [schemaConfig];
const replaceFromString = replaceFrom.map((reg) =>
  reg.toString().replace(/\/[^_]*/g, ""),
);

function getFileNames(localeDir, ext) {
  return readdirSync(localeDir, {
    withFileTypes: true,
  })
    .filter(
      (dirent) => dirent.isFile() && (ext ? dirent.name.endsWith(ext) : true),
    )
    .map((dirent) => {
      const dirPrefix = `chrome://\${config.addonRef}/content/schema/`;
      //const dir= path.join(localeDir, dirent.name);
      //console.log("===",dirent.path,"\nlocaleDir|| ",localeDir,"\nname|| ",dirent.name)

      const dir = dirent.path + "/" + dirent.name;
      const version = extractFileContent(dir);
      const name = dirent.name.slice(0, dirent.name.lastIndexOf("."));
      const dirStringBeforBuild =
        "`" + dir.replace("addon/chrome/content/schema/", dirPrefix) + "`";
      const str = `${name}:{        
        path:${dirStringBeforBuild},
        version:${version},
      }`;
      return str;
    });
}

export function getFileNamesRecursive(localeDir, ext) {
  const localeFolders = readdirSync(localeDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
  if (!localeFolders.length) {
    return getFileNames(localeDir, ext);
  }
  let localeSubFiles = [];
  for (const localeSubFolder of localeFolders) {
    //const localeSubDir = path.join(localeDir, localeSubFolder);
    const localeSubDir = localeDir + "/" + localeSubFolder;
    localeSubFiles = localeSubFiles.concat(
      getFileNamesRecursive(localeSubDir, ext),
    );
  }
  return localeSubFiles.concat(getFileNames(localeDir, ext));
}

function extractFileContent(path) {
  //path = 'addon/chrome/content/schema/addonSystem.sql' //pass
  //path= 'addon\\chrome\\content\\schema\\translation.sql' //pass
  const sql = readFileSync(path, "utf-8");
  const match = sql.match(/^-- ([0-9]+)/);
  if (match && match[1]) {
    return parseInt(match[1]);
  }
}

export async function replaceStringExtra() {
  const schemaConfig =
    "{\n" + getFileNamesRecursive(localeDir, ".sql").join(",\n") + "\n}";
  const replaceTo = [schemaConfig];
  //console.log("replaceFrom",replaceFrom)
  //console.log("replaceTo",replaceTo)
  const replaceResult = await replaceInFile({
    files: files,
    from: replaceFrom,
    to: replaceTo,
    countMatches: true,
  });
  //replaceFrom=replaceTo
  console.log("replace", replaceResult);
  return replaceResult;
}

export async function recoverReplace() {
  const replaceResult = await replaceInFile({
    files: files,
    from: replaceTo,
    to: replaceFromString,
    countMatches: true,
  });
  console.log("recover", replaceResult);
  return replaceResult;
}

// test
/* let replaceResult =await recoverReplace()
if(!(replaceResult[0].hasChanged)){

  await replaceStringExtra()
}
 */
