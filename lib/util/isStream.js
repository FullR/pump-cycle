export default function isStream(v) {
  return v && typeof v.subscribe === "function";
};
