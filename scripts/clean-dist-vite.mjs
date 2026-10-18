import { rmSync } from "node:fs";

rmSync("dist/.vite", { recursive: true, force: true });
