# frozen_string_literal: true

module Jekyll
  module KeywordHighlighter
    def self.process(content, keywords)
      return content if content.nil?

      # 1. Obsidian standard highlight: ==text== -> <mark class="kw-marker">text</mark>
      code_and_highlight = /(```[a-zA-Z0-9_-]*\n[\s\S]*?```|`[^`\n]+`)|==([^=\n]+)==/
      content = content.gsub(code_and_highlight) do
        if $1
          $1
        else
          "<mark class=\"kw-marker\">#{$2}</mark>"
        end
      end

      # 2. Auto keywords from config
      return content if keywords.nil? || keywords.empty?

      keywords.each do |kw|
        text = kw.is_a?(Hash) ? kw['text'] : kw.to_s
        css_class = (kw.is_a?(Hash) && kw['class']) ? kw['class'] : 'kw-marker'
        next if text.nil? || text.strip.empty?

        # Protect code blocks, inline code, headings, spans, marks, images, links, and HTML tags
        pattern = /(```[a-zA-Z0-9_-]*\n[\s\S]*?```|`[^`\n]+`|^[\#]{1,6}\s+[^\n]*|<span\b[^>]*>[^<\n]*<\/span>|<mark\b[^>]*>[^<\n]*<\/mark>|!\[[^\]\n]*\]\([^\)\n]+\)|\[[^\]\n]+\]\([^\)\n]+\)|<[a-zA-Z\/][^>]*>)|(#{Regexp.escape(text)})/

        content = content.gsub(pattern) do
          if $1
            $1
          else
            "<mark class=\"#{css_class}\">#{$2}</mark>"
          end
        end
      end

      content
    end
  end
end

Jekyll::Hooks.register [:documents], :pre_render do |doc, payload|
  if doc.collection.label == 'posts'
    keywords = doc.site.config['highlight_keywords']
    doc.content = Jekyll::KeywordHighlighter.process(doc.content, keywords)
  end
end
