# Amfglaxy 的博客

这是一个从零开始的个人博客，使用 Hugo 和 PaperMod 主题。文章是本地 Markdown 文件；GitHub Pages 工作流已准备好，连接你的 GitHub 仓库后即可自动部署。

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

## 4. 发布到 GitHub Pages

1. 在 GitHub 创建一个**公开、空白**的仓库，名称为 `Amfglaxy.github.io`。博客网址将是 <https://amfglaxy.github.io/>。
2. 在仓库的 **Settings → Pages** 中，将 **Build and deployment → Source** 设为 **GitHub Actions**。
3. 本地仓库和第一次提交已准备好。确认 GitHub 仓库已创建后，在 `G:\Blog` 的 PowerShell 推送：

```powershell
git -c safe.directory=G:/Blog push -u origin main
```

推送后可在仓库 **Actions** 页查看构建。工作流会自动按仓库的 Pages 地址设置站点 URL。

## 5. 日常写作

编辑文章 → 用 `hugo server -D` 预览 → 将 `draft` 改成 `false` → `git -c safe.directory=G:/Blog add .`、`git -c safe.directory=G:/Blog commit -m "Add a post"`、`git -c safe.directory=G:/Blog push`。每次推送到 `main` 分支都会触发部署。

这里的 `-c safe.directory=G:/Blog` 只对当前 Git 命令生效，用来兼容自动化环境创建仓库时产生的目录所有权差异。
