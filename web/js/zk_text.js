// LOGICAL (pure): fill "{name}" slots of a message from constants/zkroto.json.
const SLOT = /\{(\w+)\}/g;

export function fmt(template, vars) {
  return template.replace(SLOT, function (whole, key) {
    return key in vars ? String(vars[key]) : whole;
  });
}
