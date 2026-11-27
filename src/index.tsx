import { messages } from "./i18n";
import { definePlugin } from "@tau/plugins";
import { createGithubForm } from "./form";
import { createGithubSyncProvider } from "./sync";

declare const __PLUGIN_META__: { id: string; name: string; version: string };

export default definePlugin({
  ...__PLUGIN_META__,
  i18n: messages,
  create: () => ({
    activate(context) {
      context.sync.register({
        id: context.pluginId,
        name: "GitHub",
        create: config => createGithubSyncProvider(config, context.fetch),
      });
      context.settings.register({
        id: "sync",
        title: "GitHub",
        target: "sync",
        form: createGithubForm(context.fetch, { pathPlaceholder: "sync", upload: false }),
      });
    },
  }),
});
