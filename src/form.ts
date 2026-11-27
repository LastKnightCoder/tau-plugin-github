import type { ProviderFormDeclaration, ProviderFormValues } from "@tau/plugins";

import { messages } from "./i18n";

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
): ProviderFormDeclaration {
  return {
    groups: [
      {
        title: messages.ref("account.title"),
        description: messages.ref("account.description"),
        fields: [{ key: "token", label: messages.ref("account.token"), type: "secret" }],
      },
      {
        title: messages.ref("location.title"),
        ...(options.upload ? { description: messages.ref("location.publicHint") } : {}),
        fields: [
          {
            key: "owner",
            label: messages.ref("owner.label"),
            type: "text",
            optional: true,
            description: messages.ref("owner.description"),
            placeholder: messages.ref("owner.placeholder"),
            summary: true,
          },
          {
            key: "repo",
            label: messages.ref("repository.label"),
            type: "remote-choice",
            summary: true,
            dependsOn: ["owner"],
            load: async (values, signal) => {
              const owner = (
                values.owner || (await login(fetch, values, signal)).login
              ).toLowerCase();
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
                  description: messages.ref(
                    item.private ? "repository.private" : "repository.public"
                  ),
                }));
            },
          },
          {
            key: "branch",
            label: messages.ref("branch.label"),
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
            label: messages.ref("path.label"),
            type: "text",
            optional: true,
            placeholder: options.pathPlaceholder,
          },
          ...(options.upload
            ? ([
                {
                  key: "publicBaseUrl",
                  label: messages.ref("publicBase.label"),
                  type: "url",
                  optional: true,
                  description: messages.ref("publicBase.description"),
                },
                {
                  key: "email",
                  label: messages.ref("email.label"),
                  type: "text",
                  optional: true,
                  description: messages.ref("email.description"),
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
