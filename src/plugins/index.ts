import { standardPlugin } from "./standard";
import { academicPlugin } from "./academic";

// Register additional trusted plugins here. Preset JSON never executes code.
export const plugins = [standardPlugin, academicPlugin];
