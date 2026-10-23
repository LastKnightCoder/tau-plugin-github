import type { PluginSettingsProps } from "@tau/plugins";
import { ConfigurationPanel, type ConfigurationField } from "@tau/ui";

const accountFields: readonly ConfigurationField[] = [
  {
    key: "token",
    label: "Token",
    type: "password",
  },
];
const fields: readonly ConfigurationField[] = [
  {
    key: "owner",
    label: "仓库所有者",
    placeholder: "用户名或组织名",
  },
  {
    key: "repo",
    label: "仓库",
    placeholder: "请选择仓库",
    reset: ["branch"],
  },
  {
    key: "branch",
    label: "分支",
    placeholder: "请选择分支",
  },
  {
    key: "pathPrefix",
    label: "目录",
    placeholder: "sync（可选）",
  },
];

export function MobileSettings(props: PluginSettingsProps) {
  const config = props.syncConfig ?? props.uploadConfig;
  if (!config) return <p>请从客户端对应的服务设置进入。</p>;
  const initialValue: Record<string, string> = { urlStyle: "path" };
  if (config.value && typeof config.value === "object" && !Array.isArray(config.value))
    for (const [key, value] of Object.entries(config.value))
      if (typeof value === "string") initialValue[key] = value;
  const request = async (url: string, value: Readonly<Record<string, string>>) => {
    const response = await props.context.fetch(url, {
      headers: {
        Authorization: `Bearer ${value.token ?? ""}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (!response.ok) throw new Error(`GitHub 请求失败：HTTP ${response.status}`);
    return response.json();
  };
  const locations = fields.map(field => {
    if (field.key === "repo")
      return {
        ...field,
        loadOptions: async (value: Readonly<Record<string, string>>) => {
          const items = await request(
            "https://api.github.com/user/repos?per_page=100&sort=updated",
            value
          );
          if (!Array.isArray(items)) throw new Error("仓库列表格式无效");
          return items
            .filter(item => item.owner?.login?.toLowerCase() === value.owner?.toLowerCase())
            .map(item => String(item.name));
        },
      };
    if (field.key === "branch")
      return {
        ...field,
        loadOptions: async (value: Readonly<Record<string, string>>) => {
          if (!value.owner || !value.repo) throw new Error("请先选择仓库");
          const items = await request(
            `https://api.github.com/repos/${encodeURIComponent(value.owner)}/${encodeURIComponent(value.repo)}/branches?per_page=100`,
            value
          );
          if (!Array.isArray(items)) throw new Error("分支列表格式无效");
          return items.map(item => String(item.name));
        },
      };
    return field;
  });
  const prepareAccount = async (value: Record<string, string>) => {
    if (!value.token) return value;
    const profile = await request("https://api.github.com/user", value);
    if (typeof profile.login !== "string") throw new Error("GitHub 账号信息无效");
    return {
      ...value,
      owner: value.owner || profile.login,
      email: value.email || profile.email || "",
    };
  };
  return (
    <ConfigurationPanel
      initialValue={initialValue}
      accountFields={accountFields}
      fields={locations}
      prepareAccount={prepareAccount}
      onSave={value =>
        config.save({
          ...(config.value && typeof config.value === "object" && !Array.isArray(config.value)
            ? config.value
            : {}),
          ...value,
        })
      }
    />
  );
}
