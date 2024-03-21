const regedit = require("regedit");
const path = require("path");

// 设置要查询的文件扩展名
const fileExtension = ".txt";

// 查询注册表项
regedit.list(
  [`HKEY_CLASSES_ROOT\\${fileExtension}\\shell\\open\\command`],
  (err, result) => {
    if (err) {
      console.error(err);
      return;
    }

    // 获取查询结果
    const key = Object.keys(result)[0];
    const value = result[key].shell.open.command.default;

    // 输出命令
    console.log(value.data);
  },
);
