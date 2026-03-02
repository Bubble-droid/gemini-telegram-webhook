{
  "tag": "code",
  "attrs": {
    "class": "language-javascript"
  },
  "children": [
    "const html = await marked.parse(markdown);\nconst domNodes = await markdownToTelegraph(markdown);\n"
  ]
}
{
  "tag": "code",
  "children": [
    "<p>段落</p>\n<p>\n  <storage>粗体</storage>\n</p>\n"
  ]
}
Original Input: 
 ````markdown

喵~ 🐾 助理为您准备了一篇关于 `GUI.for.Cores` 客户端**滚动发行更新机制**的帖子！

---

# 🚀 GUI.for.Cores 滚动发行更新机制：更快、更稳、更便捷！

亲爱的用户们，您是否还在为客户端更新的繁琐步骤而烦恼？`GUI.for.Cores` 客户端（包括 `GUI.for.Clash` 和 `GUI.for.SingBox`）为您带来了**滚动发行 (Rolling Release)** 更新机制，旨在提供更用户友好、更快速、更稳定、更便捷的 GUI 体验！

## 🌟 什么是滚动发行？

滚动发行是一种高效的更新方式，它：

- **全平台友好**：无论您使用 Windows、GNU/Linux 还是 macOS，都能享受到一致的便捷更新体验。
- **支持自动更新**：告别手动下载和替换，让您的客户端始终保持最新。
- **下载体积更小**：相比传统更新方式，滚动发行下载的程序体积更小，在网络环境不佳时也能更快完成更新。

## 💡 如何启用和使用滚动发行？

启用滚动发行机制非常简单，只需遵循以下几个步骤：

1.  **前往设置页面**：在您的 `GUI.for.Cores` 客户端中，导航到 `设置` 页面。
2.  **开启“启用滚动发行”**：找到并勾选 `启用滚动发行` 选项。
3.  **安装“滚动发行”插件**：在插件中心安装名为 `滚动发行` 的插件。
4.  **运行插件进行更新**：安装完成后，运行该插件，它将自动为您更新应用程序。

## ⚠️ 重要提示！

- **版本要求**：滚动发行功能仅支持 `GUI.for.Clash v1.8.2` 及以上版本，以及 `GUI.for.SingBox v1.8.1` 及以上版本。请确保您的客户端版本符合要求。
- **设置与插件**：务必确保 `启用滚动发行` 设置已开启，并且 `滚动发行` 插件已安装并运行，这是该机制正常工作的关键。
- **回滚风险**：请注意，从滚动发行版本回滚到旧版本可能会导致配置文件不兼容，从而引发意外问题。在执行回滚操作前请务必谨慎！

---

希望这篇帖子能帮助您更好地理解和使用 `GUI.for.Cores` 的滚动发行更新机制！如果您有任何疑问，欢迎随时向助理提问，喵~ 😼

