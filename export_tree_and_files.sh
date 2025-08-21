#!/usr/bin/env bash
set -euo pipefail

# ===== 默认配置（可编辑） =====
OUTPUT="tree_and_files.md"
EXCLUDE_DIRS=(".vscode" "draft" "dist" "node_modules" ".roo" ".git" "api" ".vercel" "resources")
EXCLUDE_FILES=("export_tree_and_files.sh" "pnpm-lock.yaml" "tree_and_files.md" ".env*")

usage() {
  cat <<EOF
Usage: $0 [-o output.md] [--exclude-dir dir1,dir2] [--exclude-file pat1,pat2]
EOF
  exit 1
}

# 参数解析（简单）
while [[ $# -gt 0 ]]; do
  case $1 in
  -o | --output)
    OUTPUT="$2"
    shift 2
    ;;
  --exclude-dir)
    IFS=',' read -r -a EXCLUDE_DIRS <<<"$2"
    shift 2
    ;;
  --exclude-file)
    IFS=',' read -r -a EXCLUDE_FILES <<<"$2"
    shift 2
    ;;
  -h | --help) usage ;;
  *) usage ;;
  esac
done

# helper join
_join() {
  local IFS="$1"
  shift
  echo "$*"
}

# 真实路径
OUTPUT_REALPATH="$(realpath "$OUTPUT")"

# 写 header
: >"$OUTPUT"
{
  echo "# 目录树与文件内容"
  echo ""
  echo "_生成时间: $(date -R)_"
  echo ""
} >>"$OUTPUT"

# 构造 find 的 prune 参数（不用额外的 "./dir/*"，只 prune 目录本身即可）
prune_args=()
for d in "${EXCLUDE_DIRS[@]}"; do
  [ -z "$d" ] && continue
  prune_args+=(-path "./$d" -prune -o)
done

# 构造文件名排除参数（数组形式，避免 shell glob 展开）
exclude_file_args=()
for p in "${EXCLUDE_FILES[@]}"; do
  [ -z "$p" ] && continue
  exclude_file_args+=(! -name "$p")
done

# 1) 生成目录树：优先用 tree，否则用 find 回退
echo "生成目录树到 $OUTPUT ..."
# tree -I 需要用 '|' 分隔的模式串
combine_ignore=()
for d in "${EXCLUDE_DIRS[@]}"; do [ -n "$d" ] && combine_ignore+=("$d"); done
for f in "${EXCLUDE_FILES[@]}"; do [ -n "$f" ] && combine_ignore+=("$f"); done
tree_ignore=""
if [ ${#combine_ignore[@]} -gt 0 ] && command -v tree >/dev/null 2>&1; then
  tree_ignore="$(_join '|' "${combine_ignore[@]}")"
fi

if command -v tree >/dev/null 2>&1 && [ -n "$tree_ignore" ]; then
  tree -a -I "$tree_ignore" --noreport . >>"$OUTPUT" 2>/dev/null || tree -a --noreport . >>"$OUTPUT"
elif command -v tree >/dev/null 2>&1; then
  tree -a --noreport . >>"$OUTPUT"
else
  # 用 find + sort 回退
  if [ ${#prune_args[@]} -gt 0 ]; then
    find . "${prune_args[@]}" -print | sort | while IFS= read -r path; do
      rel="${path#./}"
      [ -z "$rel" ] && rel="."
      if [ "$rel" = "." ]; then
        echo "./" >>"$OUTPUT"
        continue
      fi
      depth=$(($(awk -F"/" '{print NF-1}' <<<"$rel")))
      indent=$(printf '    %.0s' $(seq 1 $depth 2>/dev/null))
      if [ -d "$path" ]; then
        echo "${indent}${rel}/" >>"$OUTPUT"
      else
        echo "${indent}${rel}" >>"$OUTPUT"
      fi
    done
  else
    find . -print | sort | while IFS= read -r path; do
      rel="${path#./}"
      [ -z "$rel" ] && rel="."
      if [ "$rel" = "." ]; then
        echo "./" >>"$OUTPUT"
        continue
      fi
      depth=$(($(awk -F"/" '{print NF-1}' <<<"$rel")))
      indent=$(printf '    %.0s' $(seq 1 $depth 2>/dev/null))
      if [ -d "$path" ]; then
        echo "${indent}${rel}/" >>"$OUTPUT"
      else
        echo "${indent}${rel}" >>"$OUTPUT"
      fi
    done
  fi
fi

{
  echo ""
  echo "----"
  echo ""
} >>"$OUTPUT"

# 2) 收集文件内容（使用数组参数，-print0 安全处理空格）
echo "收集文件并写入内容（只包含文本类型）..."
if [ ${#prune_args[@]} -gt 0 ]; then
  find . "${prune_args[@]}" -type f "${exclude_file_args[@]}" -print0
else
  find . -type f "${exclude_file_args[@]}" -print0
fi | while IFS= read -r -d '' file; do
  # 跳过输出文件本身
  [ "$(realpath "$file")" = "$OUTPUT_REALPATH" ] && continue

  # 判断是否为文本
  is_text=1
  mimetype=""
  if command -v file >/dev/null 2>&1; then
    mimetype=$(file -b --mime-type "$file" 2>/dev/null || echo "application/octet-stream")
    case "$mimetype" in
    text/* | application/json | application/xml | application/javascript | application/xhtml+xml) is_text=1 ;;
    *) is_text=0 ;;
    esac
  else
    case "${file##*.}" in
    txt | md | js | ts | json | yaml | yml | py | sh | html | css | xml | go | rs | java | c | cpp | h) is_text=1 ;;
    *) is_text=0 ;;
    esac
  fi

  echo "## \`$file\`" >>"$OUTPUT"
  echo "" >>"$OUTPUT"
  if [ "$is_text" -eq 1 ]; then
    ext="${file##*.}"
    case "$ext" in
    js) lang="javascript" ;;
    ts) lang="typescript" ;;
    sh) lang="bash" ;;
    py) lang="python" ;;
    md | txt) lang="" ;;
    json) lang="json" ;;
    yml | yaml) lang="yaml" ;;
    html) lang="html" ;;
    css) lang="css" ;;
    *) lang="" ;;
    esac

    if [ -n "$lang" ]; then
      echo '```'${lang} >>"$OUTPUT"
    else
      echo '```' >>"$OUTPUT"
    fi

    cat "$file" >>"$OUTPUT" || true
    echo '```' >>"$OUTPUT"
    echo "" >>"$OUTPUT"
  else
    echo "_已跳过（检测为二进制或非文本文件：${mimetype:-unknown})_" >>"$OUTPUT"
    echo "" >>"$OUTPUT"
  fi
done

echo "完成：输出文件 $OUTPUT"
