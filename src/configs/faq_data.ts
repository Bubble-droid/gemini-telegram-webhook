// src/configs/faq_data.ts

/**
 * @interface FaqItem
 * @description 定义单个 FAQ 条目的结构。
 * @property {string[][]} keywordGroups - 正则表达式模式组。外层数组代表“或”关系，内层数组代表“与”关系。
 *                                        用户的消息必须满足至少一个内层数组的所有正则模式才算匹配。
 * @property {string} answer - 对应的回答内容。
 */
interface FaqItem {
  keywordGroups: string[][];
  answer: string;
}

/**
 * @const faqData
 * @description 存储所有 FAQ 问答对及其匹配的正则表达式模式。
 *              每个模式都经过精心设计，以匹配多种口语化、非正式和模糊的提问方式。
 */
export const faqData: FaqItem[] = [
  // ⚙️ B.2.1 常规与界面 (General & UI)
  {
    keywordGroups: [
      ['(开机)?自启(动)?', '([不没无]法?|不能)生效|(启动)?失败|没用|不行|搞不定|起不来'],
      ['autostart|boot start', 'fail|not working|doesn.?t work'],
    ],
    answer: `**Q: 自启动不生效？**\n\nA: 请检查程序可执行文件所在的完整路径，确保其中不包含中文、空格或特殊字符。`,
  },
  {
    keywordGroups: [
      ['滚动(发行)?', '(更新|升级)', '([不没无]法?|不能)了?|失败|不动|卡住'],
      ['rolling(-release)?', '(update|upgrade)', 'fail|can.?t|stuck'],
    ],
    answer: `**Q: 滚动发行无法更新？**\n\nA: \n1. 首先，在 **插件中心** 检查并更新 \`滚动发行\` 插件本身至最新版本。\n2. 如果问题依旧，请尝试删除程序目录下的 \`data/rolling-release\` 文件夹后重试。`,
  },
  {
    keywordGroups: [
      ['(跨|升)大版本', '(提示|报错|[不没无]法?|不能)'],
      ['major version', 'upgrade', 'error|fail|can.?t'],
    ],
    answer: `**Q: 滚动发行提示无法跨大版本升级？**\n\nA: 滚动发行插件仅在当前最新的大版本内工作。当发布新的大版本后，您需要前往 **设置 -> 关于** 页面，手动检查并更新 GUI 客户端主程序。`,
  },
  {
    keywordGroups: [
      ['(首页|主页|面板)', '只(有)?(显示)?(4|四)个|太少|空'],
      ['dashboard|home page', 'only (shows? )?4|empty'],
    ],
    answer: `**Q: 首页只显示 4 个配置项？**\n\nA: 这是程序设计。您可以在 **配置** 页面通过拖拽来调整配置文件的显示顺序。`,
  },
  {
    keywordGroups: [
      ['(怎么|如何|咋)', '(更换|修改|换|改)', '(托盘)?图标'],
      ['tray icon', 'change|replace|customize'],
    ],
    answer: `**Q: 如何更换托盘图标？**\n\nA: \n1. 前往 **设置 -> 打开应用程序文件夹**。\n2. 替换或修改 \`data/.cache/icons\` 目录下的图标文件。`,
  },
  {
    keywordGroups: [
      ['linux', '(字体|文字)', '(偏高|位置[不无]对|偏移|错位)'],
      ['linux', 'font|text', 'position|offset|too high|misaligned'],
    ],
    answer: `**Q: Linux 桌面系统上 GUI 文字位置偏高？**\n\nA: 尝试安装 \`Noto-Sans-CJK\` 和 \`Microsoft-YaHei\` 字体后重启系统（此方法不保证在所有环境下都有效）。`,
  },

  // 🌐 B.2.2 网络与订阅 (Network & Subscription)
  {
    keywordGroups: [['403'], ['rate limit exceeded'], ['(github|api).*(限制|rate limit)']],
    answer: `**Q: GitHub API 速率限制 (403 rate limit exceeded)？**\n\nA: \n1. 访问您的 GitHub 开发者设置，生成一个新的 Personal Access Token (PAT)。\n2. 在客户端的 **设置 -> 通用** 中，将获取的 Token 填入 **向 REST API 进行身份验证** 一栏。`,
  },
  {
    keywordGroups: [
      ['订阅', '[没无](有)?(流量|速度|信息)'],
      ['订阅', '更新失败|用不了'],
      ['subscription', 'no traffic (info)?'],
      ['not a valid subscription'],
    ],
    answer: `**Q: 订阅无流量信息或更新失败？**\n\nA: \n*   在 **订阅 -> 编辑** 中，为目标订阅添加请求头 \`User-Agent: Clash.Meta\`。\n    *   **GUI.for.SingBox 额外操作**: 确保已安装 **节点转换** 插件。\n*   同时，请确保当前网络环境可以正常访问该订阅链接。`,
  },
  {
    keywordGroups: [
      ['多(个)?网卡', '网络.*(异常|问题|用不了)'],
      ['(wifi|无线|有线|网线)', '(一起|同时)用', '([不没无]法?|不能)上网'],
      ['multiple network cards?', 'issue|problem'],
    ],
    answer: `**Q: 多网卡设备网络异常？**\n\nA: \n1. 前往 **配置设置 -> 路由设置 -> 通用**。\n2. 禁用 \`自动检测出站接口\` 选项。\n3. 在下方的出站接口名称列表中，手动选择正确的物理网卡作为出站接口。`,
  },

  // ⚙️ B.2.3 配置与导入 (Configuration & Import)
  {
    keywordGroups: [
      ['(怎么|如何|咋)', '(导入|添加|载入|放进去|用)', '(自定义|自己.*|完整.*)?配置(文件)?.*(运行|启动)?.*'],
      ['import', 'custom config|full config'],
    ],
    answer: `**Q: 如何导入自定义配置文件？**\n\nA: GUI.for.Cores 本身不直接支持导入完整的配置文件，但可通过特定功能实现：\n*   **GUI.for.Clash**: 添加订阅时，启用 \`使用订阅内的策略组和分流规则\` 选项。\n*   **GUI.for.SingBox**: 使用 **配置脚本** 功能实现，具体代码示例请询问智能助理。`,
  },
  {
    keywordGroups: [
      ['(怎么|如何|咋)', '(导入|添加|加入)', '(单个)?节点|vmess|ss|vless|trojan'],
      ['import', 'single node|vmess'],
    ],
    answer: `**Q: 如何导入单个节点链接 (如 vmess://)？**\n\nA: \n1. 在 **插件中心** 安装并运行 **节点转换插件**。\n2. 在插件界面粘贴节点链接，选择配置格式，然后复制转换后的节点配置内容。\n3. 将复制的内容添加至 **手动管理订阅**。\n4. 在 **配置设置** 的 **出站分组** 或 **代理组** 中引用该节点。`,
  },

  // 🐞 B.2.4 内核错误 (Core Errors)
  {
    keywordGroups: [['cache-file.*timeout']],
    answer: `**Q: 报错 "start service: initialize cache-file: timeout"？**\n\nA: \n*   **原因**: sing-box 缓存文件被占用，通常是由于进程未正常退出。\n*   **解决方案**: 打开任务管理器（或活动监视器），手动结束所有名为 \`sing-box\` 的进程，然后重启内核。`,
  },
  {
    keywordGroups: [['detour.*empty direct']],
    answer: `**Q: 报错 "detour to an empty direct outbound makes no sense"？**\n\nA: \n*   **原因**: 新版 sing-box 禁止将 DNS 服务器的出站设置为 \`direct\`。\n*   **解决方案**:\n    1. 前往 **配置设置 -> DNS 设置 -> 服务器**。\n    2. 找到“出站”标签为 \`直连\` 的服务器，点击 **编辑**。\n    3. 点击出站标签旁边的 **x** 按钮将其清空（留空默认即为直连）。`,
  },
  {
    keywordGroups: [['missing.*tags']],
    answer: `**Q: 报错 "create service: initialize outbound[*]: missing tags"？**\n\nA: \n*   **原因**: 某个出站分组内没有任何节点或有效分组。\n*   **解决方案**: 前往 **配置设置 -> 出站设置**，找到左侧有红色感叹号的出站分组，点击 **编辑** 并确保其至少包含一个订阅或有效节点。`,
  },

  // 🛡️ B.2.5 TUN 模式专项 (TUN Mode Specifics)
  {
    keywordGroups: [
      ['tun(模式)?', '([没无]|缺少)权限|permission denied'],
      ['tun(模式)?', '(启动|开启|打开)失败'],
    ],
    answer: `**Q: TUN 模式无权限导致启动失败？**\n\nA: \n*   **Windows**: 前往 **设置 -> 通用**，勾选 **以管理员身份运行** 并重启客户端。\n*   **macOS/Linux**: 前往 **设置 -> 内核** 页面，点击授权按钮为内核程序授权。`,
  },
  {
    keywordGroups: [
      ['linux', '授权', '[没无]反应|点不了|点了没用'],
      ['linux', 'pkexec'],
    ],
    answer: `**Q: Linux 点击授权按钮没反应？**\n\nA: Linux 上的授权操作依赖 \`pkexec\` 命令，需确保已安装提供此命令的软件包。`,
  },
  {
    keywordGroups: [['tun.*configure.*system cannot find the file']],
    answer: `**Q: 报错 "configure tun interface: The system cannot find the file specified."？**\n\nA: \n*   **原因**: sing-box 无法创建 TUN 虚拟网卡。\n*   **解决方案**:\n    1. 检查 **入站设置** -> \`tun-in\` 的 **TUN 网卡名称** 是否为空，尝试填入任意名称（如 \`sing-box-tun\`）。\n    2. 确保没有其他应用（如其他代理软件、VPN）占用了 TUN 服务。`,
  },
  {
    keywordGroups: [
      ['(mac|macos)', '(只|单|仅)?.*tun(模式)?', '([没无不]法?|不能|连不上).*网(络)?'],
      ['(mac|macos)', '(只|单|仅)?.*tun(模式)?', '系统代理', '(才|必须|要开|依赖|同时)'],
      ['(mac|macos)', 'tun', 'no internet|cannot connect'],
    ],
    answer: `**Q: macOS 启用 TUN 后无法上网？**\n\nA: \n*   **原因**: sing-box 在 macOS 上不劫持发往局域网的 DNS 请求。\n*   **解决方案**: 将您 Mac 的系统 DNS 修改为任意公共 DNS 服务器（如 \`8.8.8.8\`）。`,
  },
  {
    keywordGroups: [
      ['(只|单|仅)?.*tun(模式)?', '([没无不]法?|不能|连不上).*网(络)?'],
      ['(只|单|仅)?.*tun(模式)?', '(断网|网络(异常|问题|断了))'],
      ['(只|单|仅)?.*tun(模式)?', '系统代理', '(才|必须|要开|依赖|同时)'],
      ['tun', 'no internet|cannot connect'],
    ],
    answer: `**Q: TUN 模式启动后无法上网？**\n\nA: 请按以下顺序排查：\n*   **方案 A**: 在软件设置中尝试更换 **TUN 堆栈模式** (如 GVisor, System)。\n*   **方案 B (Windows)**: 检查 Windows 防火墙设置，确保 GUI 客户端及其内核程序未被阻止。\n*   **方案 C (IPv6 问题)**: 如果您的网络不支持 IPv6，请进行以下调整：\n    1. **配置设置 -> 入站设置** -> \`tun-in\` -> 删除 IPv6 地址前缀，并启用**严格路由**。\n    2. **配置设置 -> DNS 设置 -> 通用** -> 将 **解析策略** 设为 \`只使用 IPv4\`。`,
  },
  {
    keywordGroups: [['tun(模式)?', '(ssl|证书).*(错误|error)']],
    answer: `**Q: TUN 模式下出现 SSL 证书错误？**\n\nA: 尝试将您操作系统的 DNS 服务器地址修改为公共 DNS，例如 \`8.8.8.8\` 或 \`1.1.1.1\`。`,
  },

  // 📚 其他
  {
    keywordGroups: [
      ['(怎么|如何|咋)', '(看|查看|打开)', '日志'],
      ['log', 'where|how to view|find'],
    ],
    answer: `**Q: 如何查看 GUI 日志？**\n\nA: 按 \`Ctrl + Shift + F12\` 打开开发者工具控制台即可查看，主要记录 GUI 自身运行信息。`,
  },
  {
    keywordGroups: [
      ['(怎么|如何|咋)', '(启用|开启|打开)', '滚动(发行)?'],
      ['how to', 'enable', 'rolling(-release)?'],
    ],
    answer: `**Q: 怎么启用滚动发行？**\n\nA: \n1. 在 **通用设置** 中确保 \`启用滚动发行\` 已启用。\n2. 在 **插件中心** 安装并运行 \`滚动发行\` 插件。\n3. 定期在 **插件中心** 更新 \`滚动发行\` 插件。`,
  },
];
