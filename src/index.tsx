import { useState } from "react";
import { definePlugin, type PluginSettingsProps } from "@tau/plugins";
import { Button, Input, SettingRow } from "@tau/ui";
import { createGithubSyncProvider } from "./sync";

declare const __PLUGIN_META__: { id: string; name: string; version: string };

function GithubSettings({ syncConfig }: PluginSettingsProps) {
  const value = syncConfig?.value;
  const fields =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const [config, setConfig] = useState(() => ({
    owner: String(fields.owner ?? ""),
    repo: String(fields.repo ?? ""),
    branch: String(fields.branch ?? ""),
    pathPrefix: String(fields.pathPrefix ?? ""),
    token: String(fields.token ?? ""),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  if (!syncConfig) return <p>请在客户端的同步设置中配置此插件。</p>;

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await syncConfig.save(config);
      setSaved(true);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SettingRow title="仓库所有者" description="GitHub 用户名或组织名">
        <Input
          className="w-[260px]"
          aria-label="仓库所有者"
          type="text"
          value={config.owner}
          placeholder=""
          required
          autoComplete="off"
          spellCheck={false}
          disabled={saving}
          onChange={(event) => {
            setSaved(false);
            setConfig({ ...config, owner: event.target.value });
          }}
        />
      </SettingRow>

      <SettingRow title="仓库" description="仓库名称">
        <Input
          className="w-[260px]"
          aria-label="仓库"
          type="text"
          value={config.repo}
          placeholder=""
          required
          autoComplete="off"
          spellCheck={false}
          disabled={saving}
          onChange={(event) => {
            setSaved(false);
            setConfig({ ...config, repo: event.target.value });
          }}
        />
      </SettingRow>

      <SettingRow title="分支">
        <Input
          className="w-[260px]"
          aria-label="分支"
          type="text"
          value={config.branch}
          placeholder="main"
          required
          autoComplete="off"
          spellCheck={false}
          disabled={saving}
          onChange={(event) => {
            setSaved(false);
            setConfig({ ...config, branch: event.target.value });
          }}
        />
      </SettingRow>

      <SettingRow title="路径前缀" description="可选，例如 sync">
        <Input
          className="w-[260px]"
          aria-label="路径前缀"
          type="text"
          value={config.pathPrefix}
          placeholder="sync"
          autoComplete="off"
          spellCheck={false}
          disabled={saving}
          onChange={(event) => {
            setSaved(false);
            setConfig({ ...config, pathPrefix: event.target.value });
          }}
        />
      </SettingRow>

      <SettingRow title="访问令牌" description="GitHub Personal Access Token">
        <Input
          className="w-[260px]"
          aria-label="访问令牌"
          type="password"
          value={config.token}
          placeholder=""
          required
          autoComplete="off"
          spellCheck={false}
          disabled={saving}
          onChange={(event) => {
            setSaved(false);
            setConfig({ ...config, token: event.target.value });
          }}
        />
      </SettingRow>

      {error && (
        <SettingRow title="">
          <p role="alert" className="text-danger text-tau-body">
            {error}
          </p>
        </SettingRow>
      )}
      {saved && (
        <SettingRow title="">
          <p role="status" className="text-ink-2 text-tau-body">
            配置已保存，可以使用客户端的检查、上传和下载。
          </p>
        </SettingRow>
      )}

      <SettingRow title="">
        <Button onClick={handleSave} loading={saving} loadingText="保存中…">
          保存同步配置
        </Button>
      </SettingRow>
    </>
  );
}

export default definePlugin({
  ...__PLUGIN_META__,
  create: () => ({
    activate(context) {
      context.sync.register({
        id: context.pluginId,
        name: "GitHub",
        create: (config) => createGithubSyncProvider(config, context.fetch),
      });
      context.settings.register({
        id: "sync",
        title: "GitHub 同步存储",
        target: "sync",
        component: GithubSettings,
      });
    },
  }),
});
