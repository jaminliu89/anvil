// 极简 markdown → HTML 渲染器（不自带 XSS 防护）
// 覆盖：代码块/行内代码/粗斜体/列表/标题/链接/引用/分隔线/段落

function escape(html: string): string {
  return html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function markdownToHtml(text: string): string {
  let html = escape(text)

  // 代码块（```...```）
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code${lang ? ` class="lang-${lang}"` : ''}>${code.trim()}</code></pre>`
  )

  // 行内代码 `...`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // 粗体 **...**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

  // 斜体 *...*（不抢粗体）
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')

  // 链接 [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')

  // 自动链接裸 URL
  html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')

  // 图片 ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')

  // 分隔线
  html = html.replace(/^---+$/gm, '<hr>')

  // 标题
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')

  // 引用
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')

  // 无序列表
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')

  // 有序列表
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
  // 已经替换过 <li> 了，需区分有序列表
  // 使用更精确的方式：先替换有序数字
  html = html.replace(/<li>(.*?)<\/li>/g, (match) => {
    // 不做特殊处理，交给上面的 ul 包裹
    return match
  })

  // 段落（连续非空行）
  const lines = html.split('\n')
  const result: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // 块级元素原样保留
    if (trimmed.startsWith('<pre>') || trimmed.startsWith('</pre>') ||
        trimmed.startsWith('<ul>') || trimmed.startsWith('</ul>') ||
        trimmed.startsWith('<h') || trimmed.startsWith('</h') ||
        trimmed.startsWith('<hr') ||
        trimmed.startsWith('<blockquote>') || trimmed.startsWith('</blockquote>')) {
      result.push(line)
      continue
    }

    // 列表项
    if (trimmed.startsWith('<li>')) {
      result.push(line)
      continue
    }

    // 空行 = 段落分隔
    if (!trimmed) {
      result.push('')
      continue
    }

    // 普通行 = 段落
    result.push(`<p>${line}</p>`)
  }

  // 合并连续的 </blockquote><blockquote>
  // 修复连续引用块

  html = result.join('\n')

  // 清理空 <p></p>
  html = html.replace(/<p>\s*<\/p>/g, '')

  return html
}