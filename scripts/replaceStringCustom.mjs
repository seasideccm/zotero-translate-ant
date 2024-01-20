import replaceInFile from "replace-in-file";
import path from "path";
import { existsSync, readdirSync, renameSync , readFileSync, writeFileSync, rmSync} from "fs";


const localeDir = 'addon/chrome/content/schema';

function getFileNames(localeDir,ext){
 return readdirSync(localeDir, {
    withFileTypes: true,
  })
    .filter((dirent) => dirent.isFile()&&(ext?dirent.name.endsWith(ext):true))
    .map((dirent) => {
      const dir= path.join(localeDir, dirent.name);
      const version = extractFileContent(dir);
      const name =dirent.name.slice(0,dirent.name.lastIndexOf("."));
      return{
        name:name, 
        path:dir,
        version:version,
      }});
}

export function getFileNamesRecursion(localeDir,ext){  
  const localeFolders = readdirSync(localeDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);    
   if( !localeFolders.length){    
    return getFileNames(localeDir,ext)
   }
   let localeSubFiles = []
   for (const localeSubFolder of localeFolders) {
    const localeSubDir = path.join(localeDir, localeSubFolder);
    localeSubFiles=localeSubFiles.concat( getFileNamesRecursion(localeSubDir,ext))
  }
  return localeSubFiles.concat(getFileNames(localeDir,ext));
   


    

/*   for (const localeSubFolder of localeFolders) {
  

    for (const localeSubFile of localeSubFiles) {
      if (localeSubFile.endsWith(".sql")) {
        renameSync(
          path.join(localeSubDir, localeSubFile),
          path.join(localeSubDir, `${config.addonRef}-${localeSubFile}`),
        );
      }
    }
  } */
  
}
console.log(getFileNamesRecursion(localeDir,".sql"));

function extractFileContent(path){  
  //path = 'addon/chrome/content/schema/addonSystem.sql' //pass
  //path= 'addon\\chrome\\content\\schema\\translation.sql' //pass
  const sql = readFileSync(path, "utf-8");
  const match =sql.match(/^-- ([0-9]+)/)
  if(match&&match[1]) {  return  parseInt(match[1])}
  
}
extractFileContent()






export function replaceStringCustom() {

 






  const replaceFrom = [
    /__schemaConfigTest__/g,
  ];
  const schemaConfigTest="{schemaVersion1:2222,schemaVersion5:5555,}"
  const replaceTo = [schemaConfigTest];


/* 
  replaceFrom.push(
    ...Object.keys(config).map((k) => new RegExp(`__${k}__`, "g")),
  );
  replaceTo.push(...Object.values(config)); */
  const buildDir = "build";

  const replaceResult = replaceInFile({
    files: [
      `${buildDir}/addon/chrome/content/scripts/batchTranslate.js`,
    ],
    from: replaceFrom,
    to: replaceTo,
    countMatches: true,
  });
}
