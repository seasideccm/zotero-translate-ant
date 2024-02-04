export const migrate: any = {
  addonSystem: async function (fromVersion: number, toVersion: number) {
    ztoolkit.log(
      "is schema, this._maxCompatibility=",
      this._maxCompatibility,
      "fromVersion=",
      fromVersion,
    );
    return true;
    // 表结构和数据按版本逐一升级
    for (let i = fromVersion + 1; i <= toVersion; i++) {
      if (i == 2) {
        //参数是数据库兼容的 zotero 大版本
        await this.updateCompatibility(7);

        //修改值

        //await this.DB.queryAsync("UPDATE settings SET value=? WHERE setting='account' AND key='userID'", parseInt(userID));

        //await this.DB.queryAsync("DELETE FROM libraries WHERE libraryID != 0 AND libraryID NOT IN (SELECT libraryID FROM groups)");

        //修改表结构，表重名名，新建表，插入数据，保留或删除旧表
        //await this.DB.queryAsync("ALTER TABLE libraries RENAME TO librariesOld");
        //await this.DB.queryAsync("CREATE TABLE libraries (\n    libraryID INTEGER PRIMARY KEY,\n    type TEXT NOT NULL,\n    editable INT NOT NULL,\n    filesEditable INT NOT NULL,\n    version INT NOT NULL DEFAULT 0,\n    lastSync INT NOT NULL DEFAULT 0,\n    lastStorageSync INT NOT NULL DEFAULT 0\n)");
        //await this.DB.queryAsync("INSERT INTO libraries (libraryID, type, editable, filesEditable) VALUES (1, 'user', 1, 1)");
        //await this.DB.queryAsync("INSERT INTO libraries SELECT libraryID, libraryType, editable, filesEditable, 0, 0, 0 FROM librariesOld JOIN groups USING (libraryID)");

        //删除触发器
        //await this.DB.queryAsync("DROP TRIGGER IF EXISTS fki_annotations_itemID_itemAttachments_itemID");
        //建立索引
        //await this.DB.queryAsync("CREATE INDEX collections_synced ON collections(synced)");
        //更新旧表数据，新表导入数据
        //await this.DB.queryAsync("UPDATE syncedSettingsOld SET libraryID=1 WHERE libraryID=0");
        //await this.DB.queryAsync("INSERT OR IGNORE INTO syncedSettings SELECT * FROM syncedSettingsOld");
        //删除索引，重建索引
        //await this.DB.queryAsync("DROP INDEX IF EXISTS itemData_fieldID");
        //await this.DB.queryAsync("CREATE INDEX itemData_fieldID ON itemData(fieldID)");
        //执行函数
        //await _migrateUserData_80_filePaths();
        //删除旧表
        //await this.DB.queryAsync("DROP TABLE annotationsOld");
      } else if (i == 122) {
        //替换值
        //await this.DB.queryAsync("REPLACE INTO fileTypes VALUES(8, 'ebook')");
        //await this.DB.queryAsync("REPLACE INTO fileTypeMIMETypes VALUES(8, 'application/epub+zip')");
      }
    }
    return true;
  },

  translation: function (fromVersion: number, toVersion: number) {
    return true;
  },
  //xx: () => {    },
};