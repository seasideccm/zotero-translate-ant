
import { arrayUtils, judgeAsync } from "./tools";
//  数组元素顺序即为路径
// 过滤掉原型上的属性，只检查自身属性
export function scanCommands() {
    const commandPaths: string[][] = [];
    // 递归过深可能是自身引用导致的
    const cache = new WeakMap();
    const constructorCache = new Map();
    let level = 0;
    const constructorNamesExclude = ["Function", "AsyncFunction", "Async", "GeneratorFunction", "Object",];
    const arrFilter = ["toSource", "constructor", "prototype", "toString", "length", "name", "apply", "call", "bind", "arguments", "caller", "CollectionTreeCache", "_objectCache", "transactionDate", "transactionDateTime", "transactionTimestamp", "__proto__", "mainThread", "nextFile", "parent", "toLocaleString", "valueOf", "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable", "__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__",];
    function _scan(value: any, functionPath: string[] = []) {

        if (value === null || !["object", "function"].includes(typeof value)) {
            return value;
        }
        if (value.window || value.defaultView?.window) return value;
        if (cache.has(value)) {
            const cacheResult = cache.get(value);
            return cacheResult;
        }
        if (constructorCache.has(value.constructor?.name)) {
            const ParentAttrsNumber = constructorCache.get(value.constructor.name);
            if (Object.getOwnPropertyNames(value).length == ParentAttrsNumber) return;
        }

        const result: any = Array.isArray(value) ? [] : {};
        cache.set(value, result);
        if (value.constructor?.name && !constructorNamesExclude.includes(value.constructor?.name)) {
            constructorCache.set(value.constructor.name, Object.getOwnPropertyNames(value).length);
        }
        const propertyNames = Object.getOwnPropertyNames(value);
        const protoPropertyNames = Object.getOwnPropertyNames(Object.getPrototypeOf(value));
        const unionArr = arrayUtils.union(propertyNames, protoPropertyNames);
        const allProperty = arrayUtils.minus(unionArr, arrFilter);
        for (const key of allProperty) {
            try {
                level++;
                const nextPath = [...functionPath, key];
                result[key] = _scan(value[key], nextPath);
            } catch (e) {
                level--;
                continue;
            }
            level--;

        }
        if (typeof value === 'function' && functionPath.length) {
            commandPaths.push([...functionPath]);
        }
        return result;
    }
    _scan(Zotero);


    const commandString = new Map();
    const commandCache = new Map();
    const commanFunctionStrs = [Zotero.purgeDataObjects.toString(), Zotero.Debug.get.toString(), Zotero.DB._connection._connectionData._deferredClose.resolve.toString(), Zotero.unlockDeferred.resolve.toString()];


    for (const path of commandPaths) {
        let commandObj: any = Zotero;
        for (const key of path) {
            commandObj = commandObj[key];
        }
        if (typeof commandObj !== 'function') {
            ztoolkit.log(commandObj);
            continue;
        }


        const str = commandObj.toString();
        //空函数
        if (str == Zotero.CiteProc.CSL.Output.DefaultFormatter.toString()) continue;
        if (commandString.has(str) && !commanFunctionStrs.includes(str)) {
            commandString.get(str);
            const oldPath = commandCache.get(commandString.get(str));
            if (!Array.isArray(oldPath[0])) {
                const tempPath = [...oldPath];
                oldPath.length = 0;
                oldPath.push(tempPath);
            }

            oldPath.push(path);
            ztoolkit.log(oldPath);

        } else {
            commandString.set(str, commandObj);
            commandCache.set(commandObj, path);
        }
    }
    const commandPathsNew = Array.from(commandCache.values());
    const commands = Array.from(commandCache.keys());



    const commandFunc: any = {
        object: Zotero,
        name: "Zotero",
        commandsMap: commandCache,
        commandPaths: commandPathsNew,
        commands: commands,
    };
    ztoolkit.log(commandFunc);
    return commandFunc;

}

async function excuteCommand(command: string, ...args: any[]) {
    const commandFunc = scanCommands();
    const func = commandFunc.object[command];
    if (judgeAsync(func)) {
        return await func.apply(commandFunc.object, args);
    } else {
        return func.apply(commandFunc.object, args);
    }

}


export async function getit() {
    await excuteCommand("");
}

const commandPaths2: string[][] = [];
function scaning(objectOrFunction: any, functionPath: string[] = []) {
    const typeName = typeof objectOrFunction;
    if (!["function", "object"].includes(typeName)) {
        functionPath.length = 0;
        return;
    }
    for (const key in objectOrFunction) {
        if (!Object.prototype.hasOwnProperty.call(objectOrFunction, key)) continue;
        functionPath.push(key);
        scaning(objectOrFunction[key], functionPath);
    }
    if (typeName === 'function' && functionPath.length) {
        commandPaths2.push(functionPath);
    }
    functionPath.length = 0;//下次递归开始前清空路径数组
}


function scan(objectOrFunction: any) {
    const typeName = typeof objectOrFunction;
    if (!["function", "object"].includes(typeName)) return;
    let nextObjectOrFunction;
    const cache = new WeakMap();
    for (const key in objectOrFunction) {
        if (!Object.prototype.hasOwnProperty.call(objectOrFunction, key)) continue;
        const typeNext = typeof objectOrFunction[key];
        if (!["function", "object"].includes(typeNext)) continue;
        nextObjectOrFunction = objectOrFunction[key];
        const cache: any[] = [[key]];
        while (cache.length) {
            let nextStep = false;
            const [functionPath] = cache.shift() as [any, string[]];
            for (const key2 in nextObjectOrFunction) {
                if (!Object.prototype.hasOwnProperty.call(nextObjectOrFunction, key2)) continue;
                const typeNext2 = typeof nextObjectOrFunction[key2];
                if (!["function", "object"].includes(typeNext2)) continue;
                functionPath.push(key2);
                nextStep = true;
                cache.push([functionPath]);
            }
            const typeNow = typeof nextObjectOrFunction;
            if (!nextStep && typeNow === "function" && functionPath.length) {
                commandPaths2.push(functionPath);
                ztoolkit.log(functionPath);
            }
        }
    }

}


