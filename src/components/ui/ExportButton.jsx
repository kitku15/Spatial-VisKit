export default function ExportButton({ onClick, title = "Export Image" }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="absolute top-2 right-2 z-50 bg-panel text-textMuted hover:text-primary border border-borderMain hover:border-primary shadow-sm rounded p-1.5 transition-colors group"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
      {/* Tooltip on hover */}
      <span className="absolute hidden group-hover:block top-full mt-2 right-0 w-max bg-gray-800 text-white text-xs py-1 px-2 rounded">
        {title}
      </span>
    </button>
  );
}
