// Top-level App — wires routes + tweaks + theme

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "density": "balanced",
  "sidebarCollapsed": false,
  "showTraceColumns": true,
  "accent": "indigo"
}/*EDITMODE-END*/;

const ACCENTS = {
  indigo: { hue: 255 },
  teal:   { hue: 195 },
  emerald:{ hue: 155 },
  amber:  { hue: 75  },
  violet: { hue: 295 },
};

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = useState("repo");

  // theme + density on root
  useEffect(() => {
    document.documentElement.dataset.theme = t.theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.density = t.density;
    const hue = ACCENTS[t.accent]?.hue ?? 255;
    const dark = t.theme === "dark";
    document.documentElement.style.setProperty("--accent",     `oklch(${dark ? 0.7 : 0.55} 0.16 ${hue})`);
    document.documentElement.style.setProperty("--accent-soft",`oklch(${dark ? 0.28 : 0.96} ${dark ? 0.07 : 0.02} ${hue})`);
    document.documentElement.style.setProperty("--accent-ink", `oklch(${dark ? 0.78 : 0.42} ${dark ? 0.13 : 0.18} ${hue})`);
  }, [t.theme, t.density, t.accent]);

  const breadcrumbs = {
    repo:      [PROGRAM, "Documents"],
    document:  [PROGRAM, "CONOPS-S7", "Operational Scenarios"],
    schema:    [PROGRAM, "CONOPS-S7", "Schema"],
    trace:     [PROGRAM, "Trace links"],
    snapshots: [PROGRAM, "CONOPS-S7", "Snapshots"],
    audit:     [PROGRAM, "Audit log"],
    integrity: [PROGRAM, "Integrity"],
    search:    [PROGRAM, "Search"],
    admin:     ["Workspace", "Administration"],
  }[screen] || [PROGRAM];

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>
      <Sidebar screen={screen} onScreen={setScreen} collapsed={t.sidebarCollapsed} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <Topbar
          breadcrumb={breadcrumbs}
          onToggleSidebar={() => setTweak("sidebarCollapsed", !t.sidebarCollapsed)}
          onToggleTheme={() => setTweak("theme", t.theme === "dark" ? "light" : "dark")}
          theme={t.theme}
          onSearch={() => setScreen("search")}
        />
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
          {screen === "repo"      && <ScreenRepository onOpenDoc={() => setScreen("document")} />}
          {screen === "document"  && <ScreenDocument showTraceColumns={t.showTraceColumns} />}
          {screen === "schema"    && <ScreenSchema />}
          {screen === "trace"     && <ScreenTrace />}
          {screen === "snapshots" && <ScreenSnapshots />}
          {screen === "audit"     && <ScreenAudit />}
          {screen === "integrity" && <ScreenAudit />}
          {screen === "search"    && <ScreenSearch />}
          {screen === "admin"     && <ScreenAdmin />}
        </div>
      </div>

      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakRadio label="Mode" value={t.theme} options={["light","dark"]} onChange={v => setTweak("theme", v)} />
        <TweakColor label="Accent" value={t.accent}
          options={[
            ["#5B6FE0","#5B6FE0","#5B6FE0"],
            ["#1FA8B0","#1FA8B0","#1FA8B0"],
            ["#2C9D6E","#2C9D6E","#2C9D6E"],
            ["#C28A2E","#C28A2E","#C28A2E"],
            ["#7E5BD0","#7E5BD0","#7E5BD0"],
          ]}
          onChange={(_, idx) => setTweak("accent", ["indigo","teal","emerald","amber","violet"][idx ?? 0])}
        />

        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density} options={["compact","balanced","comfortable"]} onChange={v => setTweak("density", v)} />
        <TweakToggle label="Collapse sidebar" value={t.sidebarCollapsed} onChange={v => setTweak("sidebarCollapsed", v)} />
        <TweakToggle label="Show trace column" value={t.showTraceColumns} onChange={v => setTweak("showTraceColumns", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
