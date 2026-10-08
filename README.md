# Amfglaxy 的博客

这是一个从零开始的个人博客，使用 Hugo 和 PaperMod 主题。文章保存在本地 Markdown 文件中，网站已发布到 <https://amfglaxy.github.io/>，源码仓库是 <https://github.com/Amfglaxy/Amfglaxy.github.io>。

## 1. 本地预览

在 PowerShell 中运行：

```powershell
cd G:\Blog
hugo server -D
```

浏览器打开 <http://localhost:1313/>。`-D` 会显示草稿；按 `Ctrl+C` 停止预览。首次安装 Hugo 后，如果当前终端找不到 `hugo`，关闭终端再打开一次。

## 2. 写第一篇文章

打开 `content/posts/first-post.md`，把示例文字改成你自己的内容。它目前是草稿，不会公开发布。写好后，将文件顶部的 `draft: true` 改成 `draft: false`。

以后新建文章可运行：

```powershell
cd G:\Blog
hugo new posts/my-next-post.md
```

文件会出现在 `content/posts/`；新文章默认也是草稿。纯 Markdown 和附带图片的文章都可以写。需要配图时，可以创建 `content/posts/文章目录/index.md`，将图片放在同一目录，并在正文用 `![说明](图片名.png)` 引用。

## 3. 发布前检查

```powershell
cd G:\Blog
hugo --gc --minify
```

此命令只构建已发布文章，产物在 `public/`，该目录不会进入 Git。博客名和首页介绍可在 `hugo.toml` 修改；个人介绍在 `content/about.md`。

## 4. GitHub Pages 自动发布

仓库已经创建，**Settings → Pages → Source** 已设为 **GitHub Actions**。每次向 `main` 分支推送提交，工作流都会重新构建并发布网站。可以在[仓库的 Actions 页面](https://github.com/Amfglaxy/Amfglaxy.github.io/actions)查看结果。

写好文章并将 `draft` 改成 `false` 后，在 PowerShell 中运行：

```powershell
cd G:\Blog
git -c safe.directory=G:/Blog add .
git -c safe.directory=G:/Blog commit -m "Add a post"
git -c safe.directory=G:/Blog push
```

工作流会自动按仓库的 Pages 地址设置站点 URL。

## 5. 日常写作

编辑文章 → 用 `hugo server -D` 预览 → 将 `draft` 改成 `false` → 按上面的命令提交并推送。

这里的 `-c safe.directory=G:/Blog` 只对当前 Git 命令生效，用来兼容自动化环境创建仓库时产生的目录所有权差异。

## 6. 网页文档库与隐私空间

[文档库](https://amfglaxy.github.io/library/)允许站点主人在网页中上传 PDF、HTML、Word、Excel 和 PowerPoint 文件。每个文件不能超过 50 MB。上传时默认选择“仅自己可见”；如果改为“公开”，文件和目录信息对所有访客开放。HTML 文件一律作为附件下载，不在博客页面中执行。

文档不保存在这个 Git 仓库或 GitHub Pages 中。元数据与文件存放在 Supabase 项目 `amfglaxy-blog`。公开文件使用 `library-public` 桶，私有文件使用 `library-private` 桶；数据库和存储权限配置在 [`supabase/library.sql`](supabase/library.sql)。登录使用邮箱一次性链接，只有在 `private.library_owners` 中登记的 Supabase Auth 用户能上传和读取私有文件。网页中只包含可公开的 publishable key，**不要把数据库密码、secret/service_role key、私有文件或登录链接提交到仓库**。

首次启用时，在 Supabase SQL Editor 执行 `supabase/library.sql`，并在 Authentication → URL Configuration 将 Site URL 与 Redirect URL 设为 `https://amfglaxy.github.io/library/`。用你在 Supabase 组织中的邮箱从文档库页面首次登录后，在 Authentication → Users 复制该用户的 UUID，并在 SQL Editor 执行：

```sql
insert into private.library_owners (user_id)
values ('在此填入你的 Auth 用户 UUID')
on conflict do nothing;
```

登记后刷新文档库页面，即可看到上传表单和隐私空间。建议随后在 Authentication → Sign In / Providers 关闭新用户注册。内置邮件服务的发送额度较低；若将来需要频繁登录，可在 Supabase 配置自有 SMTP 服务。

本地预览文档库前，需要先构建浏览器脚本：

```powershell
pnpm install
pnpm run build:library
hugo server -D
```

GitHub Actions 会在发布时自动安装依赖并构建脚本。修改 `assets/js/library.js` 后，本地再次运行 `pnpm run build:library` 才能在预览中看到新脚本。
