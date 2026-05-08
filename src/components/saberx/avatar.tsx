export function Avatar({ name, size = 22 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const seed = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = seed % 360;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `oklch(0.78 0.06 ${hue})`,
        color: `oklch(0.32 0.07 ${hue})`,
        fontSize: size * 0.42,
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "none",
        letterSpacing: "0.01em",
        border: "1px solid rgba(0,0,0,0.06)"
      }}
    >
      {initials || "?"}
    </div>
  );
}
