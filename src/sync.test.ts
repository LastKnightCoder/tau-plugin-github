import { beforeEach, expect, it } from "vitest";
import { createGithubSyncProvider } from "./sync";
import type { SyncProvider } from "@tau/plugins/sync";

const objects = new Map<string, { content: string; sha: string }>();
const requests: { method: string; path: string; sha?: string }[] = [];
let provider: SyncProvider;
let failure = 0;
let revision = 0;
beforeEach(() => {
  objects.clear();
  requests.length = 0;
  failure = 0;
  revision = 0;
  provider = createGithubSyncProvider(
    {
      owner: "owner",
      repo: "repo",
      branch: "feature/test",
      pathPrefix: "/笔记 folder/",
      token: "test-only",
    },
    async (input, init) => {
      const url = new URL(String(input));
      expect(url.origin).toBe("https://api.github.com");
      expect(new Headers(init?.headers).get("authorization")).toBe("token test-only");
      expect(init?.signal).toBeDefined();
      const prefix = "/repos/owner/repo/contents/";
      expect(url.pathname.startsWith(prefix)).toBe(true);
      const path = decodeURIComponent(url.pathname.slice(prefix.length));
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ method: init?.method ?? "GET", path, sha: body?.sha });
      const reply = (status: number, value: unknown = {}) =>
        new Response(JSON.stringify(value), { status });
      if (failure) return reply(failure);
      const existing = objects.get(path);
      if (body) {
        expect(body.branch).toBe("feature/test");
        if (existing && body.sha !== existing.sha) return reply(422);
        objects.set(path, { content: body.content, sha: String(++revision) });
        return reply(existing ? 200 : 201);
      }
      expect(url.searchParams.get("ref")).toBe("feature/test");
      const entry = (name: string) => ({
        type: "file",
        path: name,
        name: name.split("/").pop(),
        sha: objects.get(name)!.sha,
        size: atob(objects.get(name)!.content).length,
        content: objects.get(name)!.content,
      });
      if (
        existing &&
        new Headers(init?.headers).get("accept") === "application/vnd.github.raw+json"
      )
        return new Response(Uint8Array.from(atob(existing.content), char => char.charCodeAt(0)));
      if (existing) return reply(200, entry(path));
      const children = [...objects.keys()].filter(name => name.startsWith(path + "/"));
      if (!children.length) return reply(404);
      const names = new Set(
        children.map(name => path + "/" + name.slice(path.length + 1).split("/")[0])
      );
      return reply(
        200,
        [...names].map(name =>
          objects.has(name) ? entry(name) : { type: "dir", path: name, name: name.split("/").pop() }
        )
      );
    }
  );
});
it("普通写入先读SHA再更新，分支和中文路径保持，原字节可读取", async () => {
  expect(await provider.uploadFile("a b.bin", new Uint8Array([0, 255]))).toBe(true);
  expect(await provider.downloadFile("a b.bin")).toEqual(new Uint8Array([0, 255]));
  expect(await provider.uploadFile("a b.bin", new Uint8Array([3]))).toBe(true);
  expect(requests.at(-1)?.sha).toBe("1");
  expect(await provider.downloadFile("a b.bin")).toEqual(new Uint8Array([3]));
});
it("条件创建不先读SHA，并发竞争只有一个成功", async () => {
  const result = await Promise.all(
    [1, 2].map(n => provider.createFileIfAbsent("commit", new Uint8Array([n])))
  );
  expect(result.sort()).toEqual([false, true]);
  expect(requests.every(item => item.method === "PUT" && item.sha === undefined)).toBe(true);
  expect(await provider.downloadFile("commit")).toEqual(new Uint8Array([1]));
});
it("8 MiB 分块使用原始字节下载，不依赖 JSON 内嵌内容", async () => {
  const bytes = new Uint8Array(8 * 1024 * 1024).fill(71);
  expect(await provider.uploadFile("chunks/large.bin", bytes)).toBe(true);
  expect(await provider.fileExists("chunks/large.bin")).toBe(true);
  const downloaded = await provider.downloadFile("chunks/large.bin");
  expect(downloaded.byteLength).toBe(bytes.byteLength);
  expect(await crypto.subtle.digest("SHA-256", new Uint8Array(downloaded))).toEqual(
    await crypto.subtle.digest("SHA-256", bytes)
  );
});
it("递归列举相对路径及Git SHA，404为空目录或不存在", async () => {
  await provider.uploadFile("a", new Uint8Array([1]));
  await provider.uploadFile("nested/b", new Uint8Array([2]));
  expect((await provider.listFiles()).map(item => [item.path, item.hash])).toEqual([
    ["a", "1"],
    ["nested/b", "2"],
  ]);
  expect(await provider.listFiles("missing")).toEqual([]);
  expect(await provider.fileExists("missing")).toBe(false);
});
it.each([403, 500])("%s不伪装为空目录或不存在，不发起覆盖PUT", async status => {
  failure = status;
  await expect(provider.listFiles()).rejects.toMatchObject({ status });
  await expect(provider.fileExists("data")).rejects.toMatchObject({ status });
  expect(await provider.uploadFile("data", new Uint8Array([1]))).toBe(false);
  expect(requests.every(item => item.method === "GET")).toBe(true);
});

it("大文件存在性使用元数据读取，内容读取选择 raw 媒体类型", async () => {
  expect(await provider.uploadFile("a.bin", new Uint8Array([1]))).toBe(true);
  const count = requests.length;
  expect(await provider.fileExists("a.bin")).toBe(true);
  expect(requests.slice(count)).toHaveLength(1);
});
