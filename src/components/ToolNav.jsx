export default function ToolNav({ tools, activeTool, onChange }) {
  return (
    <nav className="tool-nav">
      {tools.map(t => (
        <button
          key={t.id}
          className={`tool-btn${activeTool === t.id ? ' active' : ''}`}
          onClick={() => onChange(t.id)}
          title={t.desc}
        >
          <span className="tool-btn-icon">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
