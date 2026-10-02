// 工作流只管理云端身份与操作顺序；上传协议和原生组件由 Adapter 提供。
export function createCloudImageActions({reference,upload,favoriteStatus,setFavorite,assertAccount}) {
  const pending = new Map();
  function registered(image) {
    if (!pending.has(image.id)) {
      const task = (async () => {
        assertAccount();
        const cached = await reference(image,"reference");
        assertAccount();
        if (cached.libraryFileId) return {libraryFileId:cached.libraryFileId,created:false};
        const unconfirmed = () => Object.assign(new Error("Library upload is pending or could not be confirmed"),{code:"UPLOAD_UNCONFIRMED"});
        if (cached.status === "uploading") throw unconfirmed();
        const file = await reference(image,"upload-file");
        assertAccount();
        if (!(await reference(image,"begin-upload",{fingerprint:file.fingerprint})).started) throw unconfirmed();
        let libraryFileId;
        try {libraryFileId = await upload(file);} catch(error) {throw Object.assign(unconfirmed(),{cause:error});}
        if (!libraryFileId) throw new Error("Native upload did not return a Library file");
        // 先保存身份；收藏失败或取消文件夹选择后仍可复用上传结果。
        await reference(image,"register",{libraryFileId,fingerprint:file.fingerprint});
        assertAccount();
        return {libraryFileId,created:true};
      })();
      pending.set(image.id,task);
      const release = () => {if (pending.get(image.id) === task) pending.delete(image.id);};
      void task.then(release,release);
    }
    return pending.get(image.id);
  }
  return {
    registered,
    async favorite(image) {
      const {libraryFileId} = await registered(image);
      const favoriteId = await favoriteStatus(libraryFileId);
      assertAccount();
      if (!await setFavorite(libraryFileId,favoriteId,!favoriteId)) throw new Error("Library favorite could not be changed");
      assertAccount();
      return !favoriteId;
    },
  };
}
