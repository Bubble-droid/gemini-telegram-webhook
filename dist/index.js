import{Logger as _e}from"tslog";import{GoogleGenAI as Te,HarmBlockThreshold as N,HarmCategory as L,Type as C,FunctionCallingConfigMode as de}from"@google/genai";import{Client as we}from"@modelcontextprotocol/sdk/client/index.js";import{SSEClientTransport as Ee}from"@modelcontextprotocol/sdk/client/sse.js";import{StdioClientTransport as be}from"@modelcontextprotocol/sdk/client/stdio.js";import{StreamableHTTPClientTransport as ke}from"@modelcontextprotocol/sdk/client/streamableHttp.js";import{CallToolResultSchema as xe}from"@modelcontextprotocol/sdk/types.js";import ue from"better-sqlite3";import*as re from"fs";import ne from"fs";import{createScheduler as Se,createWorker as Ie}from"tesseract.js";import*as Re from"path";import{isIP as Ce}from"node:net";import Me from"node:crypto";import Ae from"fastify";class f extends Error{code;constructor(e,t){super(e),this.name=this.constructor.name,t&&(this.code=t),typeof Error.captureStackTrace=="function"&&Error.captureStackTrace(this,this.constructor)}}const ae=["trace","debug","info","warn","error","fatal"];class Ne{DEFAULT_LISTEN_HOST="127.0.0.1";DEFAULT_LISTEN_PORT=39001;DEFAULT_LOGGER_LEVEL="info";DEFAULT_ENABLE_KEY_ROTATION=!1;DEFAULT_GEMINI_API_BASE_URL="https://generativelanguage.googleapis.com";DEFAULT_LOCAL_PROXY_BASE_URL=`http://127.0.0.1:${this.DEFAULT_LISTEN_PORT}/gemini`;DEFAULT_MODEL_NAME="gemini-flash-latest";DEFAULT_MODEL_CONFIG_TEMPERATURE=.2;DEFAULT_MAX_API_CALL_ROUNDS=12;DEFAULT_REQUEST_INTERVAL_SECOND=10;DEFAULT_CONTEXT_EXPIRATION_DAY=7;DEFAULT_MAX_CONTEXT_LENGTH=8;REQUIRED_ENV_VARS=["GEMINI_API_KEYS","GITHUB_ACCESS_TOKEN","WEBHOOK_RECEIVE_URL","WEBHOOK_SECRET_TOKEN","TELEGRAM_BOT_TOKEN","TELEGRAM_BOT_USERNAME","TELEGRAM_BOT_ADMIN_ID","ALLOWED_USAGE_GROUPS"];config;env;constructor(){this.env=process.env,this.validateRequiredEnv(),this.config=this.buildConfig(),Object.freeze(this.config)}validateRequiredEnv(){const e=this.REQUIRED_ENV_VARS.filter(t=>{const s=this.env[t];return!s||s.trim()===""});if(e.length>0)throw new f(`启动失败，缺少必要环境变量：${e.join(", ")}`)}load(){return this.config}buildConfig(){return{listenHost:this.parseListenHost(this.env.SERVER_LISTEN_HOST),listenPort:this.parsePort(this.env.SERVER_LISTEN_PORT),loggerLevel:this.parseLoggerLevel(this.env.SERVER_LOGGER_LEVEL),enableKeyRotation:this.env.ENABLE_KEY_ROTATION==="true"||this.DEFAULT_ENABLE_KEY_ROTATION,geminiApiBaseUrl:this.env.GEMINI_API_BASE_URL||this.DEFAULT_GEMINI_API_BASE_URL,localProxyBaseUrl:this.env.LOCAL_PROXY_BASE_URL||this.DEFAULT_LOCAL_PROXY_BASE_URL,geminiApiKeys:this.parseStringArray(this.getEnv("GEMINI_API_KEYS")),modelName:this.env.GEMINI_MODEL_NAME||this.DEFAULT_MODEL_NAME,modelTemperature:Number(this.env.MODEL_CONFIG_TEMPERATURE)||this.DEFAULT_MODEL_CONFIG_TEMPERATURE,maxApiCallRounds:Number(this.env.MAX_API_CALL_ROUNDS)||this.DEFAULT_MAX_API_CALL_ROUNDS,requestIntervalSecond:Number(this.env.REQUEST_INTERVAL_SECOND)||this.DEFAULT_REQUEST_INTERVAL_SECOND,contextsExpirationSecond:(Number(this.env.CONTEXT_EXPIRATION_DAY)||this.DEFAULT_CONTEXT_EXPIRATION_DAY)*24*60*60,maxContextLength:Number(this.env.MAX_CONTEXT_LENGTH)||this.DEFAULT_MAX_CONTEXT_LENGTH,githubToken:this.getEnv("GITHUB_ACCESS_TOKEN"),webhookUrl:this.getEnv("WEBHOOK_RECEIVE_URL"),secretToken:this.getEnv("WEBHOOK_SECRET_TOKEN"),botToken:this.getEnv("TELEGRAM_BOT_TOKEN"),botApiUrl:`https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}`,botName:this.getEnv("TELEGRAM_BOT_USERNAME"),adminId:Number(this.getEnv("TELEGRAM_BOT_ADMIN_ID")),allowGroups:this.parseNumberArray(this.env.ALLOWED_USAGE_GROUPS)}}getEnv(e){return this.env[e]}parseNumberArray(e){return!e||e.trim()===""?[]:e.split(",").map(t=>t.trim()).filter(t=>t!=="").map(t=>Number(t)).filter(t=>!Number.isNaN(t))}parseStringArray(e){return!e||e.trim()===""?[]:e.split(",").map(t=>t.trim()).filter(t=>t.length>0)}parseListenHost(e){const t=e?.trim()||this.DEFAULT_LISTEN_HOST;if(Ce(t)===0)throw new f(`环境变量 SERVER_LISTEN_HOST 无效："${t}" 不是有效的 IPv4 或 IPv6 地址`);return t}parsePort(e){if(!e||e.trim()==="")return this.DEFAULT_LISTEN_PORT;if(!/^\d+$/.test(e))throw new f(`环境变量 SERVER_LISTEN_PORT 无效："${e}" 不是纯数字`);const t=Number.parseInt(e,10);if(t<1||t>65535)throw new f(`环境变量 SERVER_LISTEN_PORT 超出范围：${t}，应在 1-65535 之间`);return t}parseLoggerLevel(e){const t=e?.trim().toLowerCase();if(!t)return this.DEFAULT_LOGGER_LEVEL;if(ae.includes(t))return t;throw new f(`环境变量 SERVER_LOGGER_LEVEL 非法："${e}"。可选值为 ${ae.join(", ")}`)}}const Le=new Ne,y=Le.load();class Oe{markdownV2(e){return e.replace(/([_*[\]()~`>#+\-=|{}.!])/g,"\\$1")}markdownV2Code(e){return e.replace(/([`\\])/g,"\\$1")}markdownV2Url(e){return e.replace(/([)\\])/g,"\\$1")}html(e){return e.replace(/[<>&]/g,t=>{switch(t){case"<":return"&lt;";case">":return"&gt;";case"&":return"&amp;";default:return t}})}legacyMarkdown(e){return e.replace(/([_*`[])/g,"\\$1")}}const b=new Oe;class ve{htmlGenerator;markdownV2Generator;legacyMarkdownGenerator;parse(e){return new ee(e).parse()}getGenerator(e){switch(e){case"HTML":return this.htmlGenerator||(this.htmlGenerator=new Pe),this.htmlGenerator;case"MarkdownV2":return this.markdownV2Generator||(this.markdownV2Generator=new De),this.markdownV2Generator;case"Markdown":return this.legacyMarkdownGenerator||(this.legacyMarkdownGenerator=new Ue),this.legacyMarkdownGenerator}}}const q=new ve,M=4096,Q=c=>{switch(c.type){case"text":case"inline_code":case"code_block":return[...c.content??""].length;case"newline":return 1;case"root":case"bold":case"underline":case"strikethrough":case"spoiler":case"link":case"blockquote":return c.children?.reduce((e,t)=>e+Q(t),0)??0;default:return 0}},pe=(c,e)=>{const t=[];let s="",r=0;const n=[],a=()=>{s=n.map(d=>e.getOpeningTag(d.type,d)).join(""),r=0},i=()=>{r===0&&s===""||(s+=[...n].reverse().map(d=>e.getClosingTag(d.type,d)).join(""),s.trim().length>0&&t.push(s))},l=d=>{const u=Q(d);if(d.type==="code_block")if(u>M){r>0&&i(),a();let p=d.content??"";for(;p.length>0;){const m={...d,content:""},E=e.generate(m).length,h=M-E;let k=Math.min(p.length,h);if(k<p.length){const R=p.lastIndexOf(`
`,k);R>0&&(k=R)}const T=p.substring(0,k),x={...d,content:T},w=e.generate(x);t.push(w),p=p.substring(k).trimStart()}a();return}else{r>0&&r+u>M&&(i(),a()),s+=e.generate(d),r+=u;return}if((d.type==="inline_code"||d.type==="text"||d.type==="newline")&&r+u>M&&u>0&&d.type==="inline_code"&&(i(),a()),n.push(d),s+=e.getOpeningTag(d.type,d),d.children)for(const p of d.children)l(p);else if(d.content||d.type==="newline"){const p=d.content??`
`,m=Q(d);if(r+m<=M)s+=e.generateContent(d),r+=m;else{let g=p;for(;g.length>0;){const E=M-r;if(E<=0){i(),a();continue}let h=0,k=0;const T=[...g];for(let I=0;I<T.length&&!(k+1>E);I++)k++,h++;if(h<T.length){let I=-1;const j=T.slice(0,h).join("");I=j.lastIndexOf(`
`),I===-1&&(I=j.lastIndexOf(" ")),I>0&&(h=[...j.substring(0,I+1)].length)}const x=T.slice(0,h).join(""),w=T.slice(h).join(""),R={...d,content:x};s+=e.generateContent(R),r+=[...x].length,w.length>0&&(i(),a()),g=w}}}s+=e.getClosingTag(d.type,d),n.pop()};if(c.children)for(const d of c.children)l(d);return(r>0||t.length===0&&s.length>0)&&i(),t},$e=(c,e)=>{if([...c].length<=e)return[c];const t=[];let s=c;for(;s.length>0;){if(s.length<=e){t.push(s);break}let r=s.lastIndexOf(`
`,e);r===-1&&(r=s.lastIndexOf(" ",e)),(r===-1||r===0)&&(r=e),t.push(s.substring(0,r)),s=s.substring(r).trimStart()}return t};class Z{generate(e){return this.visitNode(e)}visitNode(e){const t=this.getOpeningTag(e.type,e),s=this.generateContent(e),r=this.getClosingTag(e.type,e);return t+s+r}generateContent(e){return e.content??this.visitChildren(e)}visitChildren(e){return e.children?.map(t=>this.visitNode(t)).join("")??""}}class Pe extends Z{getOpeningTag(e,t){switch(e){case"bold":return"<b>";case"underline":return"<u>";case"strikethrough":return"<s>";case"spoiler":return'<span class="tg-spoiler">';case"inline_code":return"<code>";case"code_block":return`<pre><code${t.lang?` class="language-${b.html(t.lang)}"`:""}>`;case"link":return`<a href="${b.html(t.href??"")}">`;case"blockquote":return t.expandable?"<blockquote expandable>":"<blockquote>";default:return""}}getClosingTag(e,t){switch(e){case"bold":return"</b>";case"underline":return"</u>";case"strikethrough":return"</s>";case"spoiler":return"</span>";case"inline_code":return"</code>";case"code_block":return"</code></pre>";case"link":return"</a>";case"blockquote":return"</blockquote>";default:return""}}generateContent(e){return e.type==="text"?b.html(e.content??""):e.type==="newline"?`
`:e.type==="code_block"||e.type==="inline_code"?b.html(e.content??""):this.visitChildren(e)}}class De extends Z{getOpeningTag(e,t){switch(e){case"bold":return"*";case"underline":return"__";case"strikethrough":return"~";case"spoiler":return"||";case"inline_code":return"`";case"code_block":return`\`\`\`${t.lang??""}
`;case"link":return"[";default:return""}}getClosingTag(e,t){switch(e){case"bold":return"*";case"underline":return"__";case"strikethrough":return"~";case"spoiler":return"||";case"inline_code":return"`";case"code_block":return"\n```";case"link":return`](${b.markdownV2Url(t.href??"")})`;default:return""}}generateContent(e){return e.type==="text"?b.markdownV2(e.content??""):e.type==="newline"?`
`:e.type==="code_block"||e.type==="inline_code"?b.markdownV2Code(e.content??""):e.type==="blockquote"?this.visitChildren(e).split(`
`).map(s=>`> ${s}`).join(`
`):this.visitChildren(e)}visitNode(e){return e.type==="blockquote"?this.generateContent(e):super.visitNode(e)}}class Ue extends Z{getOpeningTag(e,t){switch(e){case"bold":return"*";case"inline_code":return"`";case"code_block":return`\`\`\`${t.lang??""}
`;case"link":return"[";default:return""}}getClosingTag(e,t){switch(e){case"bold":return"*";case"inline_code":return"`";case"code_block":return"\n```";case"link":return`](${t.href??""})`;default:return""}}generateContent(e){return e.type==="text"?b.legacyMarkdown(e.content??""):e.type==="newline"?`
`:e.type==="code_block"||e.type==="inline_code"?e.content??"":["underline","strikethrough","spoiler","blockquote"].includes(e.type)?this.visitChildren(e):this.visitChildren(e)}}class ee{text;pos=0;markers=["**","__","~~","||","`","[","]","(",")","```",`
`,">"];constructor(e){this.text=e.replace(/\r\n/g,`
`)}parse(){return{type:"root",children:this.parseUntil(e=>e>=this.text.length)}}parseUntil(e){const t=[];for(;!e(this.pos);){const s=this.pos,r=this.parseCodeBlock()||this.parseBlockquote()||this.parseBold()||this.parseUnderline()||this.parseStrikethrough()||this.parseSpoiler()||this.parseLink()||this.parseInlineCode()||this.parseNewline()||this.parseText(e);r&&t.push(r),this.pos===s&&(e(this.pos)||(t.push({type:"text",content:this.text[this.pos]}),this.pos++))}return t}match(e){return this.text.substring(this.pos).startsWith(e)}parseWithMarkers(e,t){if(!this.match(t))return null;const s=this.pos;this.pos+=t.length;const r=this.parseUntil(n=>this.text.substring(n).startsWith(t)||n>=this.text.length);return this.match(t)?(this.pos+=t.length,{type:e,children:r}):(this.pos=s,null)}parseBold=()=>this.parseWithMarkers("bold","**");parseUnderline=()=>this.parseWithMarkers("underline","__");parseStrikethrough=()=>this.parseWithMarkers("strikethrough","~~");parseSpoiler=()=>this.parseWithMarkers("spoiler","||");parseNewline=()=>this.match(`
`)?(this.pos++,{type:"newline"}):null;parseInlineCode(){const e=/^`([^`]+?)`/.exec(this.text.substring(this.pos));return e?(this.pos+=e[0].length,{type:"inline_code",content:e[1]}):null}parseCodeBlock(){const e=/^```(\w*)\n([\s\S]+?)\n```/.exec(this.text.substring(this.pos));return e?(this.pos+=e[0].length,{type:"code_block",lang:e[1]||void 0,content:e[2]}):null}parseLink(){if(!this.match("["))return null;const e=this.pos;this.pos++;const t=this.parseUntil(n=>this.text[n]==="]"||n>=this.text.length);if(!this.match("]("))return this.pos=e,null;this.pos+=2;const s=this.text.indexOf(")",this.pos);if(s===-1)return this.pos=e,null;const r=this.text.substring(this.pos,s);return this.pos=s+1,{type:"link",href:r,children:t}}parseBlockquote(){return this._parseBlockquoteOfType(">>")||this._parseBlockquoteOfType(">")}_parseBlockquoteOfType(e){const t=this.pos;if(t>0&&this.text[t-1]!==`
`)return null;const s=e===">",r=e===">>";if(s&&this.text.substring(t).startsWith(">>")||!this.text.substring(t).startsWith(e))return null;const n=[];let a=t;for(;a<this.text.length&&!(a>0&&this.text[a-1]!==`
`);){const u=this.text.substring(a).startsWith(">>");if(r&&!u||s&&u||!this.text.substring(a).startsWith(e))break;const p=this.text.indexOf(`
`,a),m=p===-1?this.text.length:p,g=a+e.length+(this.text[a+e.length]===" "?1:0);n.push(this.text.substring(g,m)),a=m+1}if(n.length===0)return this.pos=t,null;this.pos=a;const i=n.join(`
`),d=new ee(i).parse().children||[];return{type:"blockquote",expandable:r,children:d}}parseText(e){const t=this.pos;let s=this.text.length;for(const n of this.markers){const a=this.text.indexOf(n,this.pos);a!==-1&&(s=Math.min(s,a))}let r=this.pos;for(;!e(r)&&r<this.text.length;)r++;return s=Math.min(s,r),s>t?(this.pos=s,{type:"text",content:this.text.substring(t,s)}):null}}class Ge{headerToc=[];processTextOutsideCodeBlocks(e,t){const s="__CODE_BLOCK_PLACEHOLDER_",r=[],n=e.replace(/```[\s\S]*?```/g,i=>{const l=`${s}${r.length}__`;return r.push(i),l});let a=t(n);for(let i=r.length-1;i>=0;i--)a=a.replace(`${s}${i}__`,r[i]);return a}normalizeCodeBlocks(e){if(typeof e!="string"||!e)return"";let t=e;return t=t.replace(/([^\n])(\s*`{3})/g,(s,r,n)=>`${r}
${n.trim()}`),t=t.replace(/(`{3})(\s+[^\n\r]+)/g,(s,r,n)=>`${r}
${n}`),t}preprocessTables(e){return typeof e!="string"||!e?"":this.processTextOutsideCodeBlocks(e,t=>{const s=/^(\s*\|.+\|\r?\n\s*\|(?:\s*:?-+:?\s*\|)+\r?\n(?:(?:\s*\|.*\|\r?\n)*))/gm;return t.replace(s,r=>`\`\`\`markdown
${Be.format(r).trim()}
\`\`\``)})}preprocessHeaders(e){return typeof e!="string"||!e?"":(this.headerToc=[],this.processTextOutsideCodeBlocks(e,t=>{const s=/^(#+)\s+(.*?)\s*#*\s*$/gm;return t.replace(s,(r,n,a)=>{const i=n.length;for(;this.headerToc.length<i;)this.headerToc.push(0);return this.headerToc.length=i,this.headerToc[i-1]++,`${this.headerToc.join(".")}. **${a.trim()}**`})}))}}const W=new Ge,Fe=c=>{let e=W.normalizeCodeBlocks(c);return e=W.preprocessTables(e),e=W.preprocessHeaders(e),e};class qe{rows=[];columnWidths=[];MIN_COLUMN_WIDTH=3;getDisplayLength(e){if(!e)return 0;let t=0;for(let s=0;s<e.length;s++)t+=e.charCodeAt(s)>255?2:1;return t}format(e){const t=e.trim().split(`
`).filter(s=>s.trim().startsWith("|"));return t.length<2||(this.parseRows(t),this.rows.length===0||this.rows[0].length===0)?e:(this.calculateColumnWidths(),this.buildFormattedTable())}parseRows(e){const t=[e[0],...e.slice(2)];this.rows=t.map(s=>s.replace(/^\||\|$/g,"").split("|").map(r=>r.trim().replace(/`/g,"")))}calculateColumnWidths(){const e=this.rows[0]?.length||0;this.columnWidths=Array(e).fill(this.MIN_COLUMN_WIDTH);for(const t of this.rows){const s=Math.min(e,t.length);for(let r=0;r<s;r++){const n=this.getDisplayLength(t[r]||"")+2;this.columnWidths[r]=Math.max(this.columnWidths[r],n)}}}buildBorderLine(){return`+${this.columnWidths.map(t=>"-".repeat(t)).join("+")}+`}buildFormattedTable(){const e=[],t=this.buildBorderLine(),r=`|${this.columnWidths.map(n=>"-".repeat(n)).join("|")}|`;e.push(t),e.push(this.buildRow(this.rows[0])),e.push(r);for(let n=1;n<this.rows.length;n++)e.push(this.buildRow(this.rows[n])),n<this.rows.length-1&&e.push(r);return e.push(t),e.join(`
`)}buildRow(e){return`|${e.map((s,r)=>{if(r>=this.columnWidths.length)return"";const n=this.columnWidths[r],a=this.getDisplayLength(s),i=n-a,l=Math.floor(i/2),d=Math.ceil(i/2);return`${" ".repeat(l)}${s}${" ".repeat(d)}`}).join("|")}|`}}const Be=new qe,He=(c,e="Unknown")=>{const{adminId:t}=y;if(!t){o.warn("Admin ID is not configured, skipping error notification.",{context:e});return}try{const s=c instanceof Error?c:new Error(String(c)),r=s.stack||"No stack trace available",n=te(r),a=he(Date.now()),i=b.html(e),l=b.html(s.message),d=b.html(n),u=`🚨 <b>[错误告警]</b> 🚨

🕒 <b>时间:</b> ${a}
📂 <b>上下文:</b> <code>${i}</code>

❌ <b>错误信息:</b>
<pre>${l}</pre>

🛠 <b>堆栈追踪:</b>
<pre><code class="language-javascript">${d}</code></pre>`;_.sendMessage(t,u,{parseMode:"HTML"}),o.info("Error notification sent to admin.",{context:e})}catch(s){o.error("Failed to send error notification.",{err:s,originalErrorContext:e})}},v=c=>{const e=q.parse(c),t=q.getGenerator("HTML");return pe(e,t).join("")},je=new Intl.DateTimeFormat("zh-CN",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1,timeZone:"Asia/Shanghai"}),he=(c=Date.now())=>{const e=typeof c=="number"?new Date(c):c,t=je.formatToParts(e).reduce((s,{type:r,value:n})=>(r!=="literal"&&(s[r]=n),s),{});return`${t.year}-${t.month}-${t.day} ${t.hour}:${t.minute}:${t.second} UTC+8`},P=c=>new Promise(e=>setTimeout(e,c)),te=c=>{const r=[...c];if(r.length<=4096)return c;const n=r.slice(0,2040).join(""),a=r.slice(r.length-2040).join("");return`${n}
...
${a}`},Y=c=>typeof structuredClone=="function"?structuredClone(c):JSON.parse(JSON.stringify(c));class We{internalLogger;DEFAULT_MIN_LEVEL=3;constructor(){this.internalLogger=this.createTslogInstance(this.DEFAULT_MIN_LEVEL)}mapLevelToNumber(e){return{trace:1,debug:2,info:3,warn:4,error:5,fatal:6}[e]??3}createTslogInstance(e){return new _e({name:"App",minLevel:e,prettyLogTemplate:"{{yyyy}}-{{mm}}-{{dd}} {{hh}}:{{MM}}:{{ss}}	{{logLevelName}}	",prettyLogTimeZone:"local",prettyErrorStackTemplate:"",prettyErrorLoggerNameDelimiter:"",prettyLogStyles:{logLevelName:{"*":["bold","black","bgWhiteBright","dim"],TRACE:["bold","magenta"],DEBUG:["bold","cyan"],INFO:["bold","blue"],WARN:["bold","yellow"],ERROR:["bold","red"],FATAL:["bold","redBright"]}}})}serializeError(e){return{name:e.name,message:e.message}}buildPayload(e,t){const s={message:e,...t||{}};return t?.err instanceof Error&&(s.error=this.serializeError(t.err),delete s.err),s}init(e){const t=typeof e?.minLevel=="number"?e.minLevel:e?.loggerLevel?this.mapLevelToNumber(e.loggerLevel):this.DEFAULT_MIN_LEVEL;this.internalLogger=this.createTslogInstance(t),o.info(`[Logger] 初始化完成，日志级别: ${e?.loggerLevel}`)}trace(e,t){const s=this.buildPayload(e,t);this.internalLogger.trace(JSON.stringify(s,null,2))}debug(e,t){const s=this.buildPayload(e,t);this.internalLogger.debug(JSON.stringify(s,null,2))}info(e,t){const s=this.buildPayload(e,t);this.internalLogger.info(JSON.stringify(s,null,2))}warn(e,t){const s=this.buildPayload(e,t);this.internalLogger.warn(JSON.stringify(s,null,2))}error(e,t){const s=this.buildPayload(e,t);this.internalLogger.error(JSON.stringify(s,null,2))}fatal(e,t){const s=this.buildPayload(e,t);typeof this.internalLogger.fatal=="function"?this.internalLogger.fatal(JSON.stringify(s,null,2)):this.internalLogger.error(JSON.stringify(s,null,2))}stream={write:e=>{try{const{level:t,msg:s,...r}=JSON.parse(e);switch(delete r.time,delete r.pid,delete r.hostname,!0){case t>=60:this.fatal(s,r);break;case t>=50:this.error(s,r);break;case t>=40:this.warn(s,r);break;case t>=30:this.info(s,r);break;case t>=20:this.debug(s,r);break;default:this.trace(s,r);break}}catch(t){this.error("Failed to parse pino log JSON, logging as info.",{originalLog:e.trim(),err:t})}}}}const o=new We;class Ke{keys;currentIndex=0;constructor(){this.keys=y.geminiApiKeys,o.info(`KeyRotator 初始化完成，共加载 ${this.keys.length} 个密钥。`)}nextKey(){const e=this.keys[this.currentIndex],t=`${e.substring(0,5)}...${e.substring(e.length-5)}`;return o.debug(`使用密钥: ${t} (Index: ${this.currentIndex})`),this.currentIndex=(this.currentIndex+1)%this.keys.length,e}getKeyCount(){return this.keys.length}}const me=new Ke,oe=60,Ve=300*1e3;class Qe{intervalMs;timestampMap;constructor(){this.intervalMs=(y.requestIntervalSecond||oe)*1e3,this.timestampMap=new Map,setInterval(()=>this.pruneExpiredEntries(),Ve)}pruneExpiredEntries(){const e=Date.now();let t=0;for(const[s,r]of this.timestampMap)e-r>this.intervalMs&&(this.timestampMap.delete(s),t++);t>0&&o.debug(`[RateLimiter] 自动清理: 移除了 ${t} 个过期记录`)}check(e){const t=Date.now();try{const s=this.timestampMap.get(e);if(!s||t-s>=this.intervalMs)return this.timestampMap.set(e,t),{canProceed:!0};{const r=this.intervalMs-(t-s);return{canProceed:!1,retryAfterSeconds:Math.ceil(Math.max(0,r)/1e3)}}}catch(s){return o.error(`限流器异常 (ID: ${e}):`,{err:s}),{canProceed:!1,retryAfterSeconds:oe}}}size(){return this.timestampMap.size}}const Ye=new Qe,ie=2,Xe=200,ze=["eng","chi_sim","chi_tra"];class Je{currentWrapper=null;isRotating=!1;cachePath;constructor(){this.cachePath="/data/.cache",this.rotateScheduler(!0).catch(e=>{o.fatal("OCR 服务启动失败",e)})}async createFreshScheduler(e){o.info(`[OCR-${e}] 正在初始化新的调度器 (Workers: ${ie})...`);const t=Se(),s=Array(ie).fill(0).map(async(r,n)=>{const a=await Ie(ze,1,{cachePath:this.cachePath,gzip:!0,logger:i=>o.debug("[OCR-Worker]",{msg:i}),errorHandler:i=>o.error(`[OCR-${e}-Worker${n}] 错误`,{err:i})});t.addWorker(a)});return await Promise.all(s),o.info(`[OCR-${e}] 调度器准备就绪`),t}async rotateScheduler(e=!1){if(this.isRotating&&!e)return;this.isRotating=!0;const t=Date.now().toString().slice(-5);try{const s=await this.createFreshScheduler(t),r=this.currentWrapper;this.currentWrapper={instance:s,jobCount:0,activeJobs:0,id:t},o.info(`[OCR] 调度器已切换至 [${t}]`),r&&this.gracefulShutdown(r)}catch(s){o.error("OCR 调度器轮换失败",{err:s})}finally{this.isRotating=!1}}async gracefulShutdown(e){o.info(`[OCR-${e.id}] 进入退休模式，等待 ${e.activeJobs} 个任务结束...`);const t=setInterval(async()=>{if(e.activeJobs<=0){clearInterval(t);try{await e.instance.terminate(),o.info(`[OCR-${e.id}] 已安全销毁`)}catch(s){o.error(`[OCR-${e.id}] 销毁时出错`,{err:s})}}},1e3)}async handle(e){if(!this.currentWrapper&&(o.warn("OCR 服务正在初始化，请稍候..."),await P(2e3),!this.currentWrapper))throw new f("OCR Service Unavailable");const t=this.currentWrapper;t.jobCount++,t.activeJobs++,t.jobCount>=Xe&&!this.isRotating&&(o.info(`[OCR-${t.id}] 达到任务阈值 (${t.jobCount}), 触发轮换...`),this.rotateScheduler());try{const{data:s,mimeType:r}=e;return(await t.instance.addJob("recognize",`data:${r};base64,${s}`)).data.text.trim()}catch(s){return o.error(`[OCR-${t.id}] 识别失败`,{err:s}),null}finally{t.activeJobs--}}async destroy(){this.currentWrapper&&(await this.currentWrapper.instance.terminate(),o.info("[OCR] 调度器已销毁"))}}const ge=new Je,Ze=4096,et=async(c,e,t,s)=>{if(!s||s.trim().length===0)return{ok:!0,messageId:void 0};const r=["HTML","MarkdownV2","Markdown",null];let n=null;const a=Fe(s),i=q.parse(a);let l="",d="";for(const u of r){o.info(`尝试使用 [${u??"纯文本"}] 格式发送全部消息...`);const p=[];let m,g=t,E=!0;try{let h;if(u===null)h=$e(a,Ze);else{l=u==="HTML"?"<i>":"_",d=u==="HTML"?"</i>":"_";const T=q.getGenerator(u);h=pe(i,T)}const k=`

${l}⚠️ 本 AI 回答仅供参考，可能存在不准确之处，请你自行判断。${d}`;o.info(`[${u??"纯文本"}] 格式的文本被分割成 ${h.length} 块.`);for(let T=0;T<h.length;T++){let x=h[T];o.info(`发送消息 (块 ${T+1}/${h.length}, 长度: ${[...x].length}, 格式: ${u??"纯文本"})...`),T===h.length-1&&(x+=k);let w;if(e&&T===0?w=await _.editMessageText(c,e,x,{parseMode:u===null?void 0:u}):w=await _.sendMessage(c,x,{replyToMessageId:g,parseMode:u===null?void 0:u}),w.ok)o.info(`消息块 ${T+1}/${h.length} 发送成功.`),(!e||e&&T>0)&&p.push(w.messageId),S.deleteMessage(c,w.messageId,1440*6e4),m=w.messageId,g=w.messageId;else{if(o.error(`消息块 ${T+1}/${h.length} 发送失败.`,{err:w.error}),n=new f(w.error),E=!1,p.length>0){o.warn(`[${u??"纯文本"}] 模式发送中断，开始清理 ${p.length} 条已发送的消息...`);const R=await _.deleteMessages(c,p);R.ok?o.info("清理操作完成。"):o.error("清理发生错误，为了不影响任务执行，将继续处理",{err:R.error})}break}}if(E)return o.info(`所有消息均已使用 [${u??"纯文本"}] 格式成功发送.`),{ok:!0,messageId:m};o.warn(`[${u??"纯文本"}] 格式发送失败，将尝试下一个格式...`)}catch(h){n=new f(h instanceof Error?h.message:String(h)),o.error(`在处理 [${u??"纯文本"}] 格式时发生严重错误.`,{err:h})}}return o.error("所有格式化模式均发送失败。"),{ok:!1,error:n??new f("未知错误导致所有格式化模式发送失败","ALL_FORMAT_MODES_FAILED")}},X=c=>{if(c===null||typeof c!="object")return c;if(Array.isArray(c))return c.map(X);const e={};return Object.keys(c).sort().forEach(t=>{e[t]=X(c[t])}),e};class tt{db;stmtUpsert;stmtGetNext;stmtDelete;stmtGetDue;nextTaskTimer=null;currentTimerTargetTime=null;constructor(){const e="/data";ne.existsSync(e)||ne.mkdirSync(e,{recursive:!0});const t=`${e}/tasks.db`;this.db=new ue(t,{verbose:s=>o.debug("[TaskScheduler]",{msg:s})}),this.db.pragma("journal_mode = WAL"),this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        params TEXT NOT NULL,
        due_at INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_task ON tasks(action, params);

      CREATE INDEX IF NOT EXISTS idx_due_at ON tasks(due_at);
    `),this.stmtUpsert=this.db.prepare(`
      INSERT INTO tasks (action, params, due_at)
      VALUES (@action, @params, @dueAt)
      ON CONFLICT(action, params)
      DO UPDATE SET due_at = excluded.due_at
    `),this.stmtGetNext=this.db.prepare(`
      SELECT * FROM tasks ORDER BY due_at ASC LIMIT 1
    `),this.stmtGetDue=this.db.prepare(`
      SELECT * FROM tasks WHERE due_at <= ? ORDER BY due_at ASC
    `),this.stmtDelete=this.db.prepare("DELETE FROM tasks WHERE id = ?"),this.refreshSchedule(),o.info("[TaskScheduler] 初始化完成，任务队列已加载")}refreshSchedule(){try{const e=this.stmtGetNext.get();if(!e){this.nextTaskTimer&&(clearTimeout(this.nextTaskTimer),this.nextTaskTimer=null,this.currentTimerTargetTime=null);return}if(this.nextTaskTimer&&this.currentTimerTargetTime===e.due_at)return;this.nextTaskTimer&&clearTimeout(this.nextTaskTimer);const t=Date.now(),s=Math.max(0,e.due_at-t);this.currentTimerTargetTime=e.due_at;const r=2147483647,n=Math.min(s,r);this.nextTaskTimer=setTimeout(()=>{this.processDueTasks()},n),s>r&&o.warn(`[TaskScheduler] 任务 ID:${e.id} 延迟超过 setTimeout 上限，将在下一轮调度`)}catch(e){o.error("[TaskScheduler] 刷新调度失败",{err:e})}}processDueTasks(){this.nextTaskTimer=null,this.currentTimerTargetTime=null;const e=Date.now(),t=this.stmtGetDue.all(e);for(const s of t)try{const r=JSON.parse(s.params);this.executeTask(s.action,r)}catch(r){o.error(`[TaskScheduler] 任务执行失败 ID:${s.id}`,{action:s.action,err:r})}finally{this.stmtDelete.run(s.id)}this.refreshSchedule()}executeTask(e,t){switch(o.debug(`[TaskScheduler] Executing: ${e}`,{params:t}),e){case"deleteMessage":{if(this.isParams(t)){const s=t;_.deleteMessage(s.chat_id,s.message_id)}break}case"deleteMessages":{if(this.isParams(t)){const s=t;_.deleteMessages(s.chat_id,s.message_ids)}break}default:o.warn(`[TaskScheduler] 未知的任务类型: ${e}`,{params:t})}}isParams(e){return typeof e=="object"&&e!==null}schedule(e,t,s){const r=Date.now()+s,n=X(t),a=JSON.stringify(n);this.stmtUpsert.run({action:e,params:a,dueAt:r}),this.refreshSchedule(),o.info(`[TaskScheduler] 任务已调度: ${e}，预计执行时间: ${he(r)}`,{params:t})}deleteMessage(e,t,s){return this.schedule("deleteMessage",{chat_id:e,message_id:t},s)}deleteMessages(e,t,s){const r=[...new Set(t.filter(n=>n))];if(r.length!==0)return r.sort((n,a)=>n-a),r.length===1?this.deleteMessage(e,r[0],s):this.schedule("deleteMessages",{chat_id:e,message_ids:r},s)}async sendTempMessage(e,t,s,r={}){const{relatedMessageIds:n=[],...a}=r,i=await _.sendMessage(e,t,a);if(i.ok){const l=[i.messageId,...n];this.deleteMessages(e,l,s)}}close(){this.nextTaskTimer&&clearTimeout(this.nextTaskTimer),this.db.close(),o.info("[TaskScheduler] Database closed.")}}const S=new tt;class st{requestRateLimit;constructor(){this.requestRateLimit=y.requestIntervalSecond*1e3}async chat(e,t={}){const{maxRounds:s=10,config:r,toolExecutor:n,onRetry:a,onToolStart:i}=t;let l=0;for(;l<s;){o.info(`[ChatAgent] Round ${l+1} started.`);const d=await ot.generate(e,r,a);e.push(d.candidates?.[0]?.content);const u=d.functionCalls;if(u&&u.length>0){if(!n)throw new f("Model requested tool execution but no toolExecutor provided.");o.info(`Model requested ${u.length} tool calls.`);const p=[];for(const m of u){const{name:g,args:E}=m;o.info(`[ChatAgent] Executing tool: ${g}`),i&&i(g);try{const h=await n(g,E);p.push({functionResponse:{name:g,response:h}})}catch(h){const k=h instanceof Error?h.message:String(h);o.error(`[ChatAgent] Tool execution error: ${g}`,{err:h}),p.push({functionResponse:{name:g,response:{error:k}}})}}e.push({role:"user",parts:p}),await P(this.requestRateLimit),l++;continue}return d}throw new f(`Max conversation rounds (${s}) reached.`)}}const se=new st;class rt{db;maxContextLength;expirationSeconds;stmtGet;stmtUpsert;stmtDelete;stmtPrune;constructor(){this.maxContextLength=y.maxContextLength,this.expirationSeconds=y.contextsExpirationSecond;const e="/data/chat_history.db";this.db=new ue(e,{verbose:s=>o.debug(String(s))}),this.db.pragma("journal_mode = WAL"),this.db.pragma("auto_vacuum = INCREMENTAL"),this.db.exec(`
      CREATE TABLE IF NOT EXISTS contexts (
        key TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `),this.stmtGet=this.db.prepare("SELECT data, updated_at FROM contexts WHERE key = ?"),this.stmtUpsert=this.db.prepare(`
      INSERT INTO contexts (key, data, updated_at) VALUES (@key, @data, @now)
      ON CONFLICT(key) DO UPDATE SET data = @data, updated_at = @now
    `),this.stmtDelete=this.db.prepare("DELETE FROM contexts WHERE key = ?"),this.stmtPrune=this.db.prepare("DELETE FROM contexts WHERE updated_at < ?");const t=360*60*1e3;setInterval(()=>this.pruneExpired(),t),o.info("[ChatContexts] 初始化完成，上下文已加载")}generateKey(e,t){return`${e}:${t}`}getNow(){return Math.floor(Date.now()/1e3)}pruneExpired(){try{const e=this.getNow()-this.expirationSeconds,t=this.stmtPrune.run(e);t.changes>0&&(o.info(`[ChatContexts] 每日清理完成: 移除了 ${t.changes} 条过期会话 (7天前)`),this.db.pragma("incremental_vacuum(1000)"))}catch(e){o.error("[ChatContexts] 清理过期数据失败",{err:e})}}get(e,t){try{const s=this.generateKey(e,t),r=this.stmtGet.get(s);return r?this.getNow()-r.updated_at>this.expirationSeconds?(this.stmtDelete.run(s),[]):JSON.parse(r.data):[]}catch(s){return o.error(`读取上下文失败 (${e}:${t})`,{err:s}),[]}}update(e,t,s){try{const r=this.generateKey(e,t),n=this.get(e,t);n.length>=this.maxContextLength&&n.shift(),n.push(...s),this.stmtUpsert.run({key:r,data:JSON.stringify(n),now:this.getNow()}),o.debug(`${r}: 上下文已持久化，长度 ${n.length}`)}catch(r){o.error(`更新上下文失败 (${e}:${t})`,{err:r})}}clear(e,t){const s=this.generateKey(e,t);this.stmtDelete.run(s),o.info(`${s}: 上下文已清除`)}close(){this.db.close(),o.info("[ChatContexts] Database closed.")}}const B=new rt,nt=["Unsupported MIME type","User location is not supported for the API use","API key not valid","400 Bad Request"];class at{gemini;baseConfig;modelName;MAX_RETRIES=3;BASE_RETRY_DELAY_MS=3e4;constructor(){this.gemini=new Te({apiKey:me.nextKey(),httpOptions:{baseUrl:y.enableKeyRotation?y.localProxyBaseUrl:y.geminiApiBaseUrl,timeout:10*6e4}}),this.baseConfig={temperature:y.modelTemperature,thinkingConfig:{thinkingBudget:-1},safetySettings:[{category:L.HARM_CATEGORY_HARASSMENT,threshold:N.BLOCK_NONE},{category:L.HARM_CATEGORY_HATE_SPEECH,threshold:N.BLOCK_NONE},{category:L.HARM_CATEGORY_SEXUALLY_EXPLICIT,threshold:N.BLOCK_NONE},{category:L.HARM_CATEGORY_DANGEROUS_CONTENT,threshold:N.BLOCK_NONE},{category:L.HARM_CATEGORY_CIVIC_INTEGRITY,threshold:N.BLOCK_NONE}]},this.modelName=y.modelName}isValidResponse(e){const t=e.candidates?.[0];return!t?.content?.parts||t.content.parts.length===0?!1:t.content.parts.some(s=>s.functionCall||s.text&&!s.thought&&s.text.trim()!=="")}calculateDelay(e){return Math.floor(this.BASE_RETRY_DELAY_MS*Math.pow(1,e)*(.8+Math.random()*.4))}simplifyContentsInLogger(e){const t=Y(e);return t.forEach(s=>this.simplifyParts(s.parts)),t}simplifyResponseInLogger(e){const t=Y(e);return t.candidates?.forEach(s=>this.simplifyParts(s.content?.parts)),t}simplifyParts(e){e&&e.forEach(t=>{t.thought&&(t.text="[THOUGHT_LOG_OMITTED]"),t.inlineData?.data&&(t.inlineData.data="[BASE64_DATA]")})}async generate(e,t={},s){let r=0;const n=t.systemInstruction;for(o.debug("加载的系统指令:",{preview:n[0].text?.slice(0,100)});;)try{o.debug("Request Contents: ",{contents:this.simplifyContentsInLogger(e)});const a=await this.gemini.models.generateContent({model:this.modelName,contents:e,config:{...this.baseConfig,...t}});if(o.debug("Response: ",{response:this.simplifyResponseInLogger(a)}),!this.isValidResponse(a))throw new f("Response validation failed: Model returned empty or invalid content.");return a}catch(a){const i=a instanceof Error?a.message:String(a);if(nt.some(p=>i.includes(p)))throw a;if(!s||r>=this.MAX_RETRIES)throw o.error(`GeminiAPI: Failed. ${s?"Max retries reached":"No retry handler"}.`,{err:a}),i.includes("Response validation failed")?new f(i):a;r++;const l=this.calculateDelay(r),u=i.includes("Response validation failed")?"模型响应无效 (空回复/仅思考)":`API/网络错误: ${i}`;o.warn(`GeminiAPI: Error detected. Retrying (${r}/${this.MAX_RETRIES}). Reason: ${u}`),await s(u,r,l),await P(l)}}}const ot=new at,it={github_toolset:{type:"http",url:"https://api.githubcopilot.com/mcp/x/all/readonly",headers:{Authorization:"Bearer ${githubToken}"}},local_rag:{type:"local",command:"pnpm",args:["exec","mcp-local-rag"],env:{BASE_DIR:"/data/mcp-local-rag/Documents",DB_PATH:"/data/mcp-local-rag/lancedb",CACHE_DIR:"/data/mcp-local-rag/models",MODEL_NAME:"jinaai/jina-embeddings-v2-base-zh",CHUNK_SIZE:"2048",CHUNK_OVERLAP:"256"}}};class fe{requestOptions={timeout:60*6e4};tools=[{functionDeclarations:[]}];clientName;serverName;serverConfig;mcp;transport=null;activeConnections=0;constructor(e){this.serverName=e,this.serverConfig=it[e],this.clientName=`${e}-client`,this.mcp=new we({name:this.clientName,version:"2.0.0"})}resolvePlaceholders(e){const t={};for(const[s,r]of Object.entries(e))typeof r=="string"?t[s]=r.replace(/\$\{(.*?)\}/g,(n,a)=>{const i=y[a];return i!==void 0?String(i):(o.warn(`Environment variable "${a}" not found for placeholder.`),n)}):t[s]=r;return t}async connect(){if(this.activeConnections++,this.transport){o.info(`[${this.clientName}] Reusing existing connection (Active: ${this.activeConnections})`);return}o.info(`[${this.clientName}] Establishing new connection...`);try{if(this.serverConfig.type==="http"){const{url:e,headers:t}=this.serverConfig,s=t?this.resolvePlaceholders(t):void 0;await this.connectRemoteServer(this.serverName,e,s)}else if(this.serverConfig.type==="local"){const{type:e,command:t,...s}=this.serverConfig;await this.connectLocalServer(this.serverName,t,s)}await this.refreshTools()}catch(e){throw this.activeConnections--,this.transport=null,o.error(`[${this.clientName}] Connection failed`,{err:e}),e}}async disconnect(){if(this.activeConnections>0&&this.activeConnections--,o.info(`[${this.clientName}] Release requested. Remaining active: ${this.activeConnections}`),this.activeConnections===0&&this.transport){o.info(`[${this.clientName}] No active users. Closing transport.`);try{await this.mcp.close()}catch(e){o.warn(`[${this.clientName}] Error closing client`,{err:e})}finally{this.transport=null}}}async connectRemoteServer(e,t,s={}){const r=new URL(t);try{o.info(`[${e}] Connecting via Streamable HTTP...`),this.transport=new ke(r,{requestInit:{headers:s}}),await this.mcp.connect(this.transport,this.requestOptions)}catch(n){o.warn(`[${e}] HTTP failed, trying SSE...`,{err:n}),this.transport=new Ee(r,{requestInit:{headers:s}}),await this.mcp.connect(this.transport,this.requestOptions)}o.info(`[${e}] Connected.`)}async connectLocalServer(e,t,s={}){o.info(`[${e}] Connecting via Stdio...`),this.transport=new be({command:t,...s}),await this.mcp.connect(this.transport,this.requestOptions),o.info(`[${e}] Connected.`)}async refreshTools(){const t=(await this.mcp.listTools()).tools.map(s=>({name:s.name,description:s.description,parameters:{type:C.OBJECT,properties:s.inputSchema.properties,required:s.inputSchema.required}}));this.tools=[{functionDeclarations:t}],o.debug("Tools refreshed:",{tools:t.map(s=>s.name)})}getTools(){return this.tools}async executeTools(e){if(!this.transport)throw new f(`[${this.clientName}] Cannot execute tools: Client is disconnected.`);const t=e.map(async r=>{const n=r.name;if(!n)return{functionResponse:{name:n,response:{error:"Tool name not provided"}}};try{const a=await this.mcp.callTool({name:n,arguments:r.args},xe,this.requestOptions);return o.info(`Tool executed: ${n}`),{functionResponse:{name:n,response:a}}}catch(a){return o.error(`Tool execution failed: ${n}`,{err:a}),{functionResponse:{name:n,response:{error:a instanceof Error?a.message:String(a)}}}}});return(await Promise.all(t)).filter(r=>r!==null)}}class ct{async performTask(e,t,s,{onToolStart:r,onRetry:n}){try{await e.connect();const a=e.getTools(),i=async(p,m)=>{r&&r(p);const g=await e.executeTools([{name:p,args:m}]);return g.length>0&&g[0].functionResponse?.response?g[0].functionResponse.response:{error:"No response from MCP tool"}},l=[{role:"user",parts:[{text:t}]}],d={temperature:1,systemInstruction:[{text:s}],tools:a,toolConfig:{functionCallingConfig:{mode:de.AUTO}},automaticFunctionCalling:{disable:!0}};return(await se.chat(l,{config:d,toolExecutor:i,maxRounds:5,onToolStart:r,onRetry:n})).text||"Task completed via tools (no summary text)."}catch(a){return o.error("[McpWorker] Task failed",{err:a}),`Error: ${a instanceof Error?a.message:String(a)}`}finally{await e.disconnect()}}}const ce=new ct;class lt{prompts=new Map;PROMPT_DIR="/data/prompts";constructor(){this.loadAllPrompts()}loadAllPrompts(){["assistant","github_toolset","native_tools","rag_system"].forEach(t=>{try{const s=Re.join(this.PROMPT_DIR,`${t}.md`);if(!re.existsSync(s)){o.warn(`Prompt file not found: ${s}`);return}const r=re.readFileSync(s,"utf-8");this.prompts.set(t,r.trim()),o.info(`Loaded prompt: ${t} (${r.length} chars)`)}catch(s){o.error(`Failed to load prompt: ${t}`,{err:s})}})}get(e){const t=this.prompts.get(e);return t||(o.error(`Attempted to access missing prompt: ${e}`),"")}format(e,t){let s=this.get(e);return s?(Object.entries(t).forEach(([r,n])=>{const a=new RegExp(`{{${r}}}`,"g");s=s.replace(a,n)}),s):""}reload(){o.info("Reloading all prompts..."),this.prompts.clear(),this.loadAllPrompts()}}const $=new lt;class dt{maxConversationRounds;constructor(){this.maxConversationRounds=y.maxApiCallRounds}createContext(e,t){return{chatId:e.chatId,userMessageId:e.userMessageId,statusMessageId:e.statusMessageId,contents:[...t]}}async handle(e,t){const s=this.createContext(e,t),r=$.get("assistant");let n=null;const a=u=>{n!==u&&(_.editMessageText(s.chatId,s.statusMessageId,u),n=u)},i=(u,p,m)=>{const g=Math.floor(m/1e3);let E="";if(u.includes("模型响应无效"))E=`模型响应异常，正在进行第 ${p} 次修正重试... (${g}s)`;else{const h=u.length>50?u.slice(0,50)+"...":u;E=`网络或接口波动，${g} 秒后重试... (Attempt ${p})
原因: ${h}`}a(E)},l=u=>{o.info(`[UI] Updating status for tool: ${u}`),a(`🔧 Executing: ${u}...`)},d=async(u,p)=>{const m=gt[u];if(!m)throw new f(`Local tool "${u}" not found in ToolExecutors.`);return await m(p,{onToolStart:l,onRetry:i})};try{o.info("Handing over to ChatAgent",{chatId:s.chatId});const u={systemInstruction:[{text:r}],tools:[{functionDeclarations:z}],toolConfig:{functionCallingConfig:{mode:de.AUTO}}};return await se.chat(s.contents,{maxRounds:this.maxConversationRounds,config:u,toolExecutor:d,onRetry:i,onToolStart:l})}catch(u){const p=u instanceof Error?u.message:String(u);throw o.error("QuestionHandler failed",{err:u,chatId:s.chatId}),p.includes("Max conversation rounds")?new f("任务过于复杂，已达到最大对话轮次。","MAX_ROUNDS"):new f(`处理失败: ${p}`,"HANDLER_ERROR")}}}const ut=new dt;class pt{apiUrl;constructor(){this.apiUrl=y.botApiUrl}async makeRequest(e,t,s){const r=`${this.apiUrl}/${t}`;let n,a;s instanceof FormData?n=s:(n=JSON.stringify(s),a={"Content-Type":"application/json"});try{const i=await fetch(r,{method:String(e).toUpperCase(),headers:a,body:n}),l=await i.json();if(!l.ok){const d=l.description,u=`API_FAILED_${String(t).toUpperCase()}_${l.error_code}`;throw o.error(`Telegram API request failed for ${t}`,{apiMethod:t,statusCode:i.status,responseBody:l}),new f(`Telegram API error: ${d}`,u)}if(!i.ok){const d=`HTTP request failed with status: ${i.status}`;throw o.error(`HTTP error for ${t}`,{statusCode:i.status}),new f(d,`HTTP_ERROR_${i.status}`)}return l.result}catch(i){if(i instanceof f)throw i;const l=i instanceof Error?i.message:String(i);throw o.error(`Network error sending request to ${t}`,{err:i}),new f(`Network error sending request to ${t}: ${l}`,"NETWORK_ERROR")}}appendToFormData(e,t,s){s!=null&&(typeof s=="object"&&!(s instanceof File)&&!(s instanceof Blob)?e.append(t,JSON.stringify(s)):e.append(t,String(s)))}stringifyField(e){return e?JSON.stringify(e):void 0}async setWebhook(e,t){const s={url:e,secret_token:t,drop_pending_updates:!0};try{return await this.makeRequest("POST","setWebhook",s),o.info("Telegram webhook set successfully.",{url:e}),{ok:!0}}catch(r){return this.handleError(r,"unknown","setWebhook",e)}}async deleteWebhook(){try{return await this.makeRequest("POST","deleteWebhook",{drop_pending_updates:!0}),o.info("Telegram webhook deleted successfully."),{ok:!0}}catch(e){return this.handleError(e,"unknown","deleteWebhook")}}async sendMessage(e,t,s){const r={chat_id:e,text:t,parse_mode:s?.parseMode,link_preview_options:{is_disabled:!0},reply_parameters:s?.replyToMessageId?{message_id:s?.replyToMessageId,allow_sending_without_reply:!0}:void 0,reply_markup:this.stringifyField(s?.replyMarkup)};try{const n=await this.makeRequest("POST","sendMessage",r);return o.info("Telegram message sent successfully.",{chatId:e,messageId:n.message_id}),{ok:!0,messageId:n.message_id}}catch(n){return this.handleError(n,e,"sendMessage",t)}}async sendPhoto(e,t,s){const r=`<blockquote expandable>${b.html(te(String(s?.caption||"")))}</blockquote>`,n={chat_id:e,photo:t,caption:s?.caption?r:void 0,parse_mode:"HTML",show_caption_above_media:!0,reply_parameters:s?.replyToMessageId?{message_id:s.replyToMessageId,allow_sending_without_reply:!0}:void 0,reply_markup:this.stringifyField(s?.replyMarkup)},a=new FormData;a.append("chat_id",String(n.chat_id)),a.append("photo",n.photo),a.append("reply_markup",n.reply_markup),this.appendToFormData(a,"caption",n.caption),this.appendToFormData(a,"parse_mode",n.parse_mode),this.appendToFormData(a,"show_caption_above_media",n.show_caption_above_media),this.appendToFormData(a,"reply_parameters",n.reply_parameters);try{const i=await this.makeRequest("POST","sendPhoto",a);return o.info("Telegram photo sent successfully.",{chatId:e,messageId:i.message_id}),{ok:!0,messageId:i.message_id}}catch(i){return this.handleError(i,e,"sendPhoto")}}async sendVoice(e,t,s){const r={chat_id:e,voice:t,caption:s?.caption,reply_parameters:s?.replyToMessageId?{message_id:s.replyToMessageId,allow_sending_without_reply:!0}:void 0,reply_markup:this.stringifyField(s?.replyMarkup)},n=new FormData;n.append("chat_id",String(r.chat_id)),n.append("voice",r.voice),n.append("reply_markup",r.reply_markup),this.appendToFormData(n,"caption",r.caption),this.appendToFormData(n,"reply_parameters",r.reply_parameters);try{const a=await this.makeRequest("POST","sendVoice",n);return o.info("Telegram voice message sent successfully.",{chatId:e,messageId:a.message_id}),{ok:!0,messageId:a.message_id}}catch(a){return this.handleError(a,e,"sendVoice")}}async sendDocument(e,t,s){const r={chat_id:e,document:t,caption:s?.caption,parse_mode:"HTML",reply_parameters:s?.replyToMessageId?{message_id:s.replyToMessageId,allow_sending_without_reply:!0}:void 0,reply_markup:this.stringifyField(s?.replyMarkup)},n=new FormData;n.append("chat_id",String(r.chat_id)),n.append("document",r.document),n.append("reply_markup",r.reply_markup),this.appendToFormData(n,"caption",r.caption),this.appendToFormData(n,"parse_mode",r.parse_mode),this.appendToFormData(n,"reply_parameters",r.reply_parameters);try{const a=await this.makeRequest("POST","sendDocument",n);return o.info("Telegram document message sent successfully.",{chatId:e,messageId:a.message_id}),{ok:!0,messageId:a.message_id}}catch(a){return this.handleError(a,e,"sendDocument")}}async sendMediaGroup(e,t,s){const r=new FormData,n=[];t.forEach((i,l)=>{const d=`file_${l}`;r.append(d,i,i.name||d);const u={type:"document",media:`attach://${d}`};l===0&&s?.caption&&(u.caption=s.caption,u.parse_mode="HTML"),n.push(u)});const a=s?.replyToMessageId?{message_id:s.replyToMessageId,allow_sending_without_reply:!0}:void 0;r.append("chat_id",String(e)),r.append("media",JSON.stringify(n)),this.appendToFormData(r,"reply_parameters",a);try{const i=await this.makeRequest("POST","sendMediaGroup",r);return o.info("Telegram media group message sent successfully.",{chatId:e,messageIds:i.map(l=>l.message_id)}),{ok:!0,messageIds:i.map(l=>l.message_id)}}catch(i){return this.handleError(i,e,"sendMediaGroup")}}async editMessageText(e,t,s,r){const n={chat_id:e,message_id:t,text:s,parse_mode:r?.parseMode,entities:this.stringifyField(r?.entities),link_preview_options:{is_disabled:!0},reply_markup:this.stringifyField(r?.replyMarkup)};try{const a=await this.makeRequest("POST","editMessageText",n);return o.info("Telegram message edited successfully.",{chatId:e,messageId:a.message_id}),{ok:!0,messageId:a.message_id}}catch(a){return this.handleError(a,e,"editMessageText",s)}}async editMessageReplyMarkup(e,t,s){const r={chat_id:e,message_id:t,reply_markup:this.stringifyField(s)};try{const n=await this.makeRequest("POST","editMessageReplyMarkup",r);return o.info("Telegram message reply markup edited successfully.",{chatId:e,messageId:n.message_id}),{ok:!0,messageId:n.message_id}}catch(n){return this.handleError(n,e,"editMessageReplyMarkup")}}async deleteMessage(e,t){try{return await this.makeRequest("POST","deleteMessage",{chat_id:e,message_id:t}),o.info("Telegram message deleted.",{chatId:e,messageId:t}),{ok:!0}}catch(s){return this.handleError(s,e,"deleteMessage")}}async deleteMessages(e,t){try{return await this.makeRequest("POST","deleteMessages",{chat_id:e,message_ids:t}),o.info("Telegram messages deleted.",{chatId:e,messageIds:t}),{ok:!0}}catch(s){return this.handleError(s,e,"deleteMessages")}}async setBotCommands(e,t,s){const r={commands:s,scope:{type:"chat_member",chat_id:e,user_id:t}};try{return await this.makeRequest("POST","setMyCommands",r),o.info("Bot commands set successfully.",{chatId:e}),{ok:!0}}catch(n){return this.handleError(n,e,"setBotCommands")}}async getFile(e){try{return{ok:!0,data:await this.makeRequest("POST","getFile",{file_id:e})}}catch(t){return this.handleError(t,"unknown","getFile",e)}}async getChatMember(e,t){try{return{ok:!0,data:await this.makeRequest("POST","getChatMember",{chat_id:e,user_id:t})}}catch(s){return this.handleError(s,e,"getChatMember")}}async answerCallbackQuery(e,t){const s={callback_query_id:e,text:t?.callbackText,show_alert:t?.showAlert};try{return await this.makeRequest("POST","answerCallbackQuery",s),o.info("Callback query answered.",{callbackQueryId:e}),{ok:!0}}catch(r){return this.handleError(r,"unknown","answerCallbackQuery",e)}}async answerInlineQuery(e,t,s){const r={inline_query_id:e,results:this.stringifyField(t),cache_time:s?.cacheTime,is_personal:s?.isPersonal,next_offset:s?.nextOffset,button:this.stringifyField(s?.button)};try{return await this.makeRequest("POST","answerInlineQuery",r),o.info("Inline query answered.",{inlineQueryId:e}),{ok:!0}}catch(n){return this.handleError(n,"unknown","answerInlineQuery",e)}}async leaveChat(e){try{return await this.makeRequest("POST","leaveChat",{chat_id:e}),o.info("Bot left chat successfully.",{chatId:e}),{ok:!0}}catch(t){return this.handleError(t,e,"leaveChat")}}handleError(e,t,s,r){const n=e instanceof f?e.message:String(e);return o.error(`Error in ${s}`,{err:e,chatId:t,context:r?r.substring(0,50):void 0}),{ok:!1,error:n}}}const _=new pt,ht=new fe("local_rag"),mt=new fe("github_toolset"),gt={use_rag_system:async(c,{onToolStart:e,onRetry:t}={})=>{o.info("[Tool] Spawning RAG Worker...");const s=$.get("rag_system");return{result:await ce.performTask(ht,c?.prompt,s,{onToolStart:e,onRetry:t})}},use_github_toolset:async(c,{onToolStart:e,onRetry:t}={})=>{o.info("[Tool] Spawning GitHub Worker...");const s=$.get("github_toolset");return{result:await ce.performTask(mt,c?.prompt,s,{onToolStart:e,onRetry:t})}},use_native_tools:async(c,{onRetry:e}={})=>{const t=$.get("native_tools"),s=[{role:"user",parts:[{text:c?.prompt}]}],r={temperature:1,systemInstruction:[{text:t}],tools:[{googleSearch:{}},{codeExecution:{}},{urlContext:{}}]},n=await se.chat(s,{config:r,onRetry:e});return{result:ft(n)}},reload_prompts:async()=>($.reload(),{result:"All prompts reloaded"})},ft=c=>{let e=c.text||"";const t=c.candidates?.[0]?.groundingMetadata?.groundingSupports||[],s=c.candidates?.[0]?.groundingMetadata?.groundingChunks||[],r=[...t].sort((n,a)=>(a.segment?.endIndex??0)-(n.segment?.endIndex??0));for(const n of r){const a=n.segment?.endIndex;if(a===void 0||!n.groundingChunkIndices?.length)continue;const i=n.groundingChunkIndices.map(l=>{const d=s[l]?.web?.uri;return d?`[${l+1}](${d})`:null}).filter(Boolean);if(i.length>0){const l=i.join(", ");e=e.slice(0,a)+l+e.slice(a)}}return e},D=async(c,e,t,s)=>{const{isCallback:r=!1,replyMarkup:n,parseMode:a="HTML",autoDeleteMs:i}=s;let l;try{if(r?l=await _.editMessageText(c,e,t,{parseMode:a,replyMarkup:n}):l=await _.sendMessage(c,t,{replyToMessageId:e,parseMode:a,replyMarkup:n}),l.ok&&i&&i>0){const d=l.messageId;S.deleteMessage(c,d,i)}return l}catch(d){throw o.error("Failed to send or edit message",{err:d,chatId:c}),d}},H=[{name:"start",description:"开始使用",action:async(c,e,t,s={})=>{o.info("Executing start command.",{userId:e});const r=O.getStartText(),n={inline_keyboard:U.start.inline_keyboard.map(a=>a.map(i=>({...i,callback_data:`${i.callback_data}_${e}`})))};await D(c,t,v(r),{isCallback:s.isCallback,replyMarkup:n,autoDeleteMs:3*6e4})}},{name:"faq",description:"常见问题",action:async(c,e,t,s={})=>{o.info("Executing faq command.",{userId:e});const r={inline_keyboard:U.backToStart.inline_keyboard.map(n=>n.map(a=>({...a,callback_data:`${a.callback_data}_${e}`})))};await D(c,t,v(O.faq),{isCallback:s.isCallback,replyMarkup:r,autoDeleteMs:5*6e4})}},{name:"clear",description:"清理对话历史",action:async(c,e,t,s={})=>{o.info("Executing clear command.",{userId:e});const{isCallback:r=!1}=s,n=await D(c,t,O.clearing,{isCallback:r});B.clear(c,e),await P(1e3);const a=r?{inline_keyboard:U.backToStart.inline_keyboard.map(l=>l.map(d=>({...d,callback_data:`${d.callback_data}_${e}`})))}:void 0,i=r?t:n.ok?n.messageId:void 0;if(i){const l=await _.editMessageText(c,i,v(O.cleared),{parseMode:"HTML",replyMarkup:a}),d=l.ok?l.messageId:i;S.deleteMessage(c,d,3*6e4)}}},{name:"tools",description:"查看可用工具",action:async(c,e,t,s={})=>{o.info("Executing tools command.",{userId:e});const r=z.length>0?z.map(i=>`• **${i.name}**: ${i.description}`).join(`

`):"暂无可用工具",n=O.toolsHeader+r,a={inline_keyboard:U.backToStart.inline_keyboard.map(i=>i.map(l=>({...l,callback_data:`${l.callback_data}_${e}`})))};await D(c,t,v(n),{isCallback:s.isCallback,replyMarkup:a,autoDeleteMs:5*6e4})}}],yt=[{keywordGroups:[["(开机)?自启(动)?","([不没无]法?|不能)生效|(启动)?失败|没用|不行|搞不定|起不来|没效果"],["autostart|boot start","fail|not working|doesn.?t work|no effect"],["(launch|start) on (startup|boot)","fail|not working|issue|problem"]],answer:`**Q: 自启动不生效？**

A: 请按以下顺序排查：
1. **路径检查**：确保程序可执行文件所在的完整路径中，不包含中文、空格或特殊字符。
2. **安全软件拦截**：检查你的安全软件（如杀毒软件、系统管家）是否有拦截或阻止本程序添加开机启动项的行为。
3. **管理员权限 (Windows)**：前往 **设置 -> 通用**，启用 **以管理员身份运行** 并重启客户端。`},{keywordGroups:[["开机|自启(动)?","(托盘|图标)","(变)?透明|消失|(空)?白|不见了|没了|(点)?不动|没反应|([不无没]法|不能)(点击|操作)"],["(在|有)?.*?进程.*?(在|有)?","托盘?图标","(变)?透明|消失|不见了|点?不动"],["(on|after) (boot|startup|start)","tray icon","transparent|disappear|gone|missing|unclickable|no response|doesn.?t work|is invisible"]],answer:`**Q: Windows 开机自启后，托盘图标透明、消失或无法点击？**

A: 这是由于在系统启动初期，桌面及托盘区域可能尚未完全加载完毕，而 GUI 客户端启动过早，导致图标未能成功渲染。

**解决方案：增加自启动延迟时间。**

1.  前往 **设置 -> 通用** 页面。
2.  找到 **开机自启动** 选项，并调整其右侧的 **延迟** 设置。
3.  建议将延迟时间设置为 **10 秒或更长**。如果问题依然存在，可以尝试继续增加延迟时间（例如 15 或 20 秒），直到图标能够稳定显示。`},{keywordGroups:[["GUI|客户端|程序|软件|exe|安装包","杀(了)?|报毒|报(是)?病毒|隔离|被删除|拦截|阻止|当(成|做)病毒"],["GUI|客户端|程序|软件|exe","找不到了|没了|不见了|自动删除|一运行就没(了)?"],["(刚)?安装(完|好)|(解压|下载)(完|好)|一解压","(文件|exe|程序)?","就?没了|不见了|找不到了|自动消失"],["GUI|客户端|程序|软件","报(有)?毒|是(不是)?病毒|有木马|提示.*?风险|提示.*?威胁|发现威胁"],["GUI|client|program|exe|installer","antivirus|defender|firewall|security","delete|quarantine|block|remove|flagged as|report as"],["GUI|client|program|exe","is a virus|trojan|malware|threat|risk"],["(after|when) i (install|download|unzip)","(it|the file|the exe) disappears|is gone|gets deleted"]],answer:`**Q: Windows 安全软件（如 Defender, 360, 火绒）报毒或查杀客户端怎么办？**

A: 这通常是安全软件的**误报**。由于 GUI 客户端需要获取**管理员权限**，其运行机制可能会触发一些安全软件的启发式扫描警报。GUI 客户端的所有代码均在 GitHub 开源，可供公开审查，不包含任何恶意代码。

**解决方案：将 GUI 程序所在的整个文件夹添加到你安全软件的信任区、白名单或排除项中。**

请根据你使用的安全软件，参考以下操作指引：

**1. Windows Defender (Windows 10/11 自带)**
*   打开 **设置** > **隐私和安全** > **Windows 安全中心**。
*   点击 **病毒和威胁防护**。
*   在“病毒和威胁防护”设置下，点击 **管理设置**。
*   向下滚动到“排除项”，点击 **添加或删除排除项**。
*   点击 **添加排除项**，选择 **文件夹**，然后将 GUI 客户端的整个文件夹添加进去。

**2. 火绒安全**
*   打开火绒主界面，点击 **防护中心**。
*   找到并点击 **信任区**。
*   点击左下角的 **添加文件** 或 **添加文件夹** 按钮，选择 GUI 客户端的整个文件夹添加即可。

**3. 对于其他安全软件 (如 360, 腾讯管家等)**
*   操作逻辑类似。请在软件的**设置**中寻找**信任区**、**白名单**、**排除列表**或类似的选项，并将 GUI 文件夹完整添加进去。

**重要提示**: 添加排除后，如果文件已被隔离或删除，你需要**重新解压或安装客户端**到该受信任的文件夹中，即可正常使用。`},{keywordGroups:[["滚动(发行)?","更新|升级|update|upgrade","[没无]法|不能|失败|不动|卡住|报错|出问题|无效|没反应|没用|(还是|仍然|依然)老版"],["rolling(-?release)?","update|upgrade","fail|stuck|error|issue|problem"]],excludeKeywords:[["内核","(启|运)动|打不开|崩了|挂了"],["core","start|launch|run","fail|crash"]],answer:`**Q: 滚动发行无法更新？**

A:
1. 首先，在 **插件中心** 检查并更新 **滚动发行** 插件至最新版本。
2. 如果问题依旧，请尝试删除程序目录下的 \`data/rolling-release\` 文件夹后重试。`},{keywordGroups:[["首页|主页|面板","只(有)?(显示)?(4|四)个|太少|没了|不见了"],["dashboard|home page","only (shows? )?4|empty|gone|missing"]],answer:`**Q: 首页只显示 4 个配置项？**

A: 这是程序设计。你可以在 **配置** 页面通过拖拽来调整配置文件的显示顺序。`},{keywordGroups:[["怎么|如何|咋|怎样","更换|修改|换|改|自定义","(托盘)?图标"],["tray icon","change|replace|customize"]],answer:`**Q: 如何更换托盘图标？**

A:
1. 前往 **设置 -> 打开应用程序文件夹**。
2. 替换或修改 \`data/.cache/icons\` 目录下的图标文件。`},{keywordGroups:[["linux","字体|文字","偏高|位置[不无]对|偏移|错位"],["linux","font|text","position|offset|too high|misaligned"]],answer:"**Q: Linux 桌面系统上 GUI 文字位置偏高？**\n\nA: 尝试安装 `Noto-Sans-CJK` 和 `Microsoft-YaHei` 字体后重启系统（此方法不一定适用于所有环境）。"},{keywordGroups:[["403"],["rate limit exceeded"],["(github|api).*(限制|rate limit)"],["超出","速(率)?","限制"]],answer:`**Q: GitHub API 速率限制 (403 rate limit exceeded)？**

A:
1. 访问你的 GitHub 开发者设置，生成一个新的 Personal Access Token (PAT)。
2. 在客户端的 **设置 -> 通用** 中，将获取的 Token 填入 **向 REST API 进行身份验证** 一栏。`},{keywordGroups:[["订阅(链接|地址)?","([不没无]法?|不能|失败|出错|用不了|没反应)","(识别|转换|解析|添加|导入)"],["订阅(链接|地址)?","(自动)?(识别|转换|解析)","([不没无]法?|不能|失败|出错|不了)"],["订阅","[没无](有)?|(不|没)显示|看不到","流量(信息)?|用量|已用|上传|下载"],["订阅","(无法|不能|没法)更新|更新.*(不了|失败)"],["节点|订阅","不全|不完整|少(了)?|缺少|数量不对|没有了"],["订阅","只有|只显示|只包含","(vmess|ss|trojan|旧|老)?节点"],["订阅","没有|不显示|缺少","(hysteria|vless|tuic|anytls|hysteria2|新)?节点"],["为啥|为什么|怎么|咋","verge|nekobox|clashx|其他客户端","有|正常|显示|全","(我|这里|这个|gui).*(不全|没有|少)"],["(nekobox|verge|clash)","(可以|正常|能用|行)","gui.*([不没]行|[不没]能|[不没]法|用不了)"],["subscription","no traffic (info)?|not a valid|fail(ed)? to update|doesn't work|can't (add|import|parse|recognize)"],["subscription","(nodes?|proxies) (incomplete|missing)|not all nodes shown"],["(it )?works in (verge|nekobox)","but not here|doesn't work here"]],excludeKeywords:[["tun"],["网(络|站|页)?"]],answer:`**Q: 订阅更新失败、无流量信息或节点不完整/缺少？**

A: 请严格按以下步骤操作：

1.  **GUI.for.SingBox 必须执行此步骤**
    前往 **插件中心**，安装 **节点转换** 插件。

2.  **所有客户端均需执行以下步骤**
    *   前往 **订阅** 页面，找到目标订阅，点击其右上角的 **...** -> **编辑**。
    *   在弹出窗口中，点击 **更多** 以展开高级选项。
    *   向下滚动找到 **请求头**，点击 **+** 添加一项，并填写：
        *   左侧 (Key): \`User-Agent\`
        *   右侧 (Value): \`Clash.Meta\`
    *   点击 **保存**，然后返回订阅页面更新该订阅即可。

*   **通用检查**: 最后，确保当前的网络环境，可以正常访问该订阅链接。`},{keywordGroups:[["多(个)?网卡","网络.*(异常|问题|用不了)|(连|上)不了网|断流"],["wifi|无线|有线|网线","(一起|同时)用","([不没无]法?|不能)上网"],["multiple network cards?","issue|problem"],["multiple network (interfaces?|cards?)","(internet|network) issue|problem|connection lost"]],answer:`**Q: 多网卡设备网络异常？**

A:
1. 前往 **配置设置 -> 路由设置 -> 通用**。
2. 禁用 **自动检测出站接口** 选项。
3. 在下方的出站接口名称列表中，手动选择正确的物理网卡作为出站接口。`},{keywordGroups:[["(怎么|如何|咋|怎样)","导入|添加|载入|放进去|(使)?用|应用|加载","(自定义|自己|完整|(手)?(写|搓)(好)?|本地|订阅(提供|(下|分)发)|远程).*?(配置|文件|规则|策略|代理|分组)"],["import","custom config|full config|apply|load"],["how to","import|load|use|apply","(my|a) (custom|full|own) config(uration)?"]],answer:`**Q: 如何导入/使用自己编写的完整配置文件？**

A: GUI.for.Cores 本身不直接支持导入完整的配置文件，这么设计是为了维持 GUI 操作的稳定性和一致性。但你可以通过以下特定功能，间接实现加载自定义配置的目的：

*   **GUI.for.Clash**: 在添加订阅时，将你的完整配置文件托管在一个可访问的 URL 上（或存放在本地文件中），然后像添加普通订阅一样添加它。关键在于，必须启用 **“使用订阅内的策略组和分流规则”** 选项。这样，客户端会优先采用你文件中的 \`proxies\`, \`proxy-groups\`, 和 \`rules\` 部分。

*   **GUI.for.SingBox**:
    *   如果你需要将配置完整迁移到 GUI 中，并通过 GUI 来管理配置，请至 **插件中心** 安装 **导入 sing-box 配置** 插件，点击 **运行**，然后按照指引操作。
    *   如果你只想简单的通过自定义配置来运行，请使用 **配置脚本** 功能。这是一个高级功能，允许你通过编写 JavaScript 代码来动态修改生成的 sing-box 配置。你可以将完整配置文件通过脚本注入到最终配置中。
      1.  首先需要新建一个配置，右键点击该配置，选择 **混入和脚本**，弹出的窗口中点击 **脚本操作**。
      2.  将以下脚本代码 **复制并粘贴** 到脚本编辑框中，将其中的变量值修改为正确的文件路径或 URL。
        *   **导入本地文件**:
\`\`\`javascript
const onGenerate = async (config) => {
  const { experimental: { clash_api } } = config;
  // 将 'PATH/TO/config.json' 替换为实际的本地文件路径
  // 从本地文件中读取并解析 sing-box 配置
  const configFilePath = 'PATH/TO/config.json';
  const fileData = await Plugins.ReadFile(configFilePath, {
    Mode: 'Text',
  });
  const _config = JSON.parse(fileData);
  // 对配置做出修改
  _config.inbounds.forEach((v) => {
    if (v.tag === 'tun-in') {
      v.auto_redirect = true;
      v.route_exclude_address_set = 'geoip-cn';
    }
  });
  // 自定义配置修改...
  // 确保 Clash API 与 GUI 配置保持一致
  _config.experimental.clash_api = {
    ..._config.experimental.clash_api,
    external_controller: clash_api.external_controller,
    secret: clash_api.secret,
  };
  // 返回修改后的配置
  return _config;
};
\`\`\`
        *   **导入远程文件**:
\`\`\`javascript
const onGenerate = async (config) => {
  const { experimental: { clash_api } } = config;
  // 将 URL 替换为实际的远程配置文件地址
  // 从远程 URL 读取并解析 sing-box 配置
  // 此方法需要远程订阅或者配置文件支持 sing-box 的原生格式
  const configFileUrl = 'https://example.com/config.json';
  const { body } = await Plugins.Requests({
      method: 'GET',
      url: configFileUrl,
      headers: {
        'User-Agent': 'sing-box'
      },
      autoTransformBody: false
  });
  const _config = JSON.parse(body);
  // 对配置做出修改
  _config.inbounds.forEach((v) => {
    if (v.tag === 'tun-in') {
      v.auto_redirect = true;
      v.route_exclude_address_set = 'geoip-cn';
    }
  });
  // 自定义配置修改...
  // 确保 Clash API 与 GUI 配置保持一致
  _config.experimental.clash_api = {
    ..._config.experimental.clash_api,
    external_controller: clash_api.external_controller,
    secret: clash_api.secret,
  };
  // 返回修改后的配置
  return _config;
};
\`\`\``},{keywordGroups:[["(怎么|如何|咋|怎样)","(快速|快捷|手动)?(导入|添加|加入|粘贴|使用)","(单个|单独)?(的)?节点|分享链接|(ss|vmess|trojan)链接"],["(ss|ssr|vmess|vless|trojan|hysteria2?|tuic|wireguard)(://)?","(怎么|如何|咋|怎样)(导入|添加|使用)"],["gfs|gui","(怎么|如何|咋|怎样)(导入|添加|使用)","(单个|单独)?(的)?节点|分享链接"],["(how to|fastest way to)?","(import|add|paste|use)","(a )?(single|individual) node|(a )?share link"]],answer:`**Q: 如何快速导入单个节点分享链接 (如 ss://, vmess://)？**

A: 你可以通过“节点转换”插件，轻松地将单个节点链接转换为配置片段，并手动添加到客户端中。请严格遵循以下步骤：

**第一步：使用插件转换节点链接**

1.  前往 **插件** 页面，找到 **节点转换** 插件。
    *   如果未安装，请点击 **插件中心**，找到该插件并 **添加**。
    *   如果已安装，建议先点击 **检查更新** 确保其为最新版本。
2.  点击 **节点转换** 插件的 **运行** 按钮。
3.  在弹出的窗口中，**粘贴** 你的节点分享链接 (例如 \`ss://...\` 或 \`vmess://...\`)。
4.  点击 **确定** 后，请选择你需要的配置格式 (例如 **SingBox格式** 或 **Mihomo格式**)。
5.  在转换结果窗口中，**复制** 生成的节点配置内容 (通常是一段 JSON 文本)。

**第二步：创建并编辑手动订阅**

1.  前往 **订阅** 页面，点击右上角的 **添加** 按钮。
2.  在弹出的窗口中，订阅类型选择 **手动管理**。
3.  为这个手动订阅**命名** (例如 \`我的手动节点\`)，然后点击 **保存**。
4.  回到订阅列表，找到你刚刚创建的手动订阅，**右键** 点击该订阅，选择 **编辑节点(源文件)**。
5.  在打开的编辑器中，**粘贴** 你在第一步复制的节点配置内容。
    *   **注意**：如果复制的内容是 \`[{...}]\` 格式的数组，请直接覆盖编辑器内原有的 \`[]\`。如果只是 \`{...}\` 格式的单个对象，请将其粘贴到 \`[]\` 中括号内。
6.  点击 **保存**。

**第三步：在配置中引用新节点**

最后，你需要在一个出站或策略组中使用这个新添加的节点：

*   **对于 GUI.for.SingBox 客户端：**
    1.  前往 **配置** 页面，找到你要修改的配置文件，**右键** 点击该配置，选择 **出站设置**。
    2.  在出站列表中，选择一个你想要添加节点的 **出站分组** (例如 \`节点选择\`)，点击其右侧的 **编辑** 图标。
    3.  在编辑界面的下方 **“引用出站 & 引用订阅”** 区域，找到并 **选中** 你刚才创建的手动订阅 (例如 \`我的手动节点\`)。
    4.  点击 **保存**。

*   **对于 GUI.for.Clash 客户端：**
    1.  前往 **配置** 页面，找到你要修改的配置文件，**右键** 点击该配置，选择 **策略组设置**。
    2.  在策略组列表中，选择一个你想要添加节点的 **策略组** (例如 \`PROXY\`)，点击其右侧的 **编辑** 图标。
    3.  在编辑界面的下方 **“引用出站 & 引用订阅”** 区域，找到并 **选中** 你刚才创建的手动订阅。
    4.  点击 **保存**。

完成以上所有步骤后，你新导入的节点就已经成功添加并可以在相应的策略组中被选择使用了。`},{keywordGroups:[["连接|日志","右键|添加","直连|代理|拦截","[不没无]生效|没(有)?(效果|反应)|不起作用|没用"],["连接|日志","(右键|添加)的?(规则)?","怎么|如何|咋","(让.*)?(生效|启用|起作用|应用)"],["连接|日志","添加.*?(规则)?","在(哪|哪里)|如何|怎么","看|查看|找到|编辑|修改|删除|移除"],["添加(到)?","直连|代理|拦截","(哪个|什么|哪里).*(规则)?文件"],["(direct|proxy|reject)(\\.(yaml|json))?","怎么用|如何生效|不起作用"],["右键","添加|设置","直连|代理|拦截","然后呢|下一步|怎么用"]],answer:"**Q: 在活动连接（日志）中右键添加的规则不生效？**\n\nA: 通过 **概览页** 的 **活动连接（日志）** 面板右键添加的规则，本质上是向本地的三个特定规则集文件（`direct.xxx`, `proxy.xxx`, `reject.xxx`）追加条目。你需要手动在配置中引用这些规则集，才能让这些规则真正生效。\n\n操作步骤如下：\n\n**第一步：添加到规则集页面**\n\n1.  前往 **插件中心**，安装并运行 **一键添加规则集** 插件。\n2.  在弹出的窗口中，确保至少选中了 `direct`, `reject`, `proxy` 这三个规则集，然后点击确定。\n\n**第二步：在配置中引用规则集**\n\n你需要为每个配置方案单独进行设置：\n\n*   **对于 GUI.for.SingBox:**\n    1.  在 **配置** 页面，右键点击目标配置，选择 **路由设置**。\n    2.  进入 **规则集** 标签页，点击 **添加**。\n        *   **类型**: 选择 `本地`。\n        *   **规则集**: 分别选择 `direct`, `proxy`, `reject` 添加三次。\n    3.  进入 **规则** 标签页，点击 **添加**。\n        *   **规则类型**: 选择 `规则集`。\n        *   **规则集**: 选择你刚刚添加的规则集（例如 `direct`）。\n        *   **出站标签**: 选择对应的出站（例如 `direct` 规则集对应 `direct` 出站）。\n        *   重复此操作，为 `proxy` 和 `reject` 也创建规则。\n\n*   **对于 GUI.for.Clash:**\n    1.  在 **配置** 页面，右键点击目标配置，选择 **规则设置**。\n    2.  点击 **添加**。\n        *   **类型**: 选择 `RULE-SET`。\n        *   **规则集类型**: 选择 `本地`。\n        *   **规则集**: 选择对应的文件（例如 `direct.yaml`）。\n        *   **代理**: 选择对应的策略组（例如 `DIRECT`）。\n        *   重复此操作，为 `proxy.yaml` 和 `reject.yaml` 也创建规则。\n\n**重要提示**：规则的顺序至关重要。请将你手动添加的这些规则集规则，放置在路由规则列表的**靠前位置**，以确保它们能被优先匹配。"},{keywordGroups:[["cache.*(file)?","timeout"],["缓存|cache","(文件|file)?","超时|timeout"],["启动|initialize","内核|服务|service","卡住|超时|timeout","缓存|cache"]],excludeKeywords:[["(enabled|path|fakeip|rdrc)"]],answer:`**Q: 报错 "initialize cache-file: timeout"？**

A: sing-box 内核在启动时需要读写缓存文件（\`cache.db\`），此报错意味着该文件被另一个进程锁定或占用，导致新进程在规定时间内无法访问，最终超时失败。这通常是由于旧的内核进程未能正常退出所致。
*   **解决方案**:
    1.  **彻底关闭相关进程**: 打开你操作系统的任务/进程管理工具：
        *   **Windows**: 任务管理器 (Task Manager)
        *   **macOS**: 活动监视器 (Activity Monitor)
        *   **Linux**: 系统监视器或使用 \`kill\` 命令
    2.  **手动结束进程**: 在进程列表中，找到并手动结束所有名为 \`sing-box\` 的进程。
    3.  **重启内核**: 返回客户端，重新启动内核。此操作应能顺利完成。
*   **如果问题频繁出现**: 请前往 **软件设置 -> 通用**，找到并启用 **退出程序时同时关闭内核** 选项。这能确保每次退出程序时都不会留下残留的内核进程，从而避免缓存文件被持续占用。`},{keywordGroups:[["detour","empty","direct"],["detour to an empty direct outbound"],["DNS|域名服务器","出站|outbound","直连|direct","报错|出错|不行"]],answer:`**Q: 报错 "detour to an empty direct outbound makes no sense"？**

A: 新版本的 sing-box 内核不再允许将 DNS 服务器的“出站 (detour)”选项显式地设置为 \`direct\` 类型。
*   **解决方案**: 将该选项清空即可，内核会默认采用直连。
    1.  前往 **配置设置 -> DNS 设置 -> 服务器**。
    2.  找到“出站”为 \`直连 (direct)\` 的 DNS 服务器，点击其右侧的 **编辑** 按钮。
    3.  在弹出的编辑窗口中，点击出站标签 **旁边的 “x” 按钮** 将其清空。
    4.  保存设置。清空后，该 DNS 请求会默认直连发出，且符合内核新的配置规范。`},{keywordGroups:[["missing","tags"],["缺少|missing","标签|tags"],["出站|outbound|分组","没有|缺少|空","节点|订阅|tags|标签"]],answer:`**Q: 报错 "create service: initialize outbound[*]: missing tags"？**

A: 某个出站分组内是空的，没有任何可用的节点或指向其他有效的分组。**每个出站分组必须至少包含一个可用的出站目标。**
*   **解决方案**:
    1.  前往 **配置设置 -> 出站设置 (Outbounds)**。
    2.  在左侧列表中，找到有 **感叹号 (!)** 标记的出站分组。
    3.  点击 **编辑** 该分组，并确保其“引用出站 & 引用订阅”部分中至少选择了一个有效的订阅、单个节点或其他分组。`},{keywordGroups:[["max.*early.*data","unknown.*(field)?"],["max_early_data","报错|错误|error"],["订阅","(更新|使用)后","报错|提示","max_early_data"]],answer:`**Q: 报错 "unknown field 'max_early_data'" 或相关类型错误？**

A: 部分订阅源提供的节点信息中，\`max_early_data\` 字段的值**不是规范的数字类型**（例如，错误地设置为了字符串 "" 或布尔值 false），导致内核解析配置时因类型不匹配而失败。
*   **解决方案**: 使用 **订阅脚本** 功能，在客户端接收到订阅内容后，自动修正这个错误。
    1.  在 **订阅** 页面，右键点击出错的订阅，选择 **脚本**。
    2.  将以下脚本代码 **完整复制并粘贴** 到脚本编辑框中：
\`\`\`javascript
const onSubscribe = async (proxies, subscription) => {
  // 遍历从订阅中获取的每一个代理节点
  proxies.forEach((p) => {
    // 检查节点是否存在 'transport' 属性，并且其中包含 'max_early_data' 字段
    if (p.transport && 'max_early_data' in p.transport) {
      const earlyData = p.transport.max_early_data;

      // 如果 'max_early_data' 的值不是一个有效的数字 (例如是字符串、布尔值等)
      if (typeof earlyData !== 'number' || isNaN(earlyData)) {
         // 则从配置中删除这个不规范的字段，避免内核报错
         delete p.transport.max_early_data;
      }
    }
  });

  // 返回修正后的代理列表和原始订阅信息
  return { proxies, subscription };
}
\`\`\`
    3.  点击 **保存**，然后 **更新该订阅**。问题应得到解决。`},{keywordGroups:[["unknown.*(field|key|option|parameter)"],["报错|提示","未知|不存在|不认识|无效","字段|选项|参数|配置项"],["字段|选项|参数|配置项","不存在|找不到|未定义|不认识|是啥|什么意思"]],answer:`**Q: 报错 "unknown field" / 提示未知字段？**

A: 这个错误通常意味着你在配置文件中使用了当前内核不认识的配置项。

**原因分析**:
*   **拼写错误或字段已弃用**: 你可能手误拼错了字段名称，或者该字段在你当前的内核版本中已被重命名或移除。
*   **版本不兼容**: 你使用的配置字段可能只在较新的内核版本中才被支持，而你当前的内核版本过旧。
*   **配置格式错误**: 该字段的值类型或结构不正确（例如，期望填入一个字符串，却提供了一个列表），导致内核无法正确解析。

**解决方案**:
请按照以下步骤排查：

1.  **核对官方文档**: 前往你所使用内核（sing-box 或 mihomo）的官方文档，仔细核对该字段的：
    *   **准确名称**: 确保字段名拼写无误。
    *   **支持版本**: 确认你当前的内核版本是否支持该字段。
    *   **正确用法**: 检查该字段期望的值类型和配置结构。

2.  **执行标准更新流程**: 为确保你使用的是最新环境，请依次执行：
    *   前往 **设置 -> 关于**，更新 GUI 客户端。
    *   前往 **插件中心**，更新并运行 **滚动发行** 插件。
    *   前往 **设置 -> 内核**，更新内核至最新版本。

3.  **修正配置**: 根据文档核对的结果，修正你配置中的错误字段或其值，然后重启内核。`},{keywordGroups:[["(提示|报错)?","已损坏","无法打开|打不开","(移到|扔到|丢到)?废纸篓"],["mac","(无法|不能)验证开发者|来自身份不明的开发者|未识别的开发者"],["mac","将对(你的)?电脑造成(伤害|损坏)|恶意软件"],["mac|苹果","(软件|客户端|程序|app|应用)?","(启动|运行)不(了|起来)|打不开|启动不了|([不没无]法|不能)(启动|运行|打开)|没反应|无响应|闪退|点不开|运行不了|一直(转圈)?加载"],["mac","(下载|安装)了?","打不开|用不了|没反应"],["mac(系统|系统的)?","(怎么|咋|为啥|就是)?(打不开|([不没无]法|不能)(启动|运行|打开)|启动不了|用不了|没反应)","(求助|指导|怎么办|哪位|大(侠|佬|哥)?)?"],["mac","任何来源","没有|找不到|怎么开|如何启用"],["mac","xattr|quarantine|隔离","移除|删除|命令"],["mac","怎么|如何","签名|codesign"],["mac","app|application|program","(can.?t|won.?t) open|damaged|not working|crash(es)?"],["mac","developer cannot be verified|unidentified developer"],["mac","is damaged and can.?t be opened"],["mac","move to (trash|bin)"]],excludeKeywords:[["tun"],["网"]],answer:`**Q: macOS 提示“已损坏”、“无法验证开发者”或“将对电脑造成伤害”，导致程序无法打开？**

A: 这是 macOS 的安全机制 (Gatekeeper) 导致的，属于正常现象。请严格按照以下步骤操作即可解决，通常只需要完成前两步。

**常规解决方案 (95% 的问题可解决)**

**第一步：移除应用的安全隔离属性**

打开 “终端” (Terminal) 应用程序，复制并粘贴以下命令，然后按回车执行。

\`\`\`bash
# -d 参数表示移除属性，-r 表示递归处理整个 .app 包
sudo xattr -dr com.apple.quarantine
\`\`\`
**重要提示**：在上面的命令最后（\`quarantine\` 后面）**需要加一个空格**，然后从 “访达” (Finder) 的 “应用程序” 文件夹中，**将无法打开的客户端程序图标拖拽到终端窗口中**，它会自动填充正确的路径。最终命令看起来像这样：
\`sudo xattr -dr com.apple.quarantine /Applications/GUI.for.SingBox.app\`

执行时会提示你输入电脑的开机密码（输入时密码不可见），输入后按回车即可。

**第二步：在系统设置中允许应用运行**

1.  前往 **系统设置 -> 隐私与安全性**。
2.  向下滑动到 “安全性” 部分。
3.  你会看到一条提示 “已阻止使用‘你的应用名’，因为其来自不明开发者。”，点击右侧的 **“仍要打开”** 按钮，并根据提示输入密码。

完成以上两步后，再次尝试打开客户端程序。

**进阶解决方案 (如果问题依旧)**

**方案 A：开启“任何来源”选项**

如果 “隐私与安全性” 中没有出现 “仍要打开” 的按钮，可以先在终端执行以下命令来显示 “任何来源” 选项：

\`\`\`bash
sudo spctl --master-disable
\`\`\`
执行后，回到 **系统设置 -> 隐私与安全性**，勾选 “允许从以下位置下载的 App” 下的 **“任何来源”** 选项。

**方案 B：覆盖恶意软件保护 (针对“将对电脑造成伤害”提示)**

1.  在 “访达” 的 “应用程序” 文件夹中，右键点击客户端图标，选择 **“显示简介”**。
2.  在弹出的窗口中，勾选 **“覆盖恶意软件保护”** 复选框。

**方案 C：对应用进行强制重签名 (终极方案)**

如果以上方法均无效，可能是应用签名问题。请在终端执行以下命令：

\`\`\`bash
# 前提是需要已安装 Xcode Command Line Tools
codesign --force --deep --sign -
\`\`\`
同样的，在命令末尾（\`-\` 后面）**加一个空格**，然后将应用图标拖入终端窗口来填充路径。如果提示需要安装命令行工具，请同意安装后再执行此命令。`},{keywordGroups:[["tun(模式)?","(启动|开启|打开)失败","权限|permission"],["tun(模式)?","([没无]|缺少)权限|permission denied"],["linux|内核","怎么|如何|咋","(给|授(予)?)?(特)?权|提权|管理员"],["linux","怎么|如何|咋","启用|开启|打开","tun"],["tun( mode)?","permission|privilege|admin rights|sudo|root"]],excludeKeywords:[["file not found"]],answer:`**Q: TUN 模式无权限导致启动失败？**

A:
*   **Windows**: 前往 **设置 -> 通用**，启用 **以管理员身份运行** 并重启客户端。
*   **macOS/Linux**: 前往 **设置 -> 内核** 页面，点击 **授予特权** 按钮为内核授权。
    *   **如果需要配置防火墙**: 请参考 Mihomo 的 [TUN 入站](https://wiki.metacubex.one/en/config/inbound/tun/#stack) 文档。`},{keywordGroups:[["linux","(授(予)?|给)?(特)?权(限)?","[没无](反应|效(果)?|用)|点不了"],["(授(予)?|给)?(特)?权(限)?","没(有)?(效果|反应)|点(了)?没用|无效"],["linux","authorize button","doesn.?t work|no response|nothing happens"]],answer:"**Q: Linux 点击授权按钮没反应？**\n\nA: Linux 上的授权操作依赖 `pkexec` 命令，请确保已安装提供此命令的软件包。"},{keywordGroups:[["tun","configure","cannot","find","file"],["tun","configure","找不到","文件"]],answer:'**Q: 报错 "configure tun interface: The system cannot find the file specified."？**\n\nA: sing-box 无法创建 TUN 虚拟网卡。\n*   **解决方案**:\n    1. 检查 **入站设置** -> `tun-in` 的 **TUN 网卡名称** 是否为空，尝试填入任意名称（如 `sing-box-tun`）。\n    2. 确保没有其他应用（如其他代理软件、VPN）占用了 TUN 服务。\n    3. 前往 **配置设置 -> 入站设置** -> `tun-in`，尝试修改 **IP 地址前缀** 为一个冷门的私有网段，以避免与当前局域网或其他网络接口产生冲突。'},{keywordGroups:[["tun","[没无]反应|^(?=.*([没无不]法|不能|连不上|访问不了|上不了|没))(?=.*网(络)?).*|断网|加载失败|无法加载|一直加载|不停转圈|请求超时"],["tun","(打不开|无法访问|访问不了|进不去|加载不了|显示不了)","(某个|这个|特定|所有)?(网站|网页|链接|google|github|youtube|bilibili)"],["tun","网络.*(异常|问题|断了|坏了|用不了|好像有问题|炸了)"],["tun","(一开|打开|启用|只要一开).*(就)?","没网|断网|上不了网|加载不出来|网站打不开|应用没反应|图片刷不出"],["(关|关掉|禁用)了?tun","(就)?(好|恢复|正常)了"],["tun","(只能|仅|只有).*(tg|电报|telegram)","(网页|网站|浏览器|其他|别的|剩下|剩余).*(打不开|没反应|用不了|加载不出来)"],["tun","(有的|有些|部分)网站","(可以|行|正常)","(有的|另一些|其他的)","(不行|打不开|加载失败)"],["tun","国内.*(正常|可以|能打开)","国外.*(不行|访问不了|打不开)"],["tun","图片|视频|附件","加载不(了|出来)|刷不出|显示不了"],["mac(os)?","(启动|运行|开)?","内核|tun","没网|断网|上不了网|^(?=.*(还|仍|依))(?=.*(系统|默认|自带))(?=.*DNS).*|^(?=.*([无没]法|不能|没有))(?=.*(接管|劫持|生效|用))(?=.*DNS).*"],["tun","系统代理","才|必须|要开|依赖|同时|可以|访问不了"],["tun","(no|lost) (internet|connection)|can.?t connect|not working|stuck on loading|loading failed|won.?t load|endless spinning|request timed out"],["tun","can.?t (open|access|load|get to|reach)","(a|any|specific)? (website|page|site|google|github)"],["(when|after) (i )?(enable|turn on) tun","(i )?(lose|lost) internet|no network|sites won.?t load|images fail to load"],["(it )?works (again|fine) after (i )?(disable|turn off) tun"],["tun","(only|just) (tg|telegram) works","(browsers?|websites?) (doesn.?t|not) work"],["with tun","some websites work","others don.?t"],["mac(os)?","tun","(no|lost) (internet|connection)|can.?t connect|not working"]],excludeKeywords:[["permission denied"],["file not found"],["(ssl|证书).*(错误|error)"]],answer:`**Q: TUN 模式启动后无法上网或网络异常？只启用 TUN 无法访问网站？必须同时开启系统代理才能访问网站？**

A: 请按以下顺序排查，方案覆盖 Windows, macOS 及 Linux：
*   **方案 A (通用): 更换 TUN 模式堆栈**
    在配置设置中尝试更换 **TUN 模式堆栈** 为 **GVisor**。

*   **方案 B (macOS 特定): 修改系统 DNS**
    *   **原因**: sing-box 在 macOS 无法劫持发往局域网的 DNS 请求。
    *   **解决方案**: 将你 Mac 的系统 DNS 修改为任意公共 DNS 服务器（例如 \`8.8.8.8\`）。

*   **方案 C (Windows 特定): 检查防火墙**
    检查 Windows 防火墙设置，确保 GUI 客户端及其内核程序未被阻止。

*   **方案 D (通用 / IPv6 问题): 调整 IPv6 设置**
    如果你的网络不支持 IPv6，请进行以下调整：
    1.  **配置设置 -> 入站设置** -> \`tun-in\` -> 删除 IPv6 地址前缀，并启用 **严格路由**。
    2.  **配置设置 -> DNS 设置 -> 通用** -> 将 **解析策略** 修改为 \`只使用 IPv4\`。

*   **方案 E (通用 / IP 冲突): 修改 IP 地址前缀**
    前往 **配置设置 -> 入站设置** -> \`tun-in\`，尝试修改 **IP 地址前缀** 为一个冷门的私有网段，以避免与当前局域网或其他网络接口产生冲突。`},{keywordGroups:[["tun(模式)?","(ssl|证书).*(错误|error)"],["tun( mode)?","ssl|certificate","error|issue|problem"]],answer:"**Q: TUN 模式下出现 SSL 证书错误？**\n\nA: 尝试将你操作系统的 DNS 服务器地址修改为公共 DNS，例如 `8.8.8.8` 或 `1.1.1.1`。"},{keywordGroups:[["怎么|如何|咋","看|查看|打开|在哪","(gui)?.*(控制台|日志)"],["log","where|how to view|find"]],answer:"**Q: 如何查看 GUI 日志？**\n\nA: 按 `Ctrl + Shift + F12` 打开开发者工具控制台即可查看，主要记录 GUI 自身运行信息。"},{keywordGroups:[["怎么|如何|咋","启用|开启|打开","滚动(发行)?"],["how to","enable","rolling(-release)?"]],answer:`**Q: 怎么启用滚动发行？**

A:
1. 在 **通用设置** 中确保 **启用滚动发行** 已启用。
2. 在 **插件中心** 安装并运行 \`滚动发行\` 插件。
3. 定期在 **插件中心** 更新 \`滚动发行\` 插件。`}],z=[{name:"use_rag_system",description:"使用此工具可以对 RAG 系统进行操作，支持查询、导入和删除文档，还可以检查系统状态。",parameters:{type:C.OBJECT,properties:{prompt:{type:C.STRING,description:"用自然语言描述要执行的操作。（例如：请帮我查询 sing-box 的 TUN 入站的相关文档）"}},required:["prompt"]}},{name:"use_github_toolset",description:"使用此工具可以调用 Github 提供的工具集，对 GitHub 平台进行操作，支持几乎所有 Github REST API 操作。（例如：查询 xxx 仓库的提交记录、获取发布详情等）",parameters:{type:C.OBJECT,properties:{prompt:{type:C.STRING,description:"用自然语言描述要执行的操作。（例如：请帮我查询 GUI.for.SingBox 仓库中关于插件功能的源码）"}},required:["prompt"]}},{name:"use_native_tools",description:"使用此工具可以调用 Google Gemini 提供的原生工具，支持 Google 搜索（实时联网查询）、代码执行（执行任意 Python 代码）、URL 上下文（获取 URL 的内容）。",parameters:{type:C.OBJECT,properties:{prompt:{type:C.STRING,description:"用自然语言描述要执行的操作。（例如：请帮我查询介绍 sing-box 的博客。）"}},required:["prompt"]}},{name:"reload_prompts",description:"使用此工具重新加载对话系统的所有系统指令，将在下次对话时生效。"}],O={getStartText:()=>{const{modelName:c,botName:e}=y;return`
🤖 当前使用模型：\`${c}\`

✨ 你好！你可以通过以下方式与我互动，我能理解上下文哦：

*   **➡️ 直接回复我**
    *   直接回复我的任意消息即可继续对话或追问，我会将该消息作为最新上下文。

*   **💬 发起新话题**
    *   \`@${e}\` + 你想问的问题
    *   \`:ask\` + 你想问的问题

*   **🔗 引用他人消息提问**
    *   回复或引用**他人**的消息时，请务必加上 \`@${e}\` 或 \`:ask\`，我就会针对该消息进行解答。

*   建议**优先**使用 \`:ask\` 指令与我互动

👍 由 Cloudflare、ClawCloud Run 和 Google Gemini 提供支持
`.trim()},faq:`
**GUI.for.Cores 常见问题与解决方案 (FAQ)**

**⚙️ 常规与界面**

**Q: 软件开机自启动不生效？**
A: 请检查程序所在的完整路径，确保其中不包含中文、空格或特殊字符。

**Q: 滚动发行插件无法更新到新版本？**
A:
1.  首先，请在 **插件中心** 检查并更新 \`滚动发行\` 插件本身至最新版本。
2.  如果问题依旧，请尝试删除程序目录下的 \`data/rolling-release\` 文件夹后重试。

**Q: 滚动发行提示无法跨大版本升级？**
A: 滚动发行仅在当前最新的大版本内工作。当客户端发布新的大版本后，你需要前往 **设置 -> 关于** 页面，手动检查并更新主程序。

**Q: 首页为什么只显示 4 个配置项？**
A: 这是程序设计。你可以在 **配置** 页面通过拖拽来调整配置文件的显示顺序。

**🌐 网络与订阅**

**Q: 更新时提示 "403 API rate limit exceeded" 错误？**
A:
1.  请前往你的 GitHub 开发者设置，生成一个新的 Personal Access Token (PAT)。
2.  将获取的 Token 填入客户端的 **设置 -> 通用 -> 向 REST API 进行身份验证** 输入框中。

**Q: 订阅没有流量信息，或更新时提示 "Not a valid subscription data"？**
A:
1.  在 **订阅 -> 编辑** 中，为目标订阅添加请求头 \`User-Agent: Clash.Meta\`。
    *   GUI.for.SingBox 还需安装 **节点转换** 插件。
2.  同时，请确保你当前的网络环境可以正常访问该订阅链接。

**Q: 在有多网卡的设备上（如同时连接Wi-Fi和网线），启动后网络异常？**
A:
1.  前往 **配置设置 -> 路由设置 -> 通用**。
2.  禁用 **自动检测出站接口** 选项。
3.  在下方的出站接口名称列表中，手动选择你当前用于上网的那个物理网卡。

**🐞 内核错误**

**Q: 报错 \`"start service: initialize cache-file: timeout"\`？**
A: 原因是 sing-box 进程未能正常退出。请打开任务管理器（或活动监视器），手动结束所有名为 \`sing-box\` 的进程，然后重启内核。

**Q: 报错 \`"detour to an empty direct outbound makes no sense"\`？**
A: 这是新版 sing-box 的规则。
1.  前往 **配置设置 -> DNS 设置 -> 服务器**。
2.  找到“出站”标签为 \`直连\` 的服务器，点击 **编辑**。
3.  点击出站标签旁边的 **x** 按钮将其清空（留空默认即为直连）。

**Q: 报错 \`"create service: initialize outbound[*]: missing tags"\`？**
A: 原因是某个出站分组内为空。请前往 **配置设置 -> 出站设置**，找到左侧有红色感叹号的出站分组，点击 **编辑** 并确保其至少包含一个订阅或有效节点。

**🛡️ TUN 模式专项**

**Q: TUN 模式提示无权限，启动失败？**
A:
*   **Windows**: 前往 **设置 -> 通用**，启用 **以管理员身份运行**，然后重启客户端。
*   **macOS/Linux**: 前往 **设置 -> 内核** 页面，点击授权按钮为内核程序授权。

**Q: Linux 点击授权按钮没反应？**
A: Linux 上的授权操作依赖 \`pkexec\` 命令，请确保你的系统已安装提供此命令的软件包。

**Q: TUN 模式启动后无法上网？**
A: 请按以下顺序排查：
1.  **更换TUN堆栈**: 在软件设置中尝试更换 **TUN 堆栈模式** (例如 GVisor, System)。
2.  **检查防火墙**: 检查 Windows 防火墙设置，确保 GUI 客户端及其内核程序（如 \`sing-box.exe\`）未被阻止。
3.  **处理IPv6问题**: 如果你的网络环境不支持 IPv6，请进行以下调整：
    *   前往 **配置设置 -> 入站设置**，编辑 \`tun-in\`，在 **IPv4 和 IPv6 前缀** 中删除 IPv6 地址，并启用 **严格路由**。
    *   前往 **配置设置 -> DNS 设置 -> 通用**，将 **解析策略** 设为 \`只使用 IPv4\`。

**Q: TUN 模式下出现 SSL 证书错误？**
A: 请尝试将你操作系统的 DNS 服务器地址修改为公共 DNS，例如 \`8.8.8.8\` 或 \`1.1.1.1\`。

**Q: macOS 系统启用 TUN 模式后无法上网？**
A: 原因是 sing-box 在 macOS 上不劫持发往局域网的 DNS 请求。请将你 Mac 的系统 DNS 修改为任意公共 DNS 服务器（如 \`8.8.8.8\`）。
`.trim(),clearing:"🗑 正在清理记忆...",cleared:`✅ **记忆已重置**

我现在已经准备好开始新的话题了。`,toolsHeader:`🛠 **当前可用工具：**

`},U={start:{inline_keyboard:[[{text:"🗑 清理对话",callback_data:"cmd_clear"},{text:"❓ 常见问题",callback_data:"cmd_faq"}],[{text:"🛠 查看工具",callback_data:"cmd_tools"}]]},backToStart:{inline_keyboard:[[{text:"⬅️ 返回主菜单",callback_data:"cmd_start"}]]}};class _t{async handleCommand(e){const{queryId:t,userId:s,chatId:r,messageId:n,data:a}=e,[,i,l]=a.split("_"),d=Number(l);if(s!==d){await _.answerCallbackQuery(t,{callbackText:"🚫 你没有权限进行此操作",showAlert:!0});return}await _.answerCallbackQuery(t);const u=H.find(p=>p.name===i);if(u)try{await u.action(r,d,n,{isCallback:!0})}catch(p){o.error("Error executing callback command",{err:p,commandName:i})}else o.warn("Callback command not found",{commandName:i})}async handle(e){if(!e.message||!e.data){o.info("Invalid callback query: missing message or data",{queryId:e.id});return}const{id:t,from:s,message:r,data:n}=e,{chat:a,message_id:i}=r,l={queryId:t,userId:s.id,chatId:a.id,messageId:i,data:n};o.info("Handling callback query",{...l});try{l.data.startsWith("cmd_")?await this.handleCommand(l):await _.answerCallbackQuery(l.queryId)}catch(d){o.error("Error in callback query handler dispatch",{err:d,queryId:t}),await _.answerCallbackQuery(l.queryId)}}}const Tt=new _t,A={APPLICATION_TYPES:["pdf"],IMAGE_TYPES:["png","jpeg","webp","heic","heif"],VIDEO_TYPES:["mp4","mpeg","mov","avi","x-flv","mpg","webm","wmv","3gpp"],AUDIO_TYPES:["wav","mp3","aiff","aac","ogg","flac"]},K={txt:"text/plain",html:"text/html",htm:"text/html",vue:"text/html",css:"text/css",less:"text/css",csv:"text/csv",md:"text/markdown",mdx:"text/markdown",js:"text/javascript",ts:"text/javascript",jsx:"text/javascript",tsx:"text/javascript",py:"text/plain",java:"text/plain",c:"text/plain",cpp:"text/plain",cs:"text/plain",go:"text/plain",php:"text/plain",sql:"text/plain",xml:"text/xml",json:"application/json",jsonc:"application/json",json5:"application/json",yaml:"application/yaml",yml:"application/yaml",sh:"application/x-shellscript",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp",heic:"image/heic",heif:"image/heif",gif:"image/gif",mp4:"video/mp4",mpeg:"video/mpeg",mov:"video/mov",avi:"video/avi",flv:"video/x-flv","x-flv":"video/x-flv",mpg:"video/mpg",webm:"video/webm",wmv:"video/wmv","3gpp":"video/3gpp",wav:"audio/wav",mp3:"audio/mp3",aiff:"audio/aiff",aac:"audio/aac",ogg:"audio/ogg",flac:"audio/flac"},le="downloaded_file";class wt{botToken;fileMimeMap;constructor(){this.botToken=y.botToken,this.fileMimeMap=new Map(Object.entries(K))}getExtension(e){const t=e.split(".");return t.length>1?t.pop().toLowerCase():""}extractFileName(e,t){if(e){const s=/filename="([^"]+)"|filename=([^;]+)/,r=e.match(s);if(r)return(r[1]||r[2]).trim()}try{const r=new URL(t).pathname.split("/").pop();if(r)return r}catch{}return le}isBinaryApplicationMime(e){if(!e||typeof e!="string")return!0;const t=e.split(";")[0].trim().toLowerCase();if(!t.startsWith("application/"))return!0;const s=t.slice(12),r=new Set(["json","ld+json","activity+json","problem+json","json-seq","javascript","ecmascript","xml","xhtml+xml","rss+xml","atom+xml","x-www-form-urlencoded","graphql","graphql+json","hal+json","xml-dtd"]),n=new Set(["octet-stream","pdf","zip","x-7z-compressed","x-rar-compressed","x-tar","gzip","x-gzip","x-bzip2","x-xz","x-msdownload","x-shockwave-flash","wasm","x-iso9660-image","postscript"]);if(r.has(s))return!1;if(n.has(s))return!0;if(s.includes("+")){const a=s.split("+").pop();if(a&&["json","xml","javascript","ecmascript","xhtml+xml"].includes(a))return!1;if(a&&["zip","gzip","tar","pdf","wasm","octet-stream"].includes(a))return!0}return!s.startsWith("vnd.")}async downloadAndEncode(e,t){const s=await _.getFile(e);if(!s.ok||!s.data.file_path)throw new f(`获取文件路径失败: ${e}`,"TELEGRAM_API_ERROR");const r=`https://api.telegram.org/file/bot${this.botToken}/${s.data.file_path}`;try{const n=await fetch(r,{method:"GET",redirect:"follow"});if(!n.ok)throw new f(`文件下载失败: ${n.statusText} (${n.status})`);const a=await n.arrayBuffer(),i=a.byteLength,l=i>=1048576?`${(i/1048576).toFixed(2)} MB`:`${(i/1024).toFixed(2)} KB`;o.info(`文件下载成功 (${l})`);let d=t;const u=n.headers.get("content-disposition"),p=this.extractFileName(u,r);if(p!==le){const g=this.getExtension(p);g&&this.fileMimeMap.get(g)&&(d=this.fileMimeMap.get(g)||t,o.info(`修正 MIME 类型: ${t} -> ${d} (基于扩展名 .${g})`))}return{data:Buffer.from(a).toString("base64"),mimeType:d}}catch(n){const a=n instanceof Error?n.message:String(n);throw o.error(`下载文件失败: ${r}`,{err:n}),new f(a,"FILE_DOWNLOAD_ERROR")}}async handleImage(e){return this.downloadAndEncode(e.file_id,"image/jpeg")}async handleVideo(e){const{file_id:t,mime_type:s}=e,r=s&&A.VIDEO_TYPES.includes(s.split("/")[1])?s:"video/mp4";return this.downloadAndEncode(t,r)}async handleAudio(e,t){const{file_id:s,mime_type:r}=e,n=r&&A.AUDIO_TYPES.includes(r.split("/")[1])?r:t;return this.downloadAndEncode(s,n)}async handleDocument(e){const{file_id:t,mime_type:s,file_name:r}=e;let n=s;if(r){const d=this.getExtension(r);d&&K[d]&&(n=K[d],o.info(`通过后缀推断文档 MIME: ${n}`))}if(!n)throw new f(`无法确定文件类型: ${r||"未知文件名"}`,"FILE_TYPE_NOT_SUPPORTED");if(n==="image/gif")return o.info("检测到 GIF，转为 video/mp4 处理"),this.downloadAndEncode(t,"video/mp4");const[a,i]=n.split("/");let l;switch(a){case"text":l=n;break;case"application":A.APPLICATION_TYPES.includes(i)?l=n:this.isBinaryApplicationMime(n)||(o.info(`非二进制 application 类型 "${n}" -> 视为 text/plain`),l="text/plain");break;case"image":l=A.IMAGE_TYPES.includes(i)?n:"image/jpeg";break;case"video":l=A.VIDEO_TYPES.includes(i)?n:"video/mp4";break;case"audio":l=A.AUDIO_TYPES.includes(i)?n:"audio/mp3";break}if(!l)throw new f(`不支持的文件类型: ${n}`,"FILE_TYPE_NOT_SUPPORTED");return this.downloadAndEncode(t,l)}async handle(e){const{document:t,photo:s,video:r,audio:n,voice:a}=e;if(s&&s.length>0)return this.handleImage(s[s.length-1]);if(r)return this.handleVideo(r);if(n)return this.handleAudio(n,"audio/mp3");if(a)return this.handleAudio(a,"audio/ogg");if(t)return this.handleDocument(t)}}const ye=new wt,V=c=>!!(c&&(c.document||c.photo||c.video||c.audio||c.voice)),G=async(c,e,t,s)=>{let r;return t&&(r=await _.editMessageText(c,t,e,s),r.ok)?t:(r=await _.sendMessage(c,e,s),r.ok?r.messageId:t)};class Et{botName;adminId;constructor(){this.botName=y.botName,this.adminId=y.adminId}async extractMessageParts(e){const t=[];let s=e.text||e.caption||"";if(s=s.replace(new RegExp(`(@${this.botName})`,"gi"),"").replace(/(:ask)/gi,"").trim(),(s.includes("🤖 模型：")||s.includes("✨ 本次任务"))&&(s=s.replace(/^🤖 模型：.*?\n+/g,"").replace(/✨ API 调用[\s\S]*$/m,"").trim()),V(e)){const r=await ye.handle(e);r&&t.push({inlineData:r}),s||(e.document?s="分析这个文件":e.photo?s="分析这张图片":e.video&&(s="分析这个视频"))}return s&&t.push({text:s}),t}async handleRateLimiting(e){const{chatId:t,userId:s,userMessageId:r}=e,n=Ye.check(t);if(!n.canProceed&&s!==this.adminId){o.warn(`Rate limit exceeded for chat ${t}. Retry after ${n.retryAfterSeconds} seconds.`);const a=await G(t,`超出速率限制，请等待 ${n.retryAfterSeconds} 秒后重试。`,e.initMessageId,{replyToMessageId:r});return e.initMessageId=a,S.deleteMessage(t,a,n.retryAfterSeconds*1e3),!0}return!1}async updateFileUploadMessage(e){(V(e.message)||V(e.replyToMessage))&&(e.initMessageId=await G(e.chatId,"📄 File uploading...",e.initMessageId,{replyToMessageId:e.userMessageId}))}async buildCompleteContents(e){const{chatId:t,userId:s,message:r,quote:n,replyToMessage:a}=e,l=[...B.get(t,s)],d={...r};if(n?.text){const p=`${n.text.replace(/^/gm,"> ")}

${r.text||r.caption||""}`;d.text=p}if(a){const p=await this.extractMessageParts(a);if(p.length>0){const m=a.from?.username===this.botName?"model":"user";l.push({role:m,parts:p})}}const u=await this.extractMessageParts(d);return u.length>0&&l.push({role:"user",parts:u}),l}async updateThinkingMessage(e){e.initMessageId=await G(e.chatId,"✨ Thinking...",e.initMessageId,{replyToMessageId:e.userMessageId})}async processGeminiResponse(e,t,s){const r=t.text,n=await et(e.chatId,e.initMessageId,e.userMessageId,r);if(!n.ok)throw n.error;s.push(t.candidates?.[0]?.content),B.update(e.chatId,e.userId,s)}async handle(e){const{chat:t,from:s,message_id:r,reply_to_message:n,quote:a}=e,i={chatId:t.id,userId:s?.id,userMessageId:r,message:e,replyToMessage:n,quote:a,initMessageId:void 0};if(!await this.handleRateLimiting(i))try{await this.updateFileUploadMessage(i);const l=await this.buildCompleteContents(i);if(l.length===0){const u="未能从消息中提取到有效内容，请检查消息格式。";i.initMessageId=await G(i.chatId,u,i.initMessageId,{replyToMessageId:i.userMessageId}),S.deleteMessage(i.chatId,i.initMessageId,180*1e3);return}await this.updateThinkingMessage(i);const d=await ut.handle({chatId:i.chatId,userMessageId:i.userMessageId,statusMessageId:i.initMessageId},l);await this.processGeminiResponse(i,d,l)}catch(l){throw o.error("Error during Gemini API call or response processing.",{err:l,chatId:i.chatId,messageId:i.userMessageId}),i.initMessageId&&await _.deleteMessage(i.chatId,i.initMessageId),l}}}const J=new Et;class bt{parseCommand(e){const t=e.text||e.caption||"",r=(e.entities||e.caption_entities||[]).find(l=>l.type==="bot_command");if(!r||!t)return o.warn("尝试处理命令，但未发现有效的 bot_command 实体或文本",{messageId:e.message_id}),null;const n=t.substring(r.offset,r.offset+r.length),a=n.slice(1).split("@")[0].trim(),i=t.replace(n,"").trim();return{commandName:a,cleanText:i}}async handle(e){const{message_id:t,from:s,chat:r}=e,n=s?.id;if(!n){o.warn("收到匿名或无效来源的命令，忽略执行",{messageId:t});return}o.info("Handling command message...",{chatId:r.id,messageId:t,userId:n});const a=this.parseCommand(e);if(!a)return;const{commandName:i,cleanText:l}=a,d=H.map(p=>({command:p.name,description:p.description}));_.setBotCommands(r.id,n,d);const u=H.find(p=>p.name===i);if(u){o.info(`执行命令: /${i}`,{cleanText:l});try{await u.action(r.id,n,t,{cleanText:l,message:e})}catch(p){throw o.error(`执行命令 /${i} 时发生错误`,{err:p,messageId:t}),p}}else o.info(`未找到命令: /${i}`)}}const kt=new bt;class xt{botName;compiledFaqs=[];constructor(){this.botName=y.botName,this.initFaqData()}initFaqData(){try{this.compiledFaqs=yt.map(e=>({original:e,keywordGroups:e.keywordGroups.map(t=>t.map(s=>new RegExp(s,"ims"))),excludeGroups:e.excludeKeywords?e.excludeKeywords.map(t=>t.map(s=>new RegExp(s,"ims"))):null})),o.info(`FAQ 数据加载完成，共预编译 ${this.compiledFaqs.length} 条规则。`)}catch(e){o.error("FAQ 数据预编译失败，请检查正则表达式语法。",{err:e})}}matchAndGroup(e,t){const s=[];for(const r of e){const n=r.exec(t);if(!n)return null;s.push(n[0])}return s}findFaqMatch(e){for(const t of this.compiledFaqs){let s=null;for(const r of t.keywordGroups)if(s=this.matchAndGroup(r,e),s)break;if(s&&!(t.excludeGroups&&t.excludeGroups.some(n=>n.every(a=>a.test(e)))))return{matchedFaq:t.original,matches:s}}return null}async handleCommandAlias(e){const t=e.text||e.caption||"";if(!t.startsWith(":"))return!1;const[s,...r]=t.replace(":","").split(/\s+/);if(s==="ask")return await J.handle(e),!0;const n=H.find(a=>a.name===s||a.name===`script_${s}`||a.name===`gen_${s}`);if(n){const a=r.join(" ").trim();return o.info(`Handling command alias: ${s}`,{chatId:e.chat.id}),await n.action(e.chat.id,e.from.id,e.message_id,{cleanText:a,message:e}),!0}return!1}async handleReplyToBot(e){const{reply_to_message:t}=e;return t&&t.from?.username===this.botName?(await J.handle(e),!0):!1}async handleKeywordReply(e){const{chat:t,message_id:s,photo:r,document:n}=e;let a=e.text||e.caption||"";if(r||n?.mime_type?.startsWith("image/")&&!n.mime_type.endsWith("gif"))try{const l=await ye.handle(e);if(l){const d=await ge.handle(l);d&&(a+=`

<image>
${d.replace(/\s/g,"")}
</image>`,o.info("OCR 识别成功，文本已追加用于匹配。",{recognizedText:d.replace(/\s/g,"").slice(0,100)}))}}catch(l){o.warn("OCR 处理失败，将仅使用原始文本匹配。",{err:l})}const i=this.findFaqMatch(a);return i?(o.info("FAQ 匹配成功",{chatId:t.id,matchedTexts:i.matches}),await S.sendTempMessage(t.id,v(i.matchedFaq.answer),300*1e3,{replyToMessageId:s,parseMode:"HTML"}),!0):!1}async handle(e){const{chat:t,message_id:s}=e;o.info("Handling normal message.",{chatId:t.id,messageId:s}),!await this.handleCommandAlias(e)&&(await this.handleReplyToBot(e)||await this.handleKeywordReply(e))}}const St=new xt;class It{botName;allowGroups;constructor(){this.botName=y.botName,this.allowGroups=y.allowGroups}async handle(e){const{update_id:t,message:s,callback_query:r}=e;if(s?.sticker||(o.info("Handling Telegram update",{update:Ct(e)}),!s&&!r))return;const n=s||r?.message;if(!n){o.warn("No message or callback_query message found in update",{updateId:t});return}try{if(!this.validateChatType(n)||!await this.validateGroupPermission(n))return;await this.dispatch(n,r)}catch(a){this.handleError(a,n,t)}}validateChatType(e){const{chat:t,message_id:s}=e;return["group","supergroup"].includes(t.type)?!0:(S.sendTempMessage(t.id,"不支持私聊与频道，请在群组内使用此机器人。",3*6e4,{relatedMessageIds:[s]}),!1)}async validateGroupPermission(e){const{chat:t}=e;return this.allowGroups.includes(t.id)?!0:(await _.sendMessage(t.id,"群组未授权！"),await P(3e3),_.leaveChat(t.id),!1)}async dispatch(e,t){if(t?.data)return await Tt.handle(t);const s=e.text||e.caption||"",r=e.entities||e.caption_entities||[];return r.length>0&&this.isBotMentioned(s,r)?await J.handle(e):r.length>0&&this.isBotCommand(s,r)?await kt.handle(e):await St.handle(e)}isBotMentioned(e,t){for(const s of t)if((s.type==="mention"||s.type==="text_mention")&&e.substring(s.offset,s.offset+s.length)===`@${this.botName}`)return!0;return!1}isBotCommand(e,t){for(const s of t)if(s.type==="bot_command"){const r=e.substring(s.offset,s.offset+s.length),n=r.indexOf("@");if(n!==-1&&r.slice(n+1)===this.botName)return!0}return!1}handleError(e,t,s){const{chat:r,message_id:n}=t,a=e instanceof f?e.message:String(e);o.error("Error while handling update",{err:e,updateId:s}),He(e,`Error while handling update ${JSON.stringify({chatId:r.id,messageId:n})}`);const i=`<blockquote expandable>${b.html(te(`❌ ${a}`))}</blockquote>`;S.sendTempMessage(r.id,i,3*6e4,{replyToMessageId:n,parseMode:"HTML"})}}const Rt=new It,F=c=>{if(!c)return;const e=s=>s?s.length>20?`${s.slice(0,20)}...`:s:void 0,t=s=>s?.filter(r=>["text_mention","mention","bot_command"].includes(r.type));return c.text=e(c.text),c.caption=e(c.caption),c.entities=t(c.entities),c.caption_entities=t(c.caption_entities),c.photo=c.photo?[c.photo[c.photo.length-1]]:void 0,c.reply_to_message=F(c.reply_to_message),c.reply_markup=c.reply_markup?.inline_keyboard?{inline_keyboard:[c.reply_markup.inline_keyboard[0]]}:void 0,c},Ct=c=>{const e=Y(c);return e.message&&(e.message=F(e.message)),e.edited_message&&(e.edited_message=F(e.edited_message)),e.callback_query?.message&&(e.callback_query.message=F(e.callback_query.message)),e},Mt={type:"object",properties:{"content-type":{type:"string",const:"application/json"},"x-telegram-bot-api-secret-token":{type:"string"}},required:["content-type","x-telegram-bot-api-secret-token"],additionalProperties:!0},At={type:"object",properties:{update_id:{type:"number"}},required:["update_id"],additionalProperties:!0},Nt={body:At,headers:Mt},Lt=(c,e)=>{try{const t=Buffer.from(c),s=Buffer.from(e);return t.length===s.length&&Me.timingSafeEqual(t,s)}catch{return!1}},Ot=c=>{c.get("/",async(e,t)=>t.code(200).type("application/json").send({code:200,message:"It's worked"})),c.post("/webhook",{schema:Nt,preHandler:async(e,t)=>{const s={...e.headers,"x-telegram-bot-api-secret-token":"***"};o.info("Webhook Request Headers",{headers:s});const r=e.headers["x-telegram-bot-api-secret-token"],n=Array.isArray(r)?r[0]:r||"";if(!Lt(n,y.secretToken))return o.warn("Unauthorized webhook access attempt",{clientIp:e.headers["x-real-ip"],userAgent:e.headers["user-agent"]}),t.code(401).type("application/json").send({code:401,message:"Bad Credentials"})},handler:async(e,t)=>{o.info("Webhook Verification successful");const s=e.body;return Rt.handle(s).catch(r=>{o.error("Error handling update asynchronously",{err:r})}),t.code(202).type("application/json").send({code:202,message:"OK"})}}),c.setNotFoundHandler(async(e,t)=>t.code(404).type("application/json").send({code:404,message:"Not Found"}))},vt=c=>{const e=c.ip;return e==="127.0.0.1"||e==="::1"||e==="localhost"},$t=c=>{c.all("/gemini/*",async(e,t)=>{if(!vt(e))return o.warn(`🚫 拒绝外部访问代理: ${e.ip}`),t.code(403).send({error:"Forbidden: Local Access Only"});try{const s=e.url.replace(/^\/gemini/,""),r=new URL(s,y.geminiApiBaseUrl),n=new Headers,a=e.headers;for(const[p,m]of Object.entries(a))m&&n.set(p,m);n.delete("host"),n.delete("connection"),n.delete("content-length"),n.delete("transfer-encoding");const i=me.nextKey();n.set("x-goog-api-key",i),r.searchParams.has("key")&&r.searchParams.set("key",i);const l=e.body&&typeof e.body=="object"?JSON.stringify(e.body):e.body;o.info(`🔄 代理转发 -> Google | Key: ${i.substring(0,5)}...${i.substring(i.length-5)} | Path: ${r.pathname}`);const d=await fetch(r.toString(),{method:e.method,headers:n,body:l,redirect:"follow"});t.code(d.status),d.headers.forEach((p,m)=>{["content-encoding","content-length","transfer-encoding"].includes(m)||t.header(m,p)});const u=await d.arrayBuffer();return t.send(Buffer.from(u))}catch(s){return o.error("❌ Gemini Proxy Error",{err:s}),t.code(502).send({error:"Bad Gateway",message:s instanceof Error?s.message:String(s)})}})},Pt=()=>{const{loggerLevel:c}=y;o.init({loggerLevel:c});const e=Ae({logger:{level:"trace",stream:o.stream},disableRequestLogging:!1,trustProxy:!0,bodyLimit:10485760,connectionTimeout:6e4});return e.register(Ot),y.enableKeyRotation&&e.register($t),e.setErrorHandler((t,s,r)=>{let n=500,a="Internal Server Error",i="InternalServerError";typeof t=="object"&&t!==null&&"statusCode"in t&&(n=t.statusCode),t instanceof Error?(a=t.message,i=t.name):typeof t=="string"&&(a=t),n>=500&&(o.error(a,{err:t}),a="Internal Server Error"),r.code(n).send({code:n,error:i,message:a})}),e},Dt=async()=>{const{listenHost:c,listenPort:e}=y,t=Pt();let s=!1;const r=async n=>{if(s){o.warn(`系统信号 ${n} 被忽略，服务器正在关闭中...`);return}s=!0,o.info(`收到系统信号 ${n}，正在优雅关闭服务器...`);try{await _.deleteWebhook(),await ge.destroy(),B.close(),S.close(),await t.close(),o.info("🚀 服务器已安全关闭 (Graceful Shutdown Completed)"),process.exit(0)}catch(a){o.error("服务器关闭过程中发生错误",{err:a}),process.exit(1)}};process.on("SIGINT",()=>r("SIGINT")),process.on("SIGTERM",()=>r("SIGTERM"));try{const n=Number(e);await t.listen({port:n,host:c});const a=t.server.address();if(a&&typeof a=="object"){const l=`http://${a.address==="::"||a.address==="0.0.0.0"?"127.0.0.1":a.address}:${a.port}`;o.info("🚀 Server ready",{url:l,pid:process.pid})}else o.info(`🚀 Server ready, listening on ${c}:${e}`);await _.setWebhook(y.webhookUrl,y.secretToken)}catch(n){o.fatal("Server startup failed",{err:n}),process.exit(1)}};process.on("unhandledRejection",c=>{o.error("Unhandled Rejection:",{err:c}),process.exit(1)});Dt();
//# sourceMappingURL=index.js.map
