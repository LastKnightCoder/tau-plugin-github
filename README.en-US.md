# GitHub Sync Storage

Sync your Tau notes, conversations, and attachments to your own GitHub repository, so you can access the same library across desktop and mobile devices.

## Getting Started

1. Create a repository and branch on GitHub first. A dedicated **private** repository is recommended.
2. Generate a GitHub Personal Access Token with read and write permissions for that repository's contents.
3. Install **GitHub Sync Storage** from the Plugin Center, then enable it under **Installed** on the Plugins page.
4. Open **Settings** on the plugin details page, enter your **Access token**, and select the **Repository** and **Branch**. Leave **Repository owner** empty to use the token's account, and leave **Directory** empty if not needed.
5. Save and test the connection, then go to **Settings → Sync** and select this service to check status, upload, download, or enable automatic sync. Saving settings does not automatically switch your active sync service.

## FAQ

**Repository or branch not found?** The plugin does not create repositories or branches for you. Create them on GitHub first and make sure your access token has read and write permissions for that repository.

**Is this suitable for many or large attachments?** Not ideal. GitHub enforces file size and rate limits. If you have many or large attachments, consider an object storage service such as S3 or Alibaba Cloud OSS instead.

**Can multiple libraries share the same storage location?** No. Use a separate storage location for each library (you can separate them using **Directory**), otherwise data will overwrite each other.

**Does disabling the plugin delete my data?** No. Both your settings and synced data stay intact and work again once you re-enable the plugin. You cannot disable or uninstall the plugin while a sync is in progress; wait until it finishes first.

## Notes

- Works on desktop and mobile. If you also use the asset upload plugin, sync and upload credentials are configured separately and do not affect each other.
- Treat your access token like your GitHub password. Never share it with others or include it in screenshots or issue reports.
