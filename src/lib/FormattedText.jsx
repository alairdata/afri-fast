import React from 'react';
import { Text, View } from 'react-native';

/**
 * Renders markdown-lite text:
 *   **bold**, *italic*, \n\n paragraphs, \n line breaks,
 *   lines starting with "- " or "• " as bullet points,
 *   lines starting with "### " / "## " / "# " as headers
 */
export default function FormattedText({ text, bodyStyle, paragraphSpacing = 12, colors }) {
  if (!text) return null;

  const textColor = bodyStyle?.color || (colors?.text) || '#1F1F1F';

  // Split into paragraphs first
  const paragraphs = text.split('\n\n').filter(p => p.trim());

  const renderInline = (str, baseStyle, key) => {
    // Split on **bold** and *italic* markers
    const parts = str.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return (
      <Text key={key} style={baseStyle}>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <Text key={i} style={{ fontWeight: '700' }}>{part.slice(2, -2)}</Text>;
          }
          if (part.startsWith('*') && part.endsWith('*')) {
            return <Text key={i} style={{ fontStyle: 'italic' }}>{part.slice(1, -1)}</Text>;
          }
          return part;
        })}
      </Text>
    );
  };

  const renderParagraph = (para, pi) => {
    const lines = para.split('\n').filter(l => l.trim());
    const marginTop = pi > 0 ? paragraphSpacing : 0;

    // Check if this paragraph is a header
    if (lines.length === 1) {
      const line = lines[0];
      if (line.startsWith('### ')) {
        return renderInline(line.slice(4), [bodyStyle, { fontWeight: '700', fontSize: (bodyStyle?.fontSize || 15) + 1, marginTop }], `h3-${pi}`);
      }
      if (line.startsWith('## ')) {
        return renderInline(line.slice(3), [bodyStyle, { fontWeight: '700', fontSize: (bodyStyle?.fontSize || 15) + 2, marginTop }], `h2-${pi}`);
      }
      if (line.startsWith('# ')) {
        return renderInline(line.slice(2), [bodyStyle, { fontWeight: '800', fontSize: (bodyStyle?.fontSize || 15) + 3, marginTop }], `h1-${pi}`);
      }
    }

    // Check if all lines are bullet points
    const allBullets = lines.every(l => l.startsWith('- ') || l.startsWith('• '));
    if (allBullets) {
      return (
        <View key={`bullets-${pi}`} style={{ marginTop }}>
          {lines.map((line, li) => {
            const content = line.startsWith('- ') ? line.slice(2) : line.slice(2);
            return (
              <View key={li} style={{ flexDirection: 'row', marginBottom: 4, alignItems: 'flex-start' }}>
                <Text style={[bodyStyle, { marginRight: 8, lineHeight: bodyStyle?.lineHeight || 22 }]}>•</Text>
                {renderInline(content, bodyStyle, `bl-${li}`)}
              </View>
            );
          })}
        </View>
      );
    }

    // Mixed lines — render each line, joining with implicit newlines
    return (
      <View key={`para-${pi}`} style={{ marginTop }}>
        {lines.map((line, li) => {
          if (line.startsWith('- ') || line.startsWith('• ')) {
            const content = line.slice(2);
            return (
              <View key={li} style={{ flexDirection: 'row', marginBottom: 4, alignItems: 'flex-start' }}>
                <Text style={[bodyStyle, { marginRight: 8 }]}>•</Text>
                {renderInline(content, bodyStyle, `ml-${li}`)}
              </View>
            );
          }
          return renderInline(line, [bodyStyle, li > 0 && { marginTop: 2 }], `line-${li}`);
        })}
      </View>
    );
  };

  return <>{paragraphs.map((para, pi) => renderParagraph(para, pi))}</>;
}
