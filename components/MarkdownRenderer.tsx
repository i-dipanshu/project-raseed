import React from 'react';

interface MarkdownRendererProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ text, className = '', style = {} }) => {
  const renderMarkdown = (text: string) => {
    // Split text into lines for processing
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let currentParagraph: string[] = [];
    let listItems: string[] = [];
    let isInList = false;

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        const paragraphText = currentParagraph.join('\n');
        elements.push(
          <p key={elements.length} className="mb-3 leading-relaxed">
            {renderInlineMarkdown(paragraphText)}
          </p>
        );
        currentParagraph = [];
      }
    };

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={elements.length} className="mb-3 ml-4 list-disc space-y-1">
            {listItems.map((item, index) => (
              <li key={index}>{renderInlineMarkdown(item)}</li>
            ))}
          </ul>
        );
        listItems = [];
        isInList = false;
      }
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // Handle headers
      if (trimmedLine.startsWith('### ')) {
        flushParagraph();
        flushList();
        elements.push(
          <h3 key={elements.length} className="text-lg font-semibold mb-2 mt-4">
            {renderInlineMarkdown(trimmedLine.substring(4))}
          </h3>
        );
      } else if (trimmedLine.startsWith('## ')) {
        flushParagraph();
        flushList();
        elements.push(
          <h2 key={elements.length} className="text-xl font-semibold mb-3 mt-4">
            {renderInlineMarkdown(trimmedLine.substring(3))}
          </h2>
        );
      } else if (trimmedLine.startsWith('# ')) {
        flushParagraph();
        flushList();
        elements.push(
          <h1 key={elements.length} className="text-2xl font-bold mb-3 mt-4">
            {renderInlineMarkdown(trimmedLine.substring(2))}
          </h1>
        );
      }
      // Handle bullet points
      else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ') || trimmedLine.startsWith('* ')) {
        flushParagraph();
        isInList = true;
        listItems.push(trimmedLine.substring(2));
      }
      // Handle numbered lists
      else if (/^\d+\.\s/.test(trimmedLine)) {
        flushParagraph();
        if (!isInList || listItems.length === 0) {
          flushList();
          isInList = true;
        }
        listItems.push(trimmedLine.replace(/^\d+\.\s/, ''));
      }
      // Handle empty lines
      else if (trimmedLine === '') {
        if (isInList) {
          flushList();
        } else {
          flushParagraph();
        }
      }
      // Regular text
      else {
        if (isInList) {
          flushList();
        }
        currentParagraph.push(line);
      }
    });

    // Flush any remaining content
    flushParagraph();
    flushList();

    return elements;
  };

  const renderInlineMarkdown = (text: string): React.ReactNode => {
    // Handle bold text
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
    
    // Handle italic text
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    text = text.replace(/_(.*?)_/g, '<em>$1</em>');
    
    // Handle inline code
    text = text.replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>');

    // Handle rupee symbol formatting (make it more prominent)
    text = text.replace(/₹(\d+(?:,\d{3})*(?:\.\d{2})?)/g, '<span class="font-semibold text-green-600">₹$1</span>');

    return <span dangerouslySetInnerHTML={{ __html: text }} />;
  };

  return (
    <div className={`markdown-content ${className}`} style={style}>
      {renderMarkdown(text)}
    </div>
  );
};

export default MarkdownRenderer; 