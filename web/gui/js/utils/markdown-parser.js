/**
 * Parses raw Markdown text into safe HTML strings for presentation in the UI.
 * It handles headings, lists, bold/italic text, inline code, links, and escapes basic HTML tags to prevent XSS.
 * @param {string} rawText - The unformatted Markdown text to parse.
 * @returns {string} The parsed and sanitized HTML string.
 */
export function parseMarkdown(rawText) {
    if (!rawText) return '';

    // Escape input HTML tags to prevent cross-site scripting (XSS)
    let html = rawText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const lines = html.split(/\r?\n/);
    const result = [];
    let inList = false;
    let inParagraph = false;
    let currentParagraph = [];

    /**
     * Flushes the current paragraph lines, wraps them in a paragraph tag, and pushes to the result array.
     */
    const flushParagraph = () => {
        if (currentParagraph.length > 0) {
            result.push(`<p>${inlineFormatting(currentParagraph.join('<br>'))}</p>`);
            currentParagraph = [];
            inParagraph = false;
        }
    };

    /**
     * Closes the active unordered list tag and pushes to the result array.
     */
    const flushList = () => {
        if (inList) {
            result.push('</ul>');
            inList = false;
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Handle empty lines
        if (!trimmed) {
            flushParagraph();
            flushList();
            continue;
        }

        // Match headers (e.g. # Heading)
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            flushParagraph();
            flushList();
            const level = headingMatch[1].length;
            const content = inlineFormatting(headingMatch[2]);
            const headingTag = `h${Math.min(level + 1, 6)}`;
            result.push(`<${headingTag}>${content}</${headingTag}>`);
            continue;
        }

        // Match list items (e.g. - item or * item)
        const listMatch = trimmed.match(/^[-*]\s+(.*)$/);
        if (listMatch) {
            flushParagraph();
            if (!inList) {
                result.push('<ul>');
                inList = true;
            }
            result.push(`<li>${inlineFormatting(listMatch[1])}</li>`);
            continue;
        }

        // Normal text lines
        flushList();
        inParagraph = true;
        currentParagraph.push(line);
    }

    flushParagraph();
    flushList();

    return result.join('\n');
}

/**
 * Parses inline Markdown constructs (bold, italic, inline code, links) within a text block.
 * @param {string} text - The raw block text to format.
 * @returns {string} The HTML formatted text block containing inline styles.
 */
function inlineFormatting(text) {
    let result = text;

    // Bold text (**bold** or __bold__)
    result = result.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');

    // Italic text (*italic* or _italic_)
    result = result.replace(/(\*|_)(.*?)\1/g, '<em>$2</em>');

    // Inline code blocks (`code`)
    result = result.replace(/`(.*?)`/g, '<code>$1</code>');

    // Anchors/Hyperlinks [text](url)
    result = result.replace(/\[(.*?)\]\((.*?)\)/g, (match, linkText, url) => {
        // Prevent javascript: URLs and only allow HTTP/S or relative links
        const safeUrl = /^(https?:\/\/|\/|\.)/i.test(url) ? url : '#';
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
    });

    return result;
}
