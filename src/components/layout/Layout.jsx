import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { APP_MODE, PROJECT_TITLE } from "../../config/config";

const exploreLinks = [
  {
    to: `/interactive${window.location.search}`,
    label: "Interactive Explorer",
  },
  { to: `/annotation${window.location.search}`, label: "Cell Type Annotation" },
  {
    to: `/composition${window.location.search}`,
    label: "Composition Analysis",
  },
  { to: `/multiplex${window.location.search}`, label: "Multiplex Overlay" },
  { to: `/export${window.location.search}`, label: "Data Export & Filtering" },
];

const analysisLinks = [
  { to: `/qc${window.location.search}`, label: "Quality Control" },
  { to: `/stats${window.location.search}`, label: "Spatial Statistics" },
  {
    to: `/tf${window.location.search}`,
    label: "Transcription Factor Enrichment",
  },
  { to: `/ccc${window.location.search}`, label: "Cell-Cell Communication" },
  { to: `/spatial-ccc${window.location.search}`, label: "Spatial CCC" },
  {
    to: `/de-analysis${window.location.search}`,
    label: "Cell Type DE Analysis",
  },
  {
    to: `/conditions-de${window.location.search}`,
    label: "Conditions DE Analysis",
  },
  { to: `/gsea${window.location.search}`, label: "GSEA" },
  {
    to: `/conditions-causal${window.location.search}`,
    label: "Conditions CCC",
  },
];