[参考来源 1](https://gui-for-cores.github.io/guide/09-update/)
[参考来源 2](https://gui-for-cores.github.io/zh/guide/09-update/)
[参考来源 3](https://github.com/GUI-for-Cores/Plugin-Hub/blob/main/plugins/Generic/plugin-rolling-release.js)
[参考来源 4](https://github.com/GUI-for-Cores/Plugin-Hub/blob/main/plugins/Generic/plugin-rolling-release.js)

---

```javascript
const html = await marked.parse(markdown);
const domNodes = await markdownToTelegraph(markdown);
```

---

```
<p>段落</p>
<p>
  <storage>粗体</storage>
</p>
```

````


Html: 
 ```html
<p>喵~ 🐾 助理为您准备了一篇关于 <code>GUI.for.Cores</code> 客户端<strong>滚动发行更新机制</strong>的帖子！</p>
<hr>
<h1>🚀 GUI.for.Cores 滚动发行更新机制：更快、更稳、更便捷！</h1>
<p>亲爱的用户们，您是否还在为客户端更新的繁琐步骤而烦恼？<code>GUI.for.Cores</code> 客户端（包括 <code>GUI.for.Clash</code> 和 <code>GUI.for.SingBox</code>）为您带来了<strong>滚动发行 (Rolling Release)</strong> 更新机制，旨在提供更用户友好、更快速、更稳定、更便捷的 GUI 体验！</p>
<h2>🌟 什么是滚动发行？</h2>
<p>滚动发行是一种高效的更新方式，它：</p>
<ul>
<li><strong>全平台友好</strong>：无论您使用 Windows、GNU/Linux 还是 macOS，都能享受到一致的便捷更新体验。</li>
<li><strong>支持自动更新</strong>：告别手动下载和替换，让您的客户端始终保持最新。</li>
<li><strong>下载体积更小</strong>：相比传统更新方式，滚动发行下载的程序体积更小，在网络环境不佳时也能更快完成更新。</li>
</ul>
<h2>💡 如何启用和使用滚动发行？</h2>
<p>启用滚动发行机制非常简单，只需遵循以下几个步骤：</p>
<ol>
<li><strong>前往设置页面</strong>：在您的 <code>GUI.for.Cores</code> 客户端中，导航到 <code>设置</code> 页面。</li>
<li><strong>开启“启用滚动发行”</strong>：找到并勾选 <code>启用滚动发行</code> 选项。</li>
<li><strong>安装“滚动发行”插件</strong>：在插件中心安装名为 <code>滚动发行</code> 的插件。</li>
<li><strong>运行插件进行更新</strong>：安装完成后，运行该插件，它将自动为您更新应用程序。</li>
</ol>
<h2>⚠️ 重要提示！</h2>
<ul>
<li><strong>版本要求</strong>：滚动发行功能仅支持 <code>GUI.for.Clash v1.8.2</code> 及以上版本，以及 <code>GUI.for.SingBox v1.8.1</code> 及以上版本。请确保您的客户端版本符合要求。</li>
<li><strong>设置与插件</strong>：务必确保 <code>启用滚动发行</code> 设置已开启，并且 <code>滚动发行</code> 插件已安装并运行，这是该机制正常工作的关键。</li>
<li><strong>回滚风险</strong>：请注意，从滚动发行版本回滚到旧版本可能会导致配置文件不兼容，从而引发意外问题。在执行回滚操作前请务必谨慎！</li>
</ul>
<hr>
<p>希望这篇帖子能帮助您更好地理解和使用 <code>GUI.for.Cores</code> 的滚动发行更新机制！如果您有任何疑问，欢迎随时向助理提问，喵~ 😼</p>
<p><a href="https://gui-for-cores.github.io/guide/09-update/">参考来源 1</a><br><a href="https://gui-for-cores.github.io/zh/guide/09-update/">参考来源 2</a><br><a href="https://github.com/GUI-for-Cores/Plugin-Hub/blob/main/plugins/Generic/plugin-rolling-release.js">参考来源 3</a><br><a href="https://github.com/GUI-for-Cores/Plugin-Hub/blob/main/plugins/Generic/plugin-rolling-release.js">参考来源 4</a></p>
<hr>
<pre><code class="language-javascript">const html = await marked.parse(markdown);
const domNodes = await markdownToTelegraph(markdown);
</code></pre>
<hr>
<pre><code>&lt;p&gt;段落&lt;/p&gt;
&lt;p&gt;
  &lt;storage&gt;粗体&lt;/storage&gt;
&lt;/p&gt;
</code></pre>

```


DOM: 
 ```json
[
  {
    "tag": "p",
    "children": [
      "喵~ 🐾 助理为您准备了一篇关于 ",
      {
        "tag": "code",
        "children": [
          "GUI.for.Cores"
        ]
      },
      " 客户端",
      {
        "tag": "strong",
        "children": [
          "滚动发行更新机制"
        ]
      },
      "的帖子！"
    ]
  },
  {
    "tag": "hr"
  },
  {
    "tag": "h3",
    "children": [
      "🚀 GUI.for.Cores 滚动发行更新机制：更快、更稳、更便捷！"
    ]
  },
  {
    "tag": "p",
    "children": [
      "亲爱的用户们，您是否还在为客户端更新的繁琐步骤而烦恼？",
      {
        "tag": "code",
        "children": [
          "GUI.for.Cores"
        ]
      },
      " 客户端（包括 ",
      {
        "tag": "code",
        "children": [
          "GUI.for.Clash"
        ]
      },
      " 和 ",
      {
        "tag": "code",
        "children": [
          "GUI.for.SingBox"
        ]
      },
      "）为您带来了",
      {
        "tag": "strong",
        "children": [
          "滚动发行 (Rolling Release)"
        ]
      },
      " 更新机制，旨在提供更用户友好、更快速、更稳定、更便捷的 GUI 体验！"
    ]
  },
  {
    "tag": "h3",
    "children": [
      "🌟 什么是滚动发行？"
    ]
  },
  {
    "tag": "p",
    "children": [
      "滚动发行是一种高效的更新方式，它："
    ]
  },
  {
    "tag": "ul",
    "children": [
      {
        "tag": "li",
        "children": [
          {
            "tag": "strong",
            "children": [
              "全平台友好"
            ]
          },
          "：无论您使用 Windows、GNU/Linux 还是 macOS，都能享受到一致的便捷更新体验。"
        ]
      },
      {
        "tag": "li",
        "children": [
          {
            "tag": "strong",
            "children": [
              "支持自动更新"
            ]
          },
          "：告别手动下载和替换，让您的客户端始终保持最新。"
        ]
      },
      {
        "tag": "li",
        "children": [
          {
            "tag": "strong",
            "children": [
              "下载体积更小"
            ]
          },
          "：相比传统更新方式，滚动发行下载的程序体积更小，在网络环境不佳时也能更快完成更新。"
        ]
      }
    ]
  },
  {
    "tag": "h3",
    "children": [
      "💡 如何启用和使用滚动发行？"
    ]
  },
  {
    "tag": "p",
    "children": [
      "启用滚动发行机制非常简单，只需遵循以下几个步骤："
    ]
  },
  {
    "tag": "ol",
    "children": [
      {
        "tag": "li",
        "children": [
          {
            "tag": "strong",
            "children": [
              "前往设置页面"
            ]
          },
          "：在您的 ",
          {
            "tag": "code",
            "children": [
              "GUI.for.Cores"
            ]
          },
          " 客户端中，导航到 ",
          {
            "tag": "code",
            "children": [
              "设置"
            ]
          },
          " 页面。"
        ]
      },
      {
        "tag": "li",
        "children": [
          {
            "tag": "strong",
            "children": [
              "开启“启用滚动发行”"
            ]
          },
          "：找到并勾选 ",
          {
            "tag": "code",
            "children": [
              "启用滚动发行"
            ]
          },
          " 选项。"
        ]
      },
      {
        "tag": "li",
        "children": [
          {
            "tag": "strong",
            "children": [
              "安装“滚动发行”插件"
            ]
          },
          "：在插件中心安装名为 ",
          {
            "tag": "code",
            "children": [
              "滚动发行"
            ]
          },
          " 的插件。"
        ]
      },
      {
        "tag": "li",
        "children": [
          {
            "tag": "strong",
            "children": [
              "运行插件进行更新"
            ]
          },
          "：安装完成后，运行该插件，它将自动为您更新应用程序。"
        ]
      }
    ]
  },
  {
    "tag": "h3",
    "children": [
      "⚠️ 重要提示！"
    ]
  },
  {
    "tag": "ul",
    "children": [
      {
        "tag": "li",
        "children": [
          {
            "tag": "strong",
            "children": [
              "版本要求"
            ]
          },
          "：滚动发行功能仅支持 ",
          {
            "tag": "code",
            "children": [
              "GUI.for.Clash v1.8.2"
            ]
          },
          " 及以上版本，以及 ",
          {
            "tag": "code",
            "children": [
              "GUI.for.SingBox v1.8.1"
            ]
          },
          " 及以上版本。请确保您的客户端版本符合要求。"
        ]
      },
      {
        "tag": "li",
        "children": [
          {
            "tag": "strong",
            "children": [
              "设置与插件"
            ]
          },
          "：务必确保 ",
          {
            "tag": "code",
            "children": [
              "启用滚动发行"
            ]
          },
          " 设置已开启，并且 ",
          {
            "tag": "code",
            "children": [
              "滚动发行"
            ]
          },
          " 插件已安装并运行，这是该机制正常工作的关键。"
        ]
      },
      {
        "tag": "li",
        "children": [
          {
            "tag": "strong",
            "children": [
              "回滚风险"
            ]
          },
          "：请注意，从滚动发行版本回滚到旧版本可能会导致配置文件不兼容，从而引发意外问题。在执行回滚操作前请务必谨慎！"
        ]
      }
    ]
  },
  {
    "tag": "hr"
  },
  {
    "tag": "p",
    "children": [
      "希望这篇帖子能帮助您更好地理解和使用 ",
      {
        "tag": "code",
        "children": [
          "GUI.for.Cores"
        ]
      },
      " 的滚动发行更新机制！如果您有任何疑问，欢迎随时向助理提问，喵~ 😼"
    ]
  },
  {
    "tag": "p",
    "children": [
      {
        "tag": "a",
        "attrs": {
          "href": "https://gui-for-cores.github.io/guide/09-update/"
        },
        "children": [
          "参考来源 1"
        ]
      },
      {
        "tag": "br"
      },
      {
        "tag": "a",
        "attrs": {
          "href": "https://gui-for-cores.github.io/zh/guide/09-update/"
        },
        "children": [
          "参考来源 2"
        ]
      },
      {
        "tag": "br"
      },
      {
        "tag": "a",
        "attrs": {
          "href": "https://github.com/GUI-for-Cores/Plugin-Hub/blob/main/plugins/Generic/plugin-rolling-release.js"
        },
        "children": [
          "参考来源 3"
        ]
      },
      {
        "tag": "br"
      },
      {
        "tag": "a",
        "attrs": {
          "href": "https://github.com/GUI-for-Cores/Plugin-Hub/blob/main/plugins/Generic/plugin-rolling-release.js"
        },
        "children": [
          "参考来源 4"
        ]
      }
    ]
  },
  {
    "tag": "hr"
  },
  {
    "tag": "pre",
    "children": [
      "// Language: javascript\n// ————————————\nconst html = await marked.parse(markdown);\nconst domNodes = await markdownToTelegraph(markdown);\n"
    ]
  },
  {
    "tag": "hr"
  },
  {
    "tag": "pre",
    "children": [
      "// Language: Unknown\n// —————————\n<p>段落</p>\n<p>\n  <storage>粗体</storage>\n</p>\n"
    ]
  }
]
```
