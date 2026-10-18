import { useState } from "react";
import { definePlugin, type PluginSettingsProps } from "@tau/plugins";
import { Button, Input } from "@tau/ui";
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
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
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
      }}
    >
      {(
        [
          ["owner", "仓库所有者", ""],
          ["repo", "仓库", ""],
          ["branch", "分支", "main"],
          ["pathPrefix", "路径前缀", "sync"],
          ["token", "访问令牌", ""],
        ] as const
      ).map(([key, label, placeholder]) => (
        <label key={key} className="flex flex-col gap-1">
          <span>{label}</span>
          <Input
            aria-label={label}
            type={key === "token" ? "password" : "text"}
            value={config[key]}
            placeholder={placeholder}
            required={key !== "pathPrefix"}
            autoComplete="off"
            spellCheck={false}
            disabled={saving}
            onChange={(event) => {
              setSaved(false);
              setConfig({ ...config, [key]: event.target.value });
            }}
          />
        </label>
      ))}
      {error && <p role="alert">{error}</p>}
      {saved && (
        <p role="status">配置已保存，可以使用客户端的检查、上传和下载。</p>
      )}
      <div>
        <Button type="submit" loading={saving}>
          保存同步配置
        </Button>
      </div>
    </form>
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