export default function Layout({
  children,
  availableN,
  availableR,
  availableEmbeddings,
  selectedN,
  setSelectedN,
  selectedR,
  selectedEmbedding,
  setSelectedEmbedding,
  setSelectedR,
  handleRefresh,
  sidebarOpen,
  setSidebarOpen,
  needsUpdate,
}) {
  const isFullMode = APP_MODE === "full";

  const navItemBase =
    "block w-full text-left px-4 py-2 text-sm transition-colors border-l-4 ";
  const activeNav =
    navItemBase + "bg-primary-light text-primary-dark border-primary font-bold";
  const inactiveNav =
    navItemBase +
    "text-textMain border-transparent hover:bg-borderLight hover:border-borderMain font-medium";
  const disabledNav =
    navItemBase +
    "text-textMuted border-transparent opacity-50 cursor-not-allowed font-medium flex justify-between items-center";

  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 250);
    return () => clearTimeout(timer);
  }, [sidebarOpen]);

  return (
    <div className="flex flex-col h-screen bg-app">
      <header className="bg-header text-3xl p-3 flex items-center gap-4 text-textInverse font-semibold shrink-0">
        <button
          onClick={() => setSidebarOpen((prev) => !prev)}
          className="text-2xl flex items-center justify-center w-10 h-10 rounded hover:bg-primary transition-colors focus:outline-none cursor-pointer"
          title="Toggle Sidebar"
        >
          ☰
        </button>
        <span>{PROJECT_TITLE}</span>
        {!isFullMode && (
          <span className="ml-auto text-sm font-bold bg-primary px-3 py-1 rounded">
            Lite Mode
          </span>
        )}
      </header>

      <main className="flex-1 overflow-hidden flex">
        <aside
          className={`bg-sidebar border-r border-borderMain flex flex-col transition-all duration-200 shrink-0 ${
            sidebarOpen ? "w-72" : "w-0 overflow-hidden border-none"
          }`}
        >
          <div className="p-4 bg-borderLight flex justify-center border-b border-borderMain shrink-0">
            <img
              src="/logo_hor.svg"
              alt="Project Logo"
              className="h-10 w-auto"
            />
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col py-2">
            <div className="mb-4">
              <h3 className="px-4 text-xs font-extrabold text-textMuted uppercase tracking-wider mb-2">
                Explore
              </h3>
              <nav className="flex flex-col">
                {exploreLinks.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                      isActive ? activeNav : inactiveNav
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
              </nav>
            </div>

            <div className="mb-4">
              <h3 className="px-4 text-xs font-extrabold text-textMuted uppercase tracking-wider mb-2">
                Analysis Outputs
              </h3>
              <nav className="flex flex-col">
                {analysisLinks.map((link) => {
                  if (!isFullMode) {
                    return (
                      <div
                        key={link.to}
                        className={disabledNav}
                        title="Requires Full Pipeline Output"
                      >
                        {link.label}
                        <span className="text-[10px] bg-borderMain text-textInverse px-1.5 py-0.5 rounded font-bold tracking-wide">
                          LOCKED
                        </span>
                      </div>
                    );
                  }
                  return (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      className={({ isActive }) =>
                        isActive ? activeNav : inactiveNav
                      }
                    >
                      {link.label}
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            <div className="mx-4 border-t border-borderMain my-2"></div>

            <div className="p-4 pt-2">
              <h3 className="text-xs font-extrabold text-textMuted uppercase tracking-wider mb-4">
                Plot Settings
              </h3>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-textMain">
                    Colors
                  </label>
                  <NavLink
                    to="/colors"
                    className={({ isActive }) =>
                      isActive
                        ? "bg-primary-light text-primary-dark border border-primary px-3 py-2 rounded text-sm font-bold text-center shadow-sm"
                        : "bg-panel text-textMain border border-borderMain hover:border-primary hover:text-primary px-3 py-2 rounded text-sm font-semibold text-center shadow-sm transition-colors"
                    }
                  >
                    Edit Color Palette
                  </NavLink>
                </div>

                {isFullMode && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-textMain">
                      Neighbours (n)
                    </label>
                    <div className="bg-panel border border-borderMain rounded p-2 flex flex-col gap-1 shadow-sm">
                      {availableN.length === 0 && (
                        <span className="text-xs text-textMuted">
                          Scanning...
                        </span>
                      )}
                      {availableN.map((val) => (
                        <label
                          key={val}
                          className="flex items-center text-sm text-textMain cursor-pointer hover:text-primary transition-colors"
                        >
                          <input
                            type="radio"
                            name="n_val"
                            value={val}
                            checked={selectedN === String(val)}
                            onChange={(e) => setSelectedN(e.target.value)}
                            className="mr-2 accent-primary cursor-pointer"
                          />
                          {val}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {isFullMode && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-textMain">
                      Resolution (r)
                    </label>
                    <div className="bg-panel border border-borderMain rounded p-2 flex flex-col gap-1 shadow-sm">
                      {availableR.length === 0 && (
                        <span className="text-xs text-textMuted">
                          Scanning...
                        </span>
                      )}
                      {availableR.map((val) => (
                        <label
                          key={val}
                          className="flex items-center text-sm text-textMain cursor-pointer hover:text-primary transition-colors"
                        >
                          <input
                            type="radio"
                            name="r_val"
                            value={val}
                            checked={selectedR === String(val)}
                            onChange={(e) => setSelectedR(e.target.value)}
                            className="mr-2 accent-primary cursor-pointer"
                          />
                          {val}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-textMain">
                    Embedding
                  </label>
                  <div className="bg-panel border border-borderMain rounded p-2 flex flex-col gap-1 shadow-sm">
                    {availableEmbeddings.length === 0 && (
                      <span className="text-xs text-textMuted">
                        Scanning...
                      </span>
                    )}
                    {availableEmbeddings.map((val) => (
                      <label
                        key={val}
                        className="flex items-center text-sm text-textMain cursor-pointer hover:text-primary transition-colors"
                      >
                        <input
                          type="radio"
                          name="embedding_val"
                          value={val}
                          checked={selectedEmbedding === val}
                          onChange={(e) => setSelectedEmbedding(e.target.value)}
                          className="mr-2 accent-primary cursor-pointer"
                        />
                        {val}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-borderMain bg-sidebar shrink-0 flex flex-col gap-2 relative min-h-[90px] justify-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
            {needsUpdate && (
              <span className="text-xs text-warning-dark font-bold text-center animate-pulse">
                ⚠️ Please click to apply changes
              </span>
            )}
            <button
              onClick={handleRefresh}
              className={`w-full px-4 py-2.5 text-sm font-bold rounded shadow-sm transition-colors cursor-pointer ${
                needsUpdate
                  ? "bg-warning text-textInverse border border-warning-dark hover:bg-warning-dark shadow-md"
                  : "bg-success-light text-success-dark border border-success hover:bg-success hover:text-textInverse"
              }`}
            >
              Update Plot
            </button>
          </div>
        </aside>

        <div className="flex-1 bg-app overflow-hidden">{children}</div>
      </main>
    </div>
  );
}
