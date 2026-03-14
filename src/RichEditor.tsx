import { useRef, useEffect } from 'react';

interface Props {
  value: string;
  onChange: (html: string) => void;
  onHeightChange?: (px: number) => void;
  placeholder?: string;
}

export default function RichEditor({ value, onChange, onHeightChange, placeholder }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // Only sync from outside on initial mount / external reset
  const lastValue = useRef(value);

  useEffect(() => {
    if (!ref.current) return;
    if (ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
      lastValue.current = value;
    }
    onHeightChange?.(ref.current.scrollHeight);
  }, [value]);

  const exec = (cmd: string, val?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, val ?? undefined);
    // execCommand doesn't fire onInput, so manually push update
    if (ref.current) {
      const html = ref.current.innerHTML;
      lastValue.current = html;
      onChange(html);
    }
  };

  const handleInput = () => {
    if (!ref.current) return;
    const html = ref.current.innerHTML;
    lastValue.current = html;
    onChange(html);
    onHeightChange?.(ref.current.scrollHeight);
  };

  return (
    <div className="editor-wrap">
      <div className="editor-toolbar">
        <button
          type="button"
          className="toolbar-btn"
          onMouseDown={e => { e.preventDefault(); exec('bold'); }}
          title="Bold (Ctrl+B)"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onMouseDown={e => { e.preventDefault(); exec('italic'); }}
          title="Italic (Ctrl+I)"
        >
          <em>I</em>
        </button>
        <div className="toolbar-sep" />
        <button
          type="button"
          className="toolbar-btn"
          onMouseDown={e => { e.preventDefault(); exec('insertUnorderedList'); }}
          title="Bullet List"
        >
          • List
        </button>
        <div className="toolbar-sep" />
        <button
          type="button"
          className="toolbar-btn"
          onMouseDown={e => { e.preventDefault(); exec('undo'); }}
          title="Undo"
        >
          ↩
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onMouseDown={e => { e.preventDefault(); exec('redo'); }}
          title="Redo"
        >
          ↪
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="editor-content"
        data-placeholder={placeholder ?? 'Type the schedule content here…'}
        onInput={handleInput}
        onKeyDown={e => {
          // Ensure Enter inside a list item creates a new bullet
          if (e.key === 'Enter' && !e.shiftKey) {
            // default behaviour is fine
          }
        }}
      />
    </div>
  );
}
