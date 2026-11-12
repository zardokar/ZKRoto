// The components the layout can place (config.layout.slots). Removing a component = its folder, its line here and
// its name in the layout config; no other file knows it.
import { mount as people } from "./people/people.js";
import { mount as views } from "./views/views.js";
import { mount as tabs } from "./tabs/tabs.js";
import { mount as povview } from "./povview/povview.js";
import { mount as povpanel } from "./povpanel/povpanel.js";
import { mount as minimap } from "./minimap/minimap.js";
import { mount as points } from "./points/points.js";
import { mount as exportbar } from "./exportbar/exportbar.js";

export const REGISTRY = { people, views, tabs, povview, povpanel, minimap, points, exportbar };
