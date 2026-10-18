import type {
  JsonValue,
  RemoteFileInfo,
  SyncProvider,
} from "@tau/plugins/sync";

interface Config {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  pathPrefix: string;
}
interface Entry {
  type: string;
  name: string;
  path: string;
  sha: string;
  size: number;
  content?: string;
}
function parse(value: JsonValue): Config {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("GitHub配置无效");
  const text = (key: string) => {
    const field = value[key];
    if (typeof field !== "string" || !field)
      throw new Error("请填写GitHub令牌、所有者、仓库和分支");
    return field;
  };
  return {
    token: text("token"),
    owner: text("owner"),
    repo: text("repo"),
    branch: text("branch"),
    pathPrefix: typeof value.pathPrefix === "string" ? value.pathPrefix : "",
  };
}
function encode(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 16384)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
  return btoa(binary);
}
function isMissing(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 404
  );
}

class GithubSyncProvider implements SyncProvider {
  private readonly prefix: string;
  constructor(
    private readonly config: Config,
    private readonly fetch: typeof globalThis.fetch,
  ) {
    this.prefix = config.pathPrefix.replace(/^\/+|\/+$/g, "");
  }
  private path(name: string) {
    return [this.prefix, name.replace(/^\/+/, "")].filter(Boolean).join("/");
  }
  private async request(
    path: string,
    body?: Record<string, string>,
  ): Promise<Entry | Entry[]> {
    const url = new URL(
      `https://api.github.com/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repo)}/contents${path ? "/" + path.split("/").map(encodeURIComponent).join("/") : ""}`,
    );
    if (!body) url.searchParams.set("ref", this.config.branch);
    const response = await this.fetch(url, {
      method: body ? "PUT" : "GET",
      headers: {
        Authorization: `token ${this.config.token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(300000),
    });
    if (response.status !== 200 && response.status !== 201)
      throw Object.assign(new Error(`GitHub请求失败：${response.status}`), {
        status: response.status,
      });
    return response.json();
  }
  private async put(name: string, bytes: Uint8Array, createOnly: boolean) {
    try {
      const path = this.path(name);
      const body: Record<string, string> = {
        branch: this.config.branch,
        message: `Update ${name}`,
        content: encode(bytes),
      };
      if (!createOnly) {
        try {
          const existing = await this.request(path);
          if (Array.isArray(existing) || typeof existing.sha !== "string")
            throw new Error("GitHub目标不是文件");
          body.sha = existing.sha;
        } catch (error) {
          if (!isMissing(error)) throw error;
        }
      }
      await this.request(path, body);
      return true;
    } catch {
      return false;
    }
  }
  uploadFile(name: string, bytes: Uint8Array) {
    return this.put(name, bytes, false);
  }
  createFileIfAbsent(name: string, bytes: Uint8Array) {
    return this.put(name, bytes, true);
  }
  async downloadFile(name: string): Promise<Uint8Array> {
    const entry = await this.request(this.path(name));
    if (Array.isArray(entry) || typeof entry.content !== "string")
      throw new Error("GitHub未返回Base64文件内容");
    return Uint8Array.from(atob(entry.content.replace(/\n/g, "")), (char) =>
      char.charCodeAt(0),
    );
  }
  async fileExists(name: string) {
    try {
      await this.downloadFile(name);
      return true;
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
  }
  async listFiles(prefix = ""): Promise<RemoteFileInfo[]> {
    const queue = [this.path(prefix).replace(/\/+$/, "")];
    const visited = new Set<string>();
    const files: RemoteFileInfo[] = [];
    while (queue.length) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      try {
        const result = await this.request(current);
        for (const item of Array.isArray(result) ? result : [result]) {
          if (item.type === "dir") queue.push(item.path);
          else if (item.type === "file") {
            const path =
              this.prefix && item.path.startsWith(this.prefix + "/")
                ? item.path.slice(this.prefix.length + 1)
                : item.path;
            files.push({
              name: item.name,
              path,
              size: item.size || 0,
              hash: item.sha,
            });
          }
        }
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
    }
    return files;
  }
}
export function createGithubSyncProvider(
  config: JsonValue,
  fetch: typeof globalThis.fetch,
): SyncProvider {
  return new GithubSyncProvider(parse(config), fetch);
}
