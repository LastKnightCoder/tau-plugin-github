import type { ProviderForm, ProviderFormValues } from "@tau/plugins";

type Fetch = typeof globalThis.fetch;

async function request(fetch: Fetch, url: string, values: ProviderFormValues, signal: AbortSignal) {
  if (!values.token) throw new Error("请先填写访问令牌");
  const response = await fetch(url, {
    signal,
    headers: { Authorization: `Bearer ${values.token}`, Accept: "application/vnd.github+json" },
  });
  if (response.status === 401) throw new Error("访问令牌无效或已过期");
  if (!response.ok) throw new Error(`GitHub 请求失败：HTTP ${response.status}`);
  return response.json();
}

async function login(fetch: Fetch, values: ProviderFormValues, signal: AbortSignal) {
  const profile = await request(fetch, "https://api.github.com/user", values, signal);
  if (typeof profile.login !== "string") throw new Error("GitHub 账号信息无效");
  return profile as { login: string; email?: string | null };
}

/** 仓库与分支从账号实时加载；所有者留空时取令牌所属账号。 */
export function createGithubForm(
  fetch: Fetch,
  options: { pathPlaceholder: string; upload: boolean }
): ProviderForm {
  return {
    groups: [
      {
        title: "账号",
        description: "GitHub Personal Access Token，需要仓库读写权限",
        fields: [{ key: "token", label: "访问令牌", type: "secret" }],
      },
      {
        title: "存储位置",
        ...(options.upload ? { description: "图床请选公开仓库，私有仓库的图片地址无法直接访问" } : {}),
        fields: [
          {
            key: "owner",
            label: "仓库所有者",
            type: "text",
            optional: true,
            description: "留空则使用令牌所属账号",
            placeholder: "用户名或组织名",
            summary: true,
          },
          {
            key: "repo",
            label: "仓库",
            type: "remote-choice",
            summary: true,
            dependsOn: ["owner"],
            load: async (values, signal) => {
              const owner = (values.owner || (await login(fetch, values, signal)).login).toLowerCase();
              const items = await request(
                fetch,
                "https://api.github.com/user/repos?per_page=100&sort=updated",
                values,
                signal
              );
              if (!Array.isArray(items)) throw new Error("仓库列表格式无效");
              return items
                .filter(item => String(item.owner?.login ?? "").toLowerCase() === owner)
                .map(item => ({
                  value: String(item.name),
                  description: item.private ? "私有" : "公开",
                }));
            },
          },
          {
            key: "branch",
            label: "分支",
            type: "remote-choice",
            placeholder: "main",
            dependsOn: ["repo"],
            load: async (values, signal) => {
              if (!values.repo) throw new Error("请先选择仓库");
              const owner = values.owner || (await login(fetch, values, signal)).login;
              const items = await request(
                fetch,
                `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(values.repo)}/branches?per_page=100`,
                values,
                signal
              );
              if (!Array.isArray(items)) throw new Error("分支列表格式无效");
              return items.map(item => ({ value: String(item.name) }));
            },
          },
          {
            key: "pathPrefix",
            label: "目录",
            type: "text",
            optional: true,
            placeholder: options.pathPlaceholder,
          },
          ...(options.upload
            ? ([
                {
                  key: "publicBaseUrl",
                  label: "公开地址前缀",
                  type: "url",
                  optional: true,
                  description: "使用自定义域名或 CDN 时填写",
                },
                {
                  key: "email",
                  label: "提交邮箱",
                  type: "text",
                  optional: true,
                  description: "留空则使用账号公开邮箱",
                },
              ] as const)
            : []),
        ],
      },
    ],
    beforeSave: async (values, signal) => {
      if (values.owner && (!options.upload || values.email)) return values;
      const profile = await login(fetch, values, signal);
      return {
        ...values,
        owner: values.owner || profile.login,
        ...(options.upload ? { email: values.email || profile.email || "" } : {}),
      };
    },
  };
}
