// Lightweight icon set — stroked, 14px default. All icons share the .ic class.
// Naming: <Icon name="search" /> usage.

const ICONS = {
  // navigation
  search:    "M11.5 11.5 14 14 M7 12.5a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11Z",
  plus:      "M3 8h10 M8 3v10",
  minus:     "M3 8h10",
  x:         "M3.5 3.5 12.5 12.5 M12.5 3.5 3.5 12.5",
  check:     "M3 8.5 6.5 12 13 4.5",
  chevronR:  "M6 3l4 5-4 5",
  chevronD:  "M3 6l5 4 5-4",
  chevronU:  "M3 10l5-4 5 4",
  chevronL:  "M10 3 6 8l4 5",
  more:      "M3.5 8h.01 M8 8h.01 M12.5 8h.01",
  filter:    "M2 3.5h12 M4 7.5h8 M6 11.5h4",
  sort:      "M4 3v10 M2 11l2 2 2-2 M12 13V3 M10 5l2-2 2 2",
  download:  "M8 3v8 M5 8l3 3 3-3 M3 13.5h10",
  upload:    "M8 11V3 M5 6l3-3 3 3 M3 13.5h10",
  external:  "M9 3h4v4 M13 3 7.5 8.5 M11.5 9.5V13H3V4.5h3.5",
  link:      "M9.5 6.5 11 5a2.5 2.5 0 1 1 3.5 3.5L13 10 M6.5 9.5 5 11a2.5 2.5 0 1 1-3.5-3.5L3 6 M6 10l4-4",
  copy:      "M5.5 5.5h7v8h-7z M3.5 10.5V2.5h7",
  // structure
  doc:       "M3.5 1.5h6l3 3v10h-9v-13Z M9.5 1.5v3h3",
  docs:      "M2.5 3.5h6l3 3v8h-9v-11Z M5.5 1.5h6l3 3v8 M8.5 3.5v3h3",
  folder:    "M2 4.5h4l1.5 1.5h6.5v8.5H2v-10Z",
  grid:      "M2.5 2.5h4v4h-4z M9.5 2.5h4v4h-4z M2.5 9.5h4v4h-4z M9.5 9.5h4v4h-4z",
  rows:      "M2 3.5h12 M2 8h12 M2 12.5h12",
  schema:    "M2.5 4.5h11 M2.5 8h11 M2.5 11.5h11 M5 2v12",
  trace:     "M3 3.5h3v3h-3z M10 3.5h3v3h-3z M3 9.5h3v3h-3z M10 9.5h3v3h-3z M6 5h4 M11.5 6.5v3 M4.5 6.5v3 M6 11h4",
  branch:    "M5 2v12 M5 6c0 2 4 1 4 4v2 M9 4l2 2-2 2",
  history:   "M2.5 3.5a6 6 0 1 1 0 9 M2.5 1v3h3 M8 5v3l2 1.5",
  shield:    "M8 1.5 3 3.5v4c0 3 2.2 5.5 5 7 2.8-1.5 5-4 5-7v-4l-5-2Z",
  audit:     "M3.5 1.5h6l3 3v10h-9v-13Z M5.5 6h5 M5.5 8.5h5 M5.5 11h3",
  bolt:      "M9 1.5 3.5 9h4l-1 5.5L13 7H9V1.5Z",
  flag:      "M3 14V2 M3 2.5h8l-2 3 2 3H3",
  alert:     "M8 1.5 14.5 13H1.5L8 1.5Z M8 6v3.5 M8 11.5h.01",
  info:      "M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z M8 7v4 M8 5h.01",
  bell:      "M4 6.5a4 4 0 1 1 8 0c0 3 1 4 1 4H3s1-1 1-4Z M6.5 12.5a1.5 1.5 0 0 0 3 0",
  // user / settings
  user:      "M8 8.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M2.5 14c.5-2.5 2.8-4 5.5-4s5 1.5 5.5 4",
  users:     "M5.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M2 13.5c.3-2 2-3.5 3.5-3.5s3.2 1.5 3.5 3.5 M11 8.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M14 13c-.2-1.6-1.4-2.7-2.5-2.8",
  settings:  "M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M13 8a5 5 0 0 0-.1-.9l1.4-1-1.4-2.4-1.7.5a4.9 4.9 0 0 0-1.5-.9L9.5 1.5h-3l-.2 1.8a4.9 4.9 0 0 0-1.5.9L3 3.7 1.7 6.1l1.4 1A5 5 0 0 0 3 8c0 .3 0 .6.1.9l-1.4 1 1.3 2.4 1.7-.5c.5.4 1 .7 1.5.9l.3 1.8h3l.2-1.8c.5-.2 1-.5 1.5-.9l1.7.5 1.4-2.4-1.4-1c0-.3.1-.6.1-.9Z",
  lock:      "M4 7.5h8v6.5H4z M5.5 7.5V5a2.5 2.5 0 0 1 5 0v2.5",
  key:       "M9.5 8.5a3 3 0 1 0-3-3 3 3 0 0 0 .5 1.6L1.5 12v2h2v-1.5h1.5V11h1.5L9 8.5h.5Z",
  // misc
  database:  "M3 3.5c0 1 2.2 2 5 2s5-1 5-2-2.2-2-5-2-5 1-5 2Z M3 3.5v9c0 1 2.2 2 5 2s5-1 5-2v-9 M3 8c0 1 2.2 2 5 2s5-1 5-2",
  cube:      "M8 1.5 14 4.5v7L8 14.5l-6-3v-7Z M2 4.5l6 3 6-3 M8 7.5v7",
  star:      "M8 1.5 9.8 5.6l4.5.4-3.4 3 1 4.4L8 11l-3.9 2.4 1-4.4-3.4-3 4.5-.4Z",
  pin:       "M8 1.5v4l-2.5 2.5h5L8 5.5 M8 8v6.5",
  diff:      "M5 4.5v7 M2.5 7H7 M2.5 9H7 M9 4.5h4.5v7H9z M11 6.5h.5 M11 8.5h.5",
  eye:       "M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8Z M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  edit:      "M11 2.5 13.5 5 5 13.5H2.5V11L11 2.5Z",
  trash:     "M2.5 4h11 M5.5 4V2.5h5V4 M4 4l.5 10h7L12 4",
  refresh:   "M14 2.5v3.5H10.5 M2 13.5V10h3.5 M13.5 6a6 6 0 0 0-11.2-.5 M2.5 10a6 6 0 0 0 11.2.5",
  command:   "M5.5 5.5h5v5h-5z M5.5 5.5V3.5a1.5 1.5 0 1 0-1.5 1.5h1.5 M10.5 5.5h2a1.5 1.5 0 1 0-1.5-1.5v1.5 M10.5 10.5h2a1.5 1.5 0 1 1-1.5 1.5v-1.5 M5.5 10.5v2a1.5 1.5 0 1 1-1.5-1.5h1.5",
  sun:       "M8 3v1.5 M8 11.5V13 M3 8H1.5 M14.5 8H13 M4.6 4.6 3.5 3.5 M12.5 12.5l-1.1-1.1 M11.4 4.6l1.1-1.1 M3.5 12.5l1.1-1.1 M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  moon:      "M13 9.5A5.5 5.5 0 1 1 6.5 3a4.5 4.5 0 0 0 6.5 6.5Z",
  panelL:    "M2.5 3h11v10h-11z M6 3v10",
  arrowR:    "M3 8h10 M9 4l4 4-4 4",
  arrowL:    "M13 8H3 M7 4 3 8l4 4",
  hash:      "M2 5.5h12 M2 10.5h12 M5.5 2 4 14 M11.5 2 10 14",
  type:      "M3 3.5h10 M8 3.5V13 M6 13h4",
  number:    "M4 3v10 M7 7h4M7 11h4 M7 3l1.5 4 1-4",
  bool:      "M5 5.5h6a2.5 2.5 0 1 1 0 5H5a2.5 2.5 0 1 1 0-5Z M5 5.5a2.5 2.5 0 0 1 0 5",
  calendar:  "M3 4h10v10H3z M3 7h10 M5.5 2v3 M10.5 2v3",
  tag:       "M2 2h6l6 6-6 6-6-6V2Z M5 5.5h.01",
  list:      "M2.5 4h.01 M5.5 4h8 M2.5 8h.01 M5.5 8h8 M2.5 12h.01 M5.5 12h8",
  layers:    "M8 1.5 1.5 5 8 8.5 14.5 5 8 1.5Z M1.5 8 8 11.5 14.5 8 M1.5 11 8 14.5 14.5 11",
  package:   "M8 1.5 14 4.5v7L8 14.5l-6-3v-7Z M2 4.5l6 3 6-3 M5 3l6 3 M8 7.5v7",
  warning:   "M8 1.5 14.5 13H1.5L8 1.5Z M8 6v3.5 M8 11.5h.01",
  question:  "M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z M6 6.5a2 2 0 0 1 4 0c0 1.5-2 1.5-2 3 M8 11.5h.01",
  dragHandle: "M5 3.5h.01 M5 8h.01 M5 12.5h.01 M11 3.5h.01 M11 8h.01 M11 12.5h.01",
  expand:    "M2 6V2h4 M14 6V2h-4 M2 10v4h4 M14 10v4h-4",
  collapse:  "M6 2v4H2 M10 2v4h4 M6 14v-4H2 M10 14v-4h4",
  flask:     "M6 1.5h4 M6.5 1.5v5L3 13a1 1 0 0 0 .9 1.5h8.2A1 1 0 0 0 13 13L9.5 6.5v-5",
};

function Icon({ name, size = 14, className = "", style = {}, ...rest }) {
  const d = ICONS[name];
  if (!d) return null;
  const cls = "ic" + (size === 12 ? " ic-sm" : size === 16 ? " ic-lg" : "") + (className ? " " + className : "");
  const customSize = size !== 12 && size !== 14 && size !== 16;
  return (
    <svg
      viewBox="0 0 16 16"
      className={cls}
      style={customSize ? { width: size, height: size, ...style } : style}
      {...rest}
    >
      {d.split(" M").map((seg, i) => (
        <path key={i} d={(i === 0 ? seg : "M" + seg)} />
      ))}
    </svg>
  );
}

window.Icon = Icon;
