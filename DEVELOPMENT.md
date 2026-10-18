# 开发说明

基于公开Tau模板，使用SDK0.10.0、Node.js 22及以上、pnpm 11.9.0，不依赖宿主源码或本地SDK快照。

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

产物dist/tau.sync-github-0.1.0.zip。src/index.tsx注册同步配置表单与五方法提供方，src/sync.ts通过context.fetch调用Contents API；只有main.js渲染入口，无Node后台或额外SDK扩展。

普通PUT先GET取得SHA，条件创建不查询也不携带SHA。读取Base64、递归目录及Git SHA元信息保留；只有404视为空目录或不存在。上传失败返回false，其他错误抛出，提交状态由客户端按快照协议确认。每次请求保留五分钟超时，宿主fetch与插件生命周期绑定。

测试用隔离Contents API验证分支、认证、中文和空格路径、二进制、SHA覆盖及条件写入竞争。真实Electron与迁移验收由客户端的sync-storage脚本执行，不访问用户仓库或真实配置。同步任务、资源调度、重试和冲突处理由客户端负责，不按插件身份添加特殊调度。
