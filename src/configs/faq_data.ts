// src/configs/faq_data.ts

/**
 * @interface FaqItem
 * @description 定义单个 FAQ 条目的结构。
 * @property {string[][]} keywordGroups - 正则表达式模式组。外层数组代表“或”关系，内层数组代表“与”关系。
 *                                        用户的消息必须满足至少一个内层数组的所有正则模式才算匹配。
 * @property {string[][] | undefined} excludeKeywords - [结构升级] 排除规则组。外层数组为 OR，内层数组为 AND。
 *                                                      如果消息匹配任意一个内层数组的所有正则，则不匹配此条目。
 * @property {string} answer - 对应的回答内容。
 */
interface FaqItem {
  keywordGroups: string[][];
  excludeKeywords?: string[][];
  answer: string;
}

/**
 * @const faqData
 * @description 存储所有 FAQ 问答对及其匹配的正则表达式模式。
 *              规则的顺序至关重要：越具体的规则应越靠前，越通用的规则应越靠后。
 */
export const faqData: FaqItem[] = [
  // ⚙️ B.2.1 常规与界面 (General & UI)
  {
    keywordGroups: [
      ['(开机)?自启(动)?', '([不没无]法?|不能)生效|(启动)?失败|没用|不行|搞不定|起不来|没效果'],
      ['autostart|boot start', 'fail|not working|doesn.?t work|no effect'],
      ['(launch|start) on (startup|boot)', 'fail|not working|issue|problem'],
    ],
    answer: `**Q: 自启动不生效？**

A: 请按以下顺序排查：
1. **路径检查**：确保程序可执行文件所在的完整路径中，不包含中文、空格或特殊字符。
2. **安全软件拦截**：检查您的安全软件（如杀毒软件、系统管家）是否有拦截或阻止本程序添加开机启动项的行为。
3. **管理员权限 (Windows)**：前往 **设置 -> 通用**，启用 **以管理员身份运行** 并重启客户端。`,
  },
  {
    keywordGroups: [
      ['滚动(发行)?', '(更新|升级|update|upgrade)', '([不没无]法?|不能)了?|失败|不动|卡住|报错|出问题'],
      // --- 新增英文关键词 ---
      ['rolling(-?release)?', '(update|upgrade)', 'fail|stuck|error|issue|problem'],
    ],
    excludeKeywords: [
      ['内核', '(启|运)动|打不开|崩了|挂了'], // 排除描述更新后内核问题的场景
      ['core', 'start|launch|run', 'fail|crash'],
    ],
    answer: `**Q: 滚动发行无法更新？**

A:
1. 首先，在 **插件中心** 检查并更新 **滚动发行** 插件本身至最新版本。
2. 如果问题依旧，请尝试删除程序目录下的 \`data/rolling-release\` 文件夹后重试。`,
  },
  {
    keywordGroups: [
      ['(跨|升)大版本', '(提示|报错|[不没无]法?|不能)'],
      ['major version', 'upgrade', 'error|fail|can.?t'],
    ],
    answer: `**Q: 滚动发行提示无法跨大版本升级？**

A: 滚动发行插件仅在当前最新的大版本内工作。当发布新的大版本后，您需要前往 **设置 -> 关于** 页面，手动检查并更新 GUI 客户端主程序。`,
  },
  {
    keywordGroups: [
      ['(首页|主页|面板)', '只(有)?(显示)?(4|四)个|太少|空|没了|不见了'],
      ['dashboard|home page', 'only (shows? )?4|empty|gone|missing'],
    ],
    answer: `**Q: 首页只显示 4 个配置项？**

A: 这是程序设计。您可以在 **配置** 页面通过拖拽来调整配置文件的显示顺序。`,
  },
  {
    keywordGroups: [
      ['(怎么|如何|咋)', '(更换|修改|换|改|自定义)', '(托盘)?图标'],
      ['tray icon', 'change|replace|customize'],
    ],
    answer: `**Q: 如何更换托盘图标？**

A:
1. 前往 **设置 -> 打开应用程序文件夹**。
2. 替换或修改 \`data/.cache/icons\` 目录下的图标文件。`,
  },
  {
    keywordGroups: [
      ['linux', '(字体|文字)', '(偏高|位置[不无]对|偏移|错位)'],
      ['linux', 'font|text', 'position|offset|too high|misaligned'],
    ],
    answer: `**Q: Linux 桌面系统上 GUI 文字位置偏高？**

A: 尝试安装 \`Noto-Sans-CJK\` 和 \`Microsoft-YaHei\` 字体后重启系统（此方法不保证在所有环境下都有效）。`,
  },

  // 🌐 B.2.2 网络与订阅 (Network & Subscription)
  {
    keywordGroups: [['403'], ['rate limit exceeded'], ['(github|api).*(限制|rate limit)']],
    answer: `**Q: GitHub API 速率限制 (403 rate limit exceeded)？**

A:
1. 访问您的 GitHub 开发者设置，生成一个新的 Personal Access Token (PAT)。
2. 在客户端的 **设置 -> 通用** 中，将获取的 Token 填入 **向 REST API 进行身份验证** 一栏。`,
  },
  {
    keywordGroups: [
      ['订阅', '[没无](有)?(流量|速度|信息)|用不了|连不上|没速度'],
      ['subscription', 'no traffic (info)?|not a valid'],
      // --- 新增英文关键词 ---
      ['subscription', '(doesn.?t|not) work|fail(ed)? to update|can.?t update'],
    ],
    excludeKeywords: [['tun']],
    answer: `**Q: 订阅无流量信息或更新失败？**

A:
*   在 **订阅 -> 编辑** 中，为目标订阅添加请求头 \`User-Agent\`: \`Clash.Meta\`。
    *   **GUI.for.SingBox 额外操作**: 确保已安装 **节点转换** 插件。
*   同时，请确保当前网络环境可以正常访问该订阅链接。`,
  },
  {
    keywordGroups: [
      ['多(个)?网卡', '网络.*(异常|问题|用不了)|(连|上)不了网|断流'],
      ['(wifi|无线|有线|网线)', '(一起|同时)用', '([不没无]法?|不能)上网'],
      ['multiple network cards?', 'issue|problem'],
      // --- 新增英文关键词 ---
      ['multiple network (interfaces?|cards?)', '(internet|network) issue|problem|connection lost'],
    ],
    answer: `**Q: 多网卡设备网络异常？**

A:
1. 前往 **配置设置 -> 路由设置 -> 通用**。
2. 禁用 **自动检测出站接口** 选项。
3. 在下方的出站接口名称列表中，手动选择正确的物理网卡作为出站接口。`,
  },

  // ⚙️ B.2.3 配置与导入 (Configuration & Import)
  {
    keywordGroups: [
      ['(怎么|如何|咋)', '(导入|添加|载入|放进去|用|应用|加载)', '(自定义|自己.*|完整.*|写好)?.*配置(文件)?.*(运行|启动)?.*'],
      ['import', 'custom config|full config|apply|load'],
      // --- 新增英文关键词 ---
      ['how to', '(import|load|use|apply)', '(my|a) (custom|full|own) config(uration)?'],
    ],
    answer: `**Q: 如何导入自定义配置文件？**

A: GUI.for.Cores 本身不直接支持导入完整的配置文件，但可通过特定功能实现：
*   **GUI.for.Clash**: 添加订阅时，启用 **使用订阅内的策略组和分流规则** 选项。
*   **GUI.for.SingBox**: 使用 **配置脚本** 功能实现，具体代码示例请询问助理。`,
  },
  {
    keywordGroups: [
      ['(怎么|如何|咋)', '(导入|添加|加入|粘贴|使用)', '(单个)?节点|vmess|ss|vless|trojan'],
      ['import', 'single node|vmess|paste'],
      // --- 新增英文关键词 ---
      ['how to', '(import|add|paste)', 'single node|share link'],
    ],
    answer: `**Q: 如何导入单个节点链接 (如 vmess://)？**

A:
1. 在 **插件中心** 安装并运行 **节点转换插件**。
2. 在插件界面粘贴节点链接，选择配置格式，然后复制转换后的节点配置内容。
3. 将复制的内容添加至 **手动管理订阅**。
4. 在 **配置设置** 的 **出站分组** 或 **代理组** 中引用该节点。`,
  },

  // 🐞 B.2.4 内核错误 (Core Errors)
  {
    keywordGroups: [['cache-file.*timeout']],
    answer: `**Q: 报错 "start service: initialize cache-file: timeout"？**

A:
*   **原因**: sing-box 缓存文件被占用，通常是由于进程未正常退出。
*   **解决方案**: 打开任务管理器（或活动监视器），手动结束所有名为 \`sing-box\` 的进程，然后重启内核。`,
  },
  {
    keywordGroups: [['detour.*empty direct']],
    answer: `**Q: 报错 "detour to an empty direct outbound makes no sense"？**

A:
*   **原因**: 新版 sing-box 禁止将 DNS 服务器的出站设置为 \`direct\`。
*   **解决方案**:
    1. 前往 **配置设置 -> DNS 设置 -> 服务器**。
    2. 找到“出站”标签为 \`直连\` 的服务器，点击 **编辑**。
    3. 点击出站标签旁边的 **x** 按钮将其清空（留空默认即为直连）。`,
  },
  {
    keywordGroups: [['missing.*tags']],
    answer: `**Q: 报错 "create service: initialize outbound[*]: missing tags"？**

A:
*   **原因**: 某个出站分组内没有任何节点或有效分组。
*   **解决方案**: 前往 **配置设置 -> 出站设置**，找到左侧有红色感叹号的出站分组，点击 **编辑** 并确保其至少包含一个订阅或有效节点。`,
  },

  // 🛡️ B.2.5 TUN 模式专项 (TUN Mode Specifics)
  {
    keywordGroups: [
      ['tun(模式)?', '([没无]|缺少)权限|permission denied'],
      ['tun(模式)?', '(启动|开启|打开)失败', '(权限|permission)'],
      ['(linux|内核)', '(怎么|如何|咋)', '(给|授(予)?)?(特)?权|提权|管理员'],
      // --- 新增英文关键词 ---
      ['tun( mode)?', 'permission|privilege|admin rights|sudo|root'],
    ],
    excludeKeywords: [['file not found']],
    answer: `**Q: TUN 模式无权限导致启动失败？**

A:
*   **Windows**: 前往 **设置 -> 通用**，启用 **以管理员身份运行** 并重启客户端。
*   **macOS/Linux**: 前往 **设置 -> 内核** 页面，点击授权按钮为内核程序授权。`,
  },
  {
    keywordGroups: [
      ['linux', '授权', '[没无]反应|点不了|点了没用|按了没反应'],
      ['linux', 'pkexec'],
      ['(授(予)?|给)(特)?权', '没(有)?(效果|反应)|点(了)?没用'],
      // --- 新增英文关键词 ---
      ['linux', 'authorize button', 'doesn.?t work|no response|nothing happens'],
    ],
    answer: `**Q: Linux 点击授权按钮没反应？**

A: Linux 上的授权操作依赖 \`pkexec\` 命令，需确保已安装提供此命令的软件包。`,
  },
  {
    keywordGroups: [['tun.*configure.*system cannot find the file']],
    answer: `**Q: 报错 "configure tun interface: The system cannot find the file specified."？**

A:
*   **原因**: sing-box 无法创建 TUN 虚拟网卡。
*   **解决方案**:
    1. 检查 **入站设置** -> \`tun-in\` 的 **TUN 网卡名称** 是否为空，尝试填入任意名称（如 \`sing-box-tun\`）。
    2. 确保没有其他应用（如其他代理软件、VPN）占用了 TUN 服务。`,
  },
  {
    keywordGroups: [
      // 通用关键词
      ['tun(模式)?', '([没无]反应)|(([没无不]法?|不能|连不上|上不了|没).*网(络)?)'],
      ['tun(模式)?', '系统代理', '(才|必须|要开|依赖|同时)'],
      ['tun(模式)?', '(断网|网络(异常|问题|断了))'],
      ['tun', '(一开|打开|启用).*(就)?', '(没网|断网|上不了网)'],
      ['tun(模式)?', '(打不开|无法访问)', '(网站|网页|github|google)'],
      ['(启动|运行|开)了?.*(内核|tun)', '(就)?(没网|断网|上不了网)'],
      ['tun(模式)?', '(只|仅)能.*(tg|电报|telegram)', '(网页|网站|浏览器).*(打不开|没反应|用不了)'],
      // macOS 特定关键词
      ['(mac|macos)', 'tun(模式)?', '([没无]反应)|(([没无不]法?|不能|连不上|上不了|没).*网(络)?|断网)'],
      // 英文关键词
      ['tun( mode)?', '(no|lost) (internet|connection)|can.?t connect|not working'],
      ['(mac|macos)', 'tun( mode)?', '(no|lost) (internet|connection)|can.?t connect|not working'],
      ['enable tun', 'lose internet|no network'],
      ['tun( mode)?', '(only|just) (tg|telegram) works', '(browser|website)s? (doesn.?t|not) work'],
    ],
    excludeKeywords: [
      // 注意：这里不再排除 macos
      ['permission denied'], // 排除权限问题
      ['file not found'], // 排除文件找不到问题
      ['(ssl|证书).*(错误|error)'], // 排除 SSL 证书问题
    ],
    answer: `**Q: TUN 模式启动后无法上网？**

A: 请按以下顺序排查，方案覆盖 Windows, macOS 及 Linux：
*   **方案 A (通用): 更换 TUN 堆栈模式**
    在软件设置中尝试更换 **TUN 堆栈模式** (如 GVisor, System)。

*   **方案 B (macOS 特定): 修改系统 DNS**
    *   **原因**: sing-box 在 macOS 上不劫持发往局域网的 DNS 请求。
    *   **解决方案**: 将您 Mac 的系统 DNS 修改为任意公共 DNS 服务器（例如 \`8.8.8.8\`）。

*   **方案 C (Windows 特定): 检查防火墙**
    检查 Windows 防火墙设置，确保 GUI 客户端及其内核程序未被阻止。

*   **方案 D (通用 / IPv6 问题): 调整 IPv6 设置**
    如果您的网络不支持 IPv6，请进行以下调整：
    1.  **配置设置 -> 入站设置** -> \`tun-in\` -> 删除 IPv6 地址前缀，并启用 **严格路由**。
    2.  **配置设置 -> DNS 设置 -> 通用** -> 将 **解析策略** 设为 \`只使用 IPv4\`。

*   **方案 E (通用 / IP 冲突): 修改 IP 地址前缀**
    前往 **配置设置 -> 入站设置** -> \`tun-in\`，尝试修改 **IP 地址前缀** 为一个冷门的私有网段，以避免与当前局域网或其他网络接口产生冲突。`,
  },
  {
    keywordGroups: [
      ['tun(模式)?', '(ssl|证书).*(错误|error)'],
      // --- 新增英文关键词 ---
      ['tun( mode)?', 'ssl|certificate', 'error|issue|problem'],
    ],
    answer: `**Q: TUN 模式下出现 SSL 证书错误？**

A: 尝试将您操作系统的 DNS 服务器地址修改为公共 DNS，例如 \`8.8.8.8\` 或 \`1.1.1.1\`。`,
  },

  // 📚 其他 (通用规则放在最后)
  {
    keywordGroups: [
      ['(怎么|如何|咋)', '(看|查看|打开|在哪)', '日志'],
      ['log', 'where|how to view|find'],
    ],
    answer: `**Q: 如何查看 GUI 日志？**

A: 按 \`Ctrl + Shift + F12\` 打开开发者工具控制台即可查看，主要记录 GUI 自身运行信息。`,
  },
  {
    keywordGroups: [
      ['(怎么|如何|咋)', '(启用|开启|打开)', '滚动(发行)?'],
      ['how to', 'enable', 'rolling(-release)?'],
    ],
    answer: `**Q: 怎么启用滚动发行？**

A:
1. 在 **通用设置** 中确保 **启用滚动发行** 已启用。
2. 在 **插件中心** 安装并运行 \`滚动发行\` 插件。
3. 定期在 **插件中心** 更新 \`滚动发行\` 插件。`,
  },
  {
    // 智能通用故障排查指南 (兜底规则)
    keywordGroups: [
      // 模式一：[操作] -> [负面结果]
      [
        '(更新|升级|重启|安装|设置|操作|搞了半天).*(之后|以后|完了)?',
        '(就|突然)?(启动|运行|用)不(起来)?了|打不开|挂了|崩了|没反应|失败|出问题|报错|寄了|坏了',
      ],
      // 模式二：[主体] -> [负面结果]
      ['(内核|程序|软件|客户端)', '(无法|不能|没法)?.*(启动|运行)|(启动|运行).*(不了|不起来|失败|没反应)|启动失败'],
      ['(内核|程序|软件|客户端)', '(启动|运行|开)了?(之后|以后)?', '(就)?(没网|断网|上不了网)'],

      // 模式三：模糊的网络问题
      ['(为啥|怎么回事|咋回事)', '(突然)?', '(上|连)不了网|没网了|断网了'],

      // 模式四：超模糊的“突然不能用”问题
      ['(突然|忽然|一下|怎么就)', '(用|连|启)不(了|动)|坏了|不行了|没反应了'],
      ['(昨天|之前)还(好好的|能用|正常)', '(今天|现在)就?(不行了|用不了|坏了)'],
      ['(啥也没干|没动过)', '就?(用不了|坏了|不行了)'],

      // 英文模式
      ['(app|client|core|program)', '(won.?t|doesn.?t|can.?t) (start|launch|run)|failed to (start|launch|run)'],
      ['(after|when) i (start|launch|run|update)', '(no|lost) internet|connection lost'],
      ['(why)? it suddenly stopped working', '(help)?'],
      ['it was working (fine|yesterday)', '(but )?now it doesn.?t'],
      ['it just broke|doesn.?t work anymore'],
    ],
    excludeKeywords: [
      ['tun'], // 仍然排除 'tun'，以确保优先匹配上面的专项规则
      ['订阅|subscription'],
      ['节点|node'],
      ['(截图|图片|视频|screenshot|image)'],
      ['(代码|堆栈|code|stack ?trace)'],
      ['[a-zA-Z]:\\\\[^\\s]*|[a-zA-Z/]+/[^\\s]*\\.[a-zA-Z]{2,}:\\d+'],
      ['\\b(fail(ed)?|exception|panic|fatal|timeout|denied|invalid|refused|unauthorized|missing|unexpected|error)\\b'],
      ['(异常|超时|拒绝|权限|找不到|无效|无法|错误码|未授权|缺少|意外的|报错)'],
      ['(日志|log)', '(错误|error|提示|显示|说)'],
    ],
    answer: `**Q: 程序无法启动或运行异常的通用排查指南**

你可能遇到了程序启动或运行问题，但未提供具体的错误信息。请首先尝试以下通用的解决方案，它们能解决大部分常见的故障。

0.0.1. **第一步：执行标准更新与检查流程**

请严格按照以下顺序，确保您的软件环境是最新且配置正确的：

1.  **更新主程序**: 前往 **软件设置 -> 关于** 页面，检测并更新 GUI 客户端至最新版本。
2.  **启用滚动发行**: 前往 **软件设置 -> 通用** 页面，确保 **启用滚动发行** 选项已启用。
3.  **更新滚动发行**: 前往 **插件中心**，安装或更新 **滚动发行** 插件至最新版本，并运行。
4.  **更新内核**: 前往 **软件设置 -> 内核** 页面，检测并更新内核至最新版本。

完成以上所有步骤后，请**重启内核**并检查问题是否解决。

0.0.2. **第二步：常见故障快速修复**

如果问题依旧，请尝试以下方案：

*   **结束残留进程**: 打开系统的任务管理器（或活动监视器），手动结束所有名为 \`sing-box\` 或 \`mihomo\` 的进程，然后重启内核。
*   **检查管理员权限**:
    *   **Windows**: 前往 **设置 -> 通用**，启用 **以管理员身份运行** 并重启客户端。
    *   **macOS/Linux**: 前往 **设置 -> 内核** 页面，点击授权按钮为内核程序重新授权。

0.0.3. **第三步：TUN 模式无法上网专项排查**

如果您的问题与 **TUN 模式** 相关（例如，开启后无法上网），请仔细遵循以下步骤：

*   **方案 A (通用): 更换 TUN 堆栈模式**
    在软件设置中尝试更换 **TUN 堆栈模式** (如 GVisor, System)。

*   **方案 B (macOS 特定): 修改系统 DNS**
    *   **原因**: sing-box 在 macOS 上不劫持发往局域网的 DNS 请求。
    *   **解决方案**: 将您 Mac 的系统 DNS 修改为任意公共 DNS 服务器（例如 \`8.8.8.8\`）。

*   **方案 C (Windows 特定): 检查防火墙**
    检查 Windows 防火墙设置，确保 GUI 客户端及其内核程序未被阻止。

*   **方案 D (通用 / IPv6 问题): 调整 IPv6 设置**
    如果您的网络不支持 IPv6，请进行以下调整：
    1.  **配置设置 -> 入站设置** -> \`tun-in\` -> 删除 IPv6 地址前缀，并启用 **严格路由**。
    2.  **配置设置 -> DNS 设置 -> 通用** -> 将 **解析策略** 设为 \`只使用 IPv4\`。

*   **方案 E (通用 / IP 冲突): 修改 IP 地址前缀**
    前往 **配置设置 -> 入站设置** -> \`tun-in\`，尝试修改 **IP 地址前缀** 为一个冷门的私有网段，以避免与当前局域网或其他网络接口产生冲突。

0.0.3. **最终步骤：如果问题仍未解决**

如果您已尝试上述所有方案但问题依旧，为了得到有效的帮助，请整理并提供以下内容：

**1. 环境与上下文信息**
*   **操作系统**: (例如: Windows 11 23H2, macOS Sonoma 14.5)
*   **GUI 客户端类型**: (GUI.for.Clash 或 GUI.for.SingBox)
*   **内核版本**:
*   **滚动发行版本**:
*   **代理模式**: (例如: TUN 模式, 系统代理模式等)

**2. 问题描述与证据**
*   **实际症状**: (程序实际表现出了什么问题？请客观描述现象。)
*   **复现步骤**: (您在问题出现前，具体执行了哪些操作？)

**3. 错误日志与截图**
*   请提供相关的**完整日志**、详细错误输出信息，或关键界面的**清晰截图/视频**。
`,
  },
];
